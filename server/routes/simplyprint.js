'use strict';

const express = require('express');
const db = require('../db');
const { syncNow } = require('../services/sync');
const { startScheduler } = require('../services/scheduler');

const router = express.Router();

router.get('/config', (req, res) => {
  const config = db.prepare('SELECT * FROM simplyprint_config WHERE id = 1').get();
  // Never send the raw API key back to the client; just indicate it's set.
  res.json({
    company_id: config.company_id,
    api_key_set: Boolean(config.api_key),
    sync_interval_minutes: config.sync_interval_minutes,
    last_sync_at: config.last_sync_at,
    last_sync_status: config.last_sync_status,
    last_sync_error: config.last_sync_error,
  });
});

router.put('/config', (req, res) => {
  const { api_key, company_id, sync_interval_minutes } = req.body;
  const existing = db.prepare('SELECT * FROM simplyprint_config WHERE id = 1').get();

  db.prepare(
    `UPDATE simplyprint_config SET
       api_key = ?, company_id = ?, sync_interval_minutes = ?
     WHERE id = 1`
  ).run(
    api_key !== undefined ? api_key : existing.api_key,
    company_id !== undefined ? company_id : existing.company_id,
    sync_interval_minutes ?? existing.sync_interval_minutes
  );

  startScheduler();

  const config = db.prepare('SELECT * FROM simplyprint_config WHERE id = 1').get();
  res.json({
    company_id: config.company_id,
    api_key_set: Boolean(config.api_key),
    sync_interval_minutes: config.sync_interval_minutes,
    last_sync_at: config.last_sync_at,
    last_sync_status: config.last_sync_status,
    last_sync_error: config.last_sync_error,
  });
});

router.post('/sync-now', async (req, res) => {
  const result = await syncNow();
  res.json(result);
});

router.get('/printers', (req, res) => {
  res.json(db.prepare('SELECT * FROM simplyprint_printers ORDER BY name').all());
});

router.get('/jobs', (req, res) => {
  res.json(
    db
      .prepare('SELECT * FROM simplyprint_jobs ORDER BY completed_at DESC LIMIT 100')
      .all()
  );
});

module.exports = router;
