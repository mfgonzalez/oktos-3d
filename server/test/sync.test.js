'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../db');
const { runSync } = require('../services/sync');

function setupDb() {
  const db = createDb(':memory:');
  const materialId = db
    .prepare(
      `INSERT INTO materials (name, type, cost_per_kg, stock_grams, low_stock_threshold, simplyprint_filament_id)
       VALUES ('Black PLA', 'PLA', 20, 1000, 200, 'sp-filament-1')`
    )
    .run().lastInsertRowid;
  return { db, materialId };
}

function fakeClient({ printers = [], jobs = [] } = {}) {
  return {
    listPrinters: async () => printers,
    listCompletedJobs: async () => jobs,
  };
}

test('runSync caches printers reported by the SimplyPrint client', async () => {
  const { db } = setupDb();
  const client = fakeClient({
    printers: [{ id: 'p1', name: 'Printer One', status: 'idle', last_seen: '2024-01-01T00:00:00Z' }],
  });

  await runSync(client, { db });

  const printers = db.prepare('SELECT * FROM simplyprint_printers').all();
  assert.equal(printers.length, 1);
  assert.equal(printers[0].name, 'Printer One');
});

test('runSync caches completed jobs and deducts matched material stock', async () => {
  const { db, materialId } = setupDb();
  const client = fakeClient({
    jobs: [
      {
        id: 'job-1',
        printer_id: 'p1',
        file_name: 'benchy.gcode',
        filament_used_grams: 50,
        print_time_minutes: 120,
        completed_at: '2024-01-02T00:00:00Z',
        simplyprint_filament_id: 'sp-filament-1',
      },
    ],
  });

  await runSync(client, { db });

  const jobs = db.prepare('SELECT * FROM simplyprint_jobs').all();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'job-1');
  assert.equal(jobs[0].stock_deducted, 1);

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
  assert.equal(material.stock_grams, 950); // 1000 - 50
});

test('runSync does not deduct stock for jobs with no matching material', async () => {
  const { db, materialId } = setupDb();
  const client = fakeClient({
    jobs: [
      {
        id: 'job-2',
        printer_id: 'p1',
        file_name: 'unmatched.gcode',
        filament_used_grams: 30,
        print_time_minutes: 60,
        completed_at: '2024-01-03T00:00:00Z',
        simplyprint_filament_id: 'unknown-filament',
      },
    ],
  });

  await runSync(client, { db });

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
  assert.equal(material.stock_grams, 1000); // unchanged

  const job = db.prepare('SELECT * FROM simplyprint_jobs WHERE id = ?').get('job-2');
  assert.equal(job.stock_deducted, 0);
});

test('runSync is idempotent: re-running does not double-deduct for already-seen jobs', async () => {
  const { db, materialId } = setupDb();
  const job = {
    id: 'job-3',
    printer_id: 'p1',
    file_name: 'again.gcode',
    filament_used_grams: 40,
    print_time_minutes: 90,
    completed_at: '2024-01-04T00:00:00Z',
    simplyprint_filament_id: 'sp-filament-1',
  };
  const client = fakeClient({ jobs: [job] });

  await runSync(client, { db });
  await runSync(client, { db }); // same job reported again

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
  assert.equal(material.stock_grams, 960); // only deducted once (1000 - 40)

  const jobCount = db.prepare('SELECT COUNT(*) AS c FROM simplyprint_jobs').get().c;
  assert.equal(jobCount, 1);
});
