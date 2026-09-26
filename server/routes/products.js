'use strict';

const express = require('express');
const db = require('../db');
const { recomputeProductCost } = require('../services/productCosting');

const router = express.Router();

function getProductWithBom(id) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;

  const bom = db
    .prepare(
      `SELECT pm.material_id, pm.grams_used, m.name AS material_name, m.cost_per_kg, m.stock_grams
       FROM product_materials pm
       JOIN materials m ON m.id = pm.material_id
       WHERE pm.product_id = ?`
    )
    .all(id);

  const cost = db.prepare('SELECT * FROM product_costs WHERE product_id = ?').get(id);

  return { ...product, bom, cost: cost || null };
}

router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const withCosts = products.map((p) => ({
    ...p,
    cost: db.prepare('SELECT * FROM product_costs WHERE product_id = ?').get(p.id) || null,
  }));
  res.json(withCosts);
});

router.get('/:id', (req, res) => {
  const product = getProductWithBom(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', (req, res) => {
  const { name, description, print_time_minutes, image, notes, bom } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const info = db
    .prepare(
      `INSERT INTO products (name, description, print_time_minutes, image, notes) VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, description || null, print_time_minutes ?? 0, image || null, notes || null);

  const productId = info.lastInsertRowid;

  if (Array.isArray(bom)) {
    upsertBom(productId, bom);
  }

  recomputeProductCost(productId);
  res.status(201).json(getProductWithBom(productId));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE products SET name=?, description=?, print_time_minutes=?, image=?, notes=?, updated_at=datetime('now') WHERE id=?`
  ).run(merged.name, merged.description, merged.print_time_minutes, merged.image, merged.notes, req.params.id);

  if (Array.isArray(req.body.bom)) {
    upsertBom(req.params.id, req.body.bom);
  }

  recomputeProductCost(req.params.id);
  res.json(getProductWithBom(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.status(204).end();
});

// Replace a product's full BOM list: [{ material_id, grams_used }, ...]
router.put('/:id/bom', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const { bom } = req.body;
  if (!Array.isArray(bom)) return res.status(400).json({ error: 'bom must be an array' });

  upsertBom(req.params.id, bom);
  recomputeProductCost(req.params.id);
  res.json(getProductWithBom(req.params.id));
});

// Auto-fill grams/print time from a cached SimplyPrint job.
router.post('/:id/apply-job/:jobId', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const job = db.prepare('SELECT * FROM simplyprint_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'SimplyPrint job not found' });

  db.prepare(`UPDATE products SET print_time_minutes = ?, updated_at = datetime('now') WHERE id = ?`).run(
    job.print_time_minutes || product.print_time_minutes,
    req.params.id
  );
  db.prepare('UPDATE simplyprint_jobs SET matched_product_id = ? WHERE id = ?').run(req.params.id, req.params.jobId);

  recomputeProductCost(req.params.id);
  res.json(getProductWithBom(req.params.id));
});

function upsertBom(productId, bom) {
  const clear = db.prepare('DELETE FROM product_materials WHERE product_id = ?');
  const insert = db.prepare(
    'INSERT INTO product_materials (product_id, material_id, grams_used) VALUES (?, ?, ?)'
  );
  const tx = db.transaction((lines) => {
    clear.run(productId);
    for (const line of lines) {
      if (!line.material_id) continue;
      insert.run(productId, line.material_id, line.grams_used ?? 0);
    }
  });
  tx(bom);
}

module.exports = router;
