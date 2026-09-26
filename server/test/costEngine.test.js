'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateProductCost, round2 } = require('../services/costEngine');

const baseSettings = {
  electricityRateKwh: 0.15,
  printerWattageDefault: 150,
  laborRateHour: 20,
  laborMinutesDefault: 10,
  overheadPercent: 10,
  marginPercent: 40,
};

test('round2 rounds to two decimal places', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(2.344), 2.34);
});

test('calculateProductCost computes material cost from grams and cost per kg', () => {
  const result = calculateProductCost({
    bom: [{ gramsUsed: 100, costPerKg: 20 }],
    printTimeMinutes: 0,
    settings: { ...baseSettings, printerWattageDefault: 0, laborMinutesDefault: 0 },
  });
  // 100g at $20/kg = $2.00 material cost, no electricity/labor => overhead only on material.
  assert.equal(result.materialCost, 2);
  assert.equal(result.electricityCost, 0);
  assert.equal(result.laborCost, 0);
  assert.equal(result.overheadCost, round2(2 * 0.1));
  assert.equal(result.totalCost, round2(2 + 2 * 0.1));
});

test('calculateProductCost sums multiple BOM lines', () => {
  const result = calculateProductCost({
    bom: [
      { gramsUsed: 50, costPerKg: 20 }, // $1.00
      { gramsUsed: 25, costPerKg: 40 }, // $1.00
    ],
    printTimeMinutes: 0,
    settings: { ...baseSettings, printerWattageDefault: 0, laborMinutesDefault: 0 },
  });
  assert.equal(result.materialCost, 2);
});

test('calculateProductCost includes electricity cost based on print time and wattage', () => {
  const result = calculateProductCost({
    bom: [],
    printTimeMinutes: 60, // 1 hour
    settings: { ...baseSettings, laborMinutesDefault: 0 },
  });
  // 1h * 150W/1000 * $0.15/kWh = $0.0225
  assert.equal(result.electricityCost, round2(0.15 * 0.15));
});

test('calculateProductCost includes labor cost based on default labor minutes', () => {
  const result = calculateProductCost({
    bom: [],
    printTimeMinutes: 0,
    settings: { ...baseSettings, printerWattageDefault: 0 },
  });
  // 10 minutes at $20/hr = $3.33
  assert.equal(result.laborCost, round2((10 / 60) * 20));
});

test('calculateProductCost applies overhead percent on top of material+electricity+labor', () => {
  const result = calculateProductCost({
    bom: [{ gramsUsed: 100, costPerKg: 20 }], // $2.00 material
    printTimeMinutes: 60,
    settings: baseSettings,
  });
  const preOverhead = result.materialCost + result.electricityCost + result.laborCost;
  assert.equal(result.overheadCost, round2(preOverhead * 0.1));
  assert.equal(result.totalCost, round2(preOverhead + result.overheadCost));
});

test('calculateProductCost applies margin percent to compute suggested price', () => {
  const result = calculateProductCost({
    bom: [{ gramsUsed: 100, costPerKg: 20 }],
    printTimeMinutes: 60,
    settings: baseSettings,
  });
  assert.equal(result.suggestedPrice, round2(result.totalCost * 1.4));
});

test('calculateProductCost handles an empty BOM and zero print time gracefully', () => {
  const result = calculateProductCost({
    bom: [],
    printTimeMinutes: 0,
    settings: baseSettings,
  });
  assert.equal(result.materialCost, 0);
  assert.equal(result.electricityCost, 0);
  // Labor cost still applies since laborMinutesDefault is nonzero.
  assert.ok(result.laborCost > 0);
});

test('calculateProductCost throws without settings', () => {
  assert.throws(() => calculateProductCost({ bom: [], printTimeMinutes: 0 }));
});
