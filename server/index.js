'use strict';

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors = require('cors');

const db = require('./db');
const { startScheduler } = require('./services/scheduler');

const materialsRouter = require('./routes/materials');
const productsRouter = require('./routes/products');
const costSettingsRouter = require('./routes/cost-settings');
const simplyprintRouter = require('./routes/simplyprint');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/materials', materialsRouter);
app.use('/api/products', productsRouter);
app.use('/api/cost-settings', costSettingsRouter);
app.use('/api/simplyprint', simplyprintRouter);

app.get('/api/dashboard', (req, res) => {
  const materials = db.prepare('SELECT * FROM materials ORDER BY name').all();
  const lowStock = materials.filter((m) => m.stock_grams <= m.low_stock_threshold);
  const recentJobs = db
    .prepare('SELECT * FROM simplyprint_jobs ORDER BY completed_at DESC LIMIT 10')
    .all();
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const productCosts = products.map((p) => ({
    ...p,
    cost: db.prepare('SELECT * FROM product_costs WHERE product_id = ?').get(p.id) || null,
  }));
  const simplyprintConfig = db.prepare('SELECT * FROM simplyprint_config WHERE id = 1').get();

  res.json({
    materials,
    low_stock_materials: lowStock,
    recent_jobs: recentJobs,
    products: productCosts,
    simplyprint: {
      configured: Boolean(simplyprintConfig.api_key && simplyprintConfig.company_id),
      last_sync_at: simplyprintConfig.last_sync_at,
      last_sync_status: simplyprintConfig.last_sync_status,
      last_sync_error: simplyprintConfig.last_sync_error,
    },
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve the built client in production (after `npm run build` in /client).
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Oktos-3D server listening on http://localhost:${PORT}`);
  startScheduler();
});

module.exports = app;
