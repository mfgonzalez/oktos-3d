'use strict';

const express = require('express');
const db = require('../db');
const { recomputeProductCost } = require('../services/productCosting');

const router = express.Router();

router.get('/', (req, res) => {
  const materials = db.prepare('SELECT * FROM materials ORDER BY name').all();
  const withFlags = materials.map((m) => ({ ...m, low_stock: m.stock_grams <= m.low_stock_threshold }));
  res.json(withFlags);
});

router.get('/:id', (req, res) => {
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!material) return res.status(404).json({ error: 'Material not found' });
  res.json(material);
});

router.post('/', (req, res) => {
  const { name, type, color, cost_per_kg, stock_grams, low_stock_threshold, simplyprint_filament_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const info = db
    .prepare(
      `INSERT INTO materials (name, type, color, cost_per_kg, stock_grams, low_stock_threshold, simplyprint_filament_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      type || 'PLA',
      color || null,
      cost_per_kg ?? 0,
      stock_grams ?? 0,
      low_stock_threshold ?? 200,
      simplyprint_filament_id || null
    );

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(material);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Material not found' });

  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE materials SET name=?, type=?, color=?, cost_per_kg=?, stock_grams=?, low_stock_threshold=?, simplyprint_filament_id=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(
    merged.name,
    merged.type,
    merged.color,
    merged.cost_per_kg,
    merged.stock_grams,
    merged.low_stock_threshold,
    merged.simplyprint_filament_id,
    req.params.id
  );

  recomputeAffectedProducts(req.params.id);

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  res.json(material);
});

// Manual stock adjustment, e.g. +/- grams after a spool change or a manual print.
router.post('/:id/adjust-stock', (req, res) => {
  const { delta_grams, reason } = req.body;
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!material) return res.status(404).json({ error: 'Material not found' });
  if (typeof delta_grams !== 'number') return res.status(400).json({ error: 'delta_grams must be a number' });

  db.prepare(
    `UPDATE materials SET stock_grams = stock_grams + ?, updated_at = datetime('now') WHERE id = ?`
  ).run(delta_grams, req.params.id);

  const updated = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  res.json({ ...updated, adjustment: { delta_grams, reason: reason || null } });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Material not found' });
  res.status(204).end();
});

function recomputeAffectedProducts(materialId) {
  const productIds = db
    .prepare('SELECT DISTINCT product_id FROM product_materials WHERE material_id = ?')
    .all(materialId)
    .map((r) => r.product_id);
  for (const id of productIds) recomputeProductCost(id);
}

module.exports = router;
