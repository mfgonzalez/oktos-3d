'use strict';

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.OKTOS_DB_PATH || path.join(DATA_DIR, 'oktos.sqlite');

/**
 * Creates (and migrates) a database instance at the given path, or an
 * in-memory database when `:memory:` is passed. Used by the app singleton
 * below and by tests that need an isolated database.
 */
function createDb(dbPath) {
  const instance = new Database(dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  migrate(instance);
  return instance;
}

const db = createDb(DB_PATH);

function migrate(instance) {
  instance.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'PLA',
      color TEXT,
      cost_per_kg REAL NOT NULL DEFAULT 0,
      stock_grams REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL NOT NULL DEFAULT 200,
      simplyprint_filament_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      print_time_minutes REAL NOT NULL DEFAULT 0,
      image TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_materials (
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      grams_used REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, material_id)
    );

    CREATE TABLE IF NOT EXISTS cost_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      electricity_rate_kwh REAL NOT NULL DEFAULT 0.15,
      printer_wattage_default REAL NOT NULL DEFAULT 150,
      labor_rate_hour REAL NOT NULL DEFAULT 20,
      labor_minutes_default REAL NOT NULL DEFAULT 10,
      overhead_percent REAL NOT NULL DEFAULT 10,
      margin_percent REAL NOT NULL DEFAULT 40
    );

    CREATE TABLE IF NOT EXISTS product_costs (
      product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      material_cost REAL NOT NULL DEFAULT 0,
      electricity_cost REAL NOT NULL DEFAULT 0,
      labor_cost REAL NOT NULL DEFAULT 0,
      overhead_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      suggested_price REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS simplyprint_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_key TEXT,
      company_id TEXT,
      last_sync_at TEXT,
      sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
      last_sync_status TEXT,
      last_sync_error TEXT
    );

    CREATE TABLE IF NOT EXISTS simplyprint_printers (
      id TEXT PRIMARY KEY,
      name TEXT,
      status TEXT,
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS simplyprint_jobs (
      id TEXT PRIMARY KEY,
      printer_id TEXT,
      file_name TEXT,
      filament_used_grams REAL,
      print_time_minutes REAL,
      completed_at TEXT,
      matched_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      stock_deducted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure a single cost_settings row and simplyprint_config row exist.
  instance.prepare(
    `INSERT OR IGNORE INTO cost_settings (id) VALUES (1)`
  ).run();
  instance.prepare(
    `INSERT OR IGNORE INTO simplyprint_config (id) VALUES (1)`
  ).run();
}

module.exports = db;
module.exports.createDb = createDb;
