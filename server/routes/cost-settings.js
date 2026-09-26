'use strict';

const express = require('express');
const db = require('../db');
const { recomputeAllProductCosts } = require('../services/productCosting');

const router = express.Router();

router.get('/', (req, res) => {
  const settings = db.prepare('SELECT * FROM cost_settings WHERE id = 1').get();
  res.json(settings);
});

router.put('/', (req, res) => {
  const existing = db.prepare('SELECT * FROM cost_settings WHERE id = 1').get();
  const merged = { ...existing, ...req.body };

  db.prepare(
    `UPDATE cost_settings SET
       electricity_rate_kwh=?, printer_wattage_default=?, labor_rate_hour=?,
       labor_minutes_default=?, overhead_percent=?, margin_percent=?
     WHERE id=1`
  ).run(
    merged.electricity_rate_kwh,
    merged.printer_wattage_default,
    merged.labor_rate_hour,
    merged.labor_minutes_default,
    merged.overhead_percent,
    merged.margin_percent
  );

  const updatedCount = recomputeAllProductCosts();

  const settings = db.prepare('SELECT * FROM cost_settings WHERE id = 1').get();
  res.json({ ...settings, recomputed_products: updatedCount });
});

module.exports = router;
