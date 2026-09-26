'use strict';

/**
 * Pure cost calculation engine for a product.
 *
 * total_cost = material_cost + electricity_cost + labor_cost + overhead_cost
 * suggested_price = total_cost * (1 + margin_percent / 100)
 *
 * @param {Object} params
 * @param {Array<{gramsUsed: number, costPerKg: number}>} params.bom - Bill of materials lines.
 * @param {number} params.printTimeMinutes - Total print time in minutes.
 * @param {Object} params.settings - Cost settings.
 * @param {number} params.settings.electricityRateKwh - Cost per kWh.
 * @param {number} params.settings.printerWattageDefault - Printer power draw in watts.
 * @param {number} params.settings.laborRateHour - Labor rate per hour.
 * @param {number} params.settings.laborMinutesDefault - Default labor/handling minutes per product.
 * @param {number} params.settings.overheadPercent - Overhead as a percent of (material + electricity + labor) cost.
 * @param {number} params.settings.marginPercent - Desired margin percent applied on top of total cost.
 * @returns {{materialCost: number, electricityCost: number, laborCost: number, overheadCost: number, totalCost: number, suggestedPrice: number}}
 */
function calculateProductCost({ bom = [], printTimeMinutes = 0, settings }) {
  if (!settings) {
    throw new Error('calculateProductCost requires cost settings');
  }

  const {
    electricityRateKwh = 0,
    printerWattageDefault = 0,
    laborRateHour = 0,
    laborMinutesDefault = 0,
    overheadPercent = 0,
    marginPercent = 0,
  } = settings;

  const materialCost = bom.reduce((sum, line) => {
    const grams = Number(line.gramsUsed) || 0;
    const costPerKg = Number(line.costPerKg) || 0;
    return sum + (grams / 1000) * costPerKg;
  }, 0);

  const printHours = (Number(printTimeMinutes) || 0) / 60;
  const electricityCost = printHours * (printerWattageDefault / 1000) * electricityRateKwh;

  const laborHours = (Number(laborMinutesDefault) || 0) / 60;
  const laborCost = laborHours * laborRateHour;

  const preOverheadCost = materialCost + electricityCost + laborCost;
  const overheadCost = preOverheadCost * (overheadPercent / 100);

  const totalCost = preOverheadCost + overheadCost;
  const suggestedPrice = totalCost * (1 + marginPercent / 100);

  return {
    materialCost: round2(materialCost),
    electricityCost: round2(electricityCost),
    laborCost: round2(laborCost),
    overheadCost: round2(overheadCost),
    totalCost: round2(totalCost),
    suggestedPrice: round2(suggestedPrice),
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { calculateProductCost, round2 };
