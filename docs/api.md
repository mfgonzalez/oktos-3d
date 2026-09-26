# Oktos-3D API reference

Base URL: `http://localhost:4000/api` (proxied through Vite at `/api` in dev).

## Materials

| Method | Path | Description |
|---|---|---|
| GET | `/materials` | List all materials (includes computed `low_stock` flag) |
| GET | `/materials/:id` | Get one material |
| POST | `/materials` | Create a material |
| PUT | `/materials/:id` | Update a material |
| POST | `/materials/:id/adjust-stock` | Adjust stock by `{ delta_grams, reason }` |
| DELETE | `/materials/:id` | Delete a material |

## Products

| Method | Path | Description |
|---|---|---|
| GET | `/products` | List all products with cached cost |
| GET | `/products/:id` | Get one product with its BOM and cost |
| POST | `/products` | Create a product (optionally with `bom: [{material_id, grams_used}]`) |
| PUT | `/products/:id` | Update product fields (and optionally `bom`) |
| PUT | `/products/:id/bom` | Replace a product's full BOM |
| POST | `/products/:id/apply-job/:jobId` | Auto-fill print time from a cached SimplyPrint job |
| DELETE | `/products/:id` | Delete a product |

## Cost settings

| Method | Path | Description |
|---|---|---|
| GET | `/cost-settings` | Get global cost settings |
| PUT | `/cost-settings` | Update settings; recomputes all cached product costs |

## SimplyPrint

| Method | Path | Description |
|---|---|---|
| GET | `/simplyprint/config` | Get sync config (API key redacted) |
| PUT | `/simplyprint/config` | Update API key / company id / sync interval |
| POST | `/simplyprint/sync-now` | Trigger an immediate sync |
| GET | `/simplyprint/printers` | List cached printers |
| GET | `/simplyprint/jobs` | List cached completed jobs (most recent 100) |

## Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Aggregated view: materials, low-stock list, recent jobs, product costs, sync status |
