# Oktos-3D

A self-hosted 3D printing business manager: filament/material inventory,
products with a bill-of-materials (BOM), a cost/pricing engine, and one-way
sync from [SimplyPrint](https://simplyprint.io) for printers and completed
print jobs (used to auto-deduct filament stock and inform product costing).

Built with:

- **Backend**: Node.js + Express + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Frontend**: React + Vite
- **Scheduler**: [node-cron](https://github.com/node-cron/node-cron) for periodic SimplyPrint polling

## ⚠️ Security note (read this first)

**Oktos-3D has no authentication or authorization.** It is designed to run on
a trusted local network (e.g. a home lab or workshop LAN) alongside your 3D
printers — the same security posture as similar self-hosted print-farm tools
(OctoPrint, SimplyPrint's own dashboards without SSO, etc). Do **not** expose
it directly to the public internet. If you need remote access, put it behind
a VPN (Tailscale, WireGuard) or a reverse proxy with its own auth layer.

There is also no multi-tenant/user model and no orders/invoicing in v1 — it's
a single-shop inventory + costing tool.

## Project structure

```
oktos-3d/
  server/           Express API + SQLite database + SimplyPrint sync
    index.js        App entrypoint
    db.js           SQLite schema/migrations (better-sqlite3)
    routes/         materials, products, cost-settings, simplyprint
    services/       costEngine (pure calc), simplyprint client, sync, scheduler
    data/           SQLite file lives here (gitignored)
    test/           node:test unit tests
  client/           React + Vite frontend
    src/pages/      Dashboard, Materials, Products, ProductDetail, Settings
  docs/
  Dockerfile
  docker-compose.yml
```

## Data model

| Table | Purpose |
|---|---|
| `materials` | Filament inventory: name, type, color, cost/kg, stock (g), low-stock threshold, optional SimplyPrint filament id |
| `products` | Printable products: name, description, print time, image, notes |
| `product_materials` | BOM: grams of each material used per product |
| `cost_settings` | Global electricity rate, printer wattage, labor rate/time, overhead %, margin % |
| `product_costs` | Cached computed cost breakdown per product (recomputed on BOM/material/settings changes) |
| `simplyprint_config` | API key, company id, sync interval, last sync status |
| `simplyprint_printers` | Cached printer list from SimplyPrint |
| `simplyprint_jobs` | Cached completed print jobs from SimplyPrint, with stock-deduction tracking |

## Cost engine

```
material_cost   = Σ (grams_used / 1000 * cost_per_kg)   over the product's BOM
electricity_cost = (print_time_minutes / 60) * (printer_wattage_default / 1000) * electricity_rate_kwh
labor_cost      = (labor_minutes_default / 60) * labor_rate_hour
overhead_cost   = (material_cost + electricity_cost + labor_cost) * (overhead_percent / 100)
total_cost      = material_cost + electricity_cost + labor_cost + overhead_cost
suggested_price = total_cost * (1 + margin_percent / 100)
```

This is a pure function (`server/services/costEngine.js`) with unit tests in
`server/test/costEngine.test.js`. It's recomputed and cached in
`product_costs` whenever a product's BOM, a material's cost/kg, or the global
cost settings change.

## Setup

Requires **Node.js 20.19+ or 22.12+** (needed by the current Vite toolchain).

```bash
git clone https://github.com/mfgonzalez/oktos-3d.git
cd oktos-3d
npm run install:all   # installs server/ and client/ dependencies
```

## Running in development

```bash
npm run dev
```

This runs the Express API (http://localhost:4000) and the Vite dev server
(http://localhost:5173, proxying `/api` to the backend) concurrently.

## Running in production

```bash
npm run build   # builds the React client into client/dist
npm start        # starts the Express server, which also serves client/dist
```

The server listens on `http://localhost:4000` (override with `PORT`).

### Docker

```bash
docker compose up --build
```

This builds the client, bundles it with the server, and persists the SQLite
database to `./data` on the host.

## Tests

```bash
npm test
```

Runs the server's `node:test` suite, covering:

- The cost engine's pure calculation (material/electricity/labor/overhead/margin math).
- The SimplyPrint sync/deduction logic against an in-memory SQLite database
  and a mocked SimplyPrint client (no live API calls), including idempotency
  (re-syncing the same job doesn't double-deduct stock).

## SimplyPrint integration

1. In your [SimplyPrint](https://simplyprint.io) account, go to **Account
   Settings → API** and generate an API key. Note your **Company ID** as well
   (visible in your account/company settings).
2. In Oktos-3D, go to **Settings → SimplyPrint integration** and enter the
   API key, company id, and desired sync interval (minutes).
3. Click **Sync now** to trigger an immediate sync, or wait for the
   background scheduler (runs every N minutes per your configured interval).

The client (`server/services/simplyprint.js`) talks to
`https://api.simplyprint.io/{company_id}/...` with an `X-API-KEY` header, per
the [SimplyPrint API docs](https://apidocs.simplyprint.io). It currently
targets:

- `GET /{company_id}/Printers/` — printer list
- `GET /{company_id}/Jobs/GetHistory` — completed print job history

**Important caveat:** these endpoint paths were implemented against
SimplyPrint's publicly documented API shape; they have **not** been
validated against a live account/API key (none was available during
development). Response parsing (`normalizePrinters`/`normalizeJobs` in
`simplyprint.js`) is intentionally defensive (accepts a few likely field name
variants), but if your SimplyPrint account exposes a different endpoint name
or response shape, you may need to adjust those two functions. Please file
an issue (or open a PR) with a sample response once you've tested against a
real account, and the client can be tightened up.

When no API key/company id is configured, sync is disabled and the
dashboard/settings pages surface that state clearly (no errors are thrown).

### How syncing deducts stock

Each completed job cached from SimplyPrint carries a `filament_used_grams`
and (when available) a SimplyPrint filament id. If that filament id matches a
material's `simplyprint_filament_id`, the sync deducts `filament_used_grams`
from that material's `stock_grams`. Jobs are only processed once (tracked via
`simplyprint_jobs.id`), so re-syncing never double-deducts.

## Follow-ups / known gaps

- Confirm the exact SimplyPrint endpoint names/response shapes once you have
  a real API key to test against (see caveat above).
- No auth — see the security note above before exposing beyond your LAN.
- No orders/invoicing (out of scope for v1).
- Product `image` field currently expects a URL/path string; there's no file
  upload UI yet.
