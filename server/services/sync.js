'use strict';

const db = require('../db');
const { SimplyPrintClient } = require('./simplyprint');

/**
 * Runs one sync pass: fetch printers + completed jobs from SimplyPrint,
 * cache them locally, and deduct filament stock for newly-seen jobs that
 * match a known product (by simplyprint_filament_id on the product's BOM
 * material, matched to the job's filament, falling back to no auto-match).
 *
 * This function is pure w.r.t. its inputs so it can be unit tested with a
 * fake client. In production, `buildClientFromConfig()` reads the stored
 * simplyprint_config row.
 */
async function runSync(client, { db: database = db } = {}) {
  const printers = await client.listPrinters();
  const jobs = await client.listCompletedJobs();

  const upsertPrinter = database.prepare(`
    INSERT INTO simplyprint_printers (id, name, status, last_seen)
    VALUES (@id, @name, @status, @last_seen)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status, last_seen=excluded.last_seen
  `);

  const txPrinters = database.transaction((list) => {
    for (const p of list) upsertPrinter.run(p);
  });
  txPrinters(printers);

  const existingJob = database.prepare('SELECT id FROM simplyprint_jobs WHERE id = ?');
  const insertJob = database.prepare(`
    INSERT INTO simplyprint_jobs
      (id, printer_id, file_name, filament_used_grams, print_time_minutes, completed_at, matched_product_id, stock_deducted)
    VALUES (@id, @printer_id, @file_name, @filament_used_grams, @print_time_minutes, @completed_at, @matched_product_id, 0)
  `);
  const findMaterialByFilamentId = database.prepare(
    'SELECT * FROM materials WHERE simplyprint_filament_id = ?'
  );
  const deductStock = database.prepare(
    'UPDATE materials SET stock_grams = stock_grams - ?, updated_at = datetime(\'now\') WHERE id = ?'
  );
  const markDeducted = database.prepare(
    'UPDATE simplyprint_jobs SET stock_deducted = 1, matched_product_id = ? WHERE id = ?'
  );

  const newJobs = [];
  const txJobs = database.transaction((list) => {
    for (const j of list) {
      if (existingJob.get(j.id)) continue; // already processed in a previous sync

      insertJob.run({
        id: j.id,
        printer_id: j.printer_id,
        file_name: j.file_name,
        filament_used_grams: j.filament_used_grams,
        print_time_minutes: j.print_time_minutes,
        completed_at: j.completed_at,
        matched_product_id: null,
      });
      newJobs.push(j);

      // Deduct filament stock for the matched material, if we can identify one.
      if (j.simplyprint_filament_id) {
        const material = findMaterialByFilamentId.get(j.simplyprint_filament_id);
        if (material && j.filament_used_grams) {
          deductStock.run(j.filament_used_grams, material.id);
          markDeducted.run(null, j.id);
        }
      }
    }
  });
  txJobs(jobs);

  return { printers, newJobs };
}

/**
 * Builds a SimplyPrintClient from the stored config row, or returns null if
 * no API key/company id has been configured yet.
 */
function buildClientFromConfig(database = db) {
  const config = database.prepare('SELECT * FROM simplyprint_config WHERE id = 1').get();
  if (!config || !config.api_key || !config.company_id) {
    return null;
  }
  return new SimplyPrintClient({ apiKey: config.api_key, companyId: config.company_id });
}

/**
 * Performs a sync using the persisted config, updating last_sync_at/status.
 * Gracefully no-ops (returns a disabled result) when no API key is configured.
 */
async function syncNow(database = db) {
  const client = buildClientFromConfig(database);
  const updateStatus = database.prepare(`
    UPDATE simplyprint_config
    SET last_sync_at = datetime('now'), last_sync_status = @status, last_sync_error = @error
    WHERE id = 1
  `);

  if (!client) {
    updateStatus.run({ status: 'disabled', error: 'No SimplyPrint API key/company id configured' });
    return { status: 'disabled' };
  }

  try {
    const result = await runSync(client, { db: database });
    updateStatus.run({ status: 'ok', error: null });
    return { status: 'ok', ...result };
  } catch (err) {
    const message = err?.response?.data?.message || err.message || 'Unknown sync error';
    updateStatus.run({ status: 'error', error: message });
    return { status: 'error', error: message };
  }
}

module.exports = { runSync, buildClientFromConfig, syncNow };
