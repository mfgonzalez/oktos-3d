'use strict';

const db = require('../db');
const { calculateProductCost } = require('./costEngine');

function getSettings(database = db) {
  return database.prepare('SELECT * FROM cost_settings WHERE id = 1').get();
}

function getBom(productId, database = db) {
  return database
    .prepare(
      `SELECT pm.material_id, pm.grams_used, m.cost_per_kg
       FROM product_materials pm
       JOIN materials m ON m.id = pm.material_id
       WHERE pm.product_id = ?`
    )
    .all(productId);
}

/**
 * Recomputes and caches product_costs for a single product from its current
 * BOM, print time, and the global cost settings.
 */
function recomputeProductCost(productId, database = db) {
  const product = database.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return null;

  const bomRows = getBom(productId, database);
  const settings = getSettings(database);

  const bom = bomRows.map((r) => ({ gramsUsed: r.grams_used, costPerKg: r.cost_per_kg }));
  const cost = calculateProductCost({
    bom,
    printTimeMinutes: product.print_time_minutes,
    settings: {
      electricityRateKwh: settings.electricity_rate_kwh,
      printerWattageDefault: settings.printer_wattage_default,
      laborRateHour: settings.labor_rate_hour,
      laborMinutesDefault: settings.labor_minutes_default,
      overheadPercent: settings.overhead_percent,
      marginPercent: settings.margin_percent,
    },
  });

  database
    .prepare(
      `INSERT INTO product_costs (product_id, material_cost, electricity_cost, labor_cost, overhead_cost, total_cost, suggested_price, updated_at)
       VALUES (@product_id, @material_cost, @electricity_cost, @labor_cost, @overhead_cost, @total_cost, @suggested_price, datetime('now'))
       ON CONFLICT(product_id) DO UPDATE SET
         material_cost=excluded.material_cost,
         electricity_cost=excluded.electricity_cost,
         labor_cost=excluded.labor_cost,
         overhead_cost=excluded.overhead_cost,
         total_cost=excluded.total_cost,
         suggested_price=excluded.suggested_price,
         updated_at=excluded.updated_at`
    )
    .run({
      product_id: productId,
      material_cost: cost.materialCost,
      electricity_cost: cost.electricityCost,
      labor_cost: cost.laborCost,
      overhead_cost: cost.overheadCost,
      total_cost: cost.totalCost,
      suggested_price: cost.suggestedPrice,
    });

  return cost;
}

/** Recomputes costs for every product (used when global settings change). */
function recomputeAllProductCosts(database = db) {
  const ids = database.prepare('SELECT id FROM products').all().map((r) => r.id);
  for (const id of ids) recomputeProductCost(id, database);
  return ids.length;
}

module.exports = { recomputeProductCost, recomputeAllProductCosts };
