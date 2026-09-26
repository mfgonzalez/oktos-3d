import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error-banner">{error}</div>
  if (!data) return <p className="muted">Loading dashboard…</p>

  const { low_stock_materials: lowStock, materials, recent_jobs: recentJobs, products, simplyprint } = data

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="grid grid-2">
        <div className="card">
          <h2>Inventory levels</h2>
          {materials.length === 0 ? (
            <p className="muted">No materials yet. Add some in the Materials page.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Stock (g)</th>
                  <th>Threshold (g)</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className={m.stock_grams <= m.low_stock_threshold ? 'low-stock' : ''}>
                    <td>{m.name} <span className="muted">({m.type})</span></td>
                    <td>{m.stock_grams.toFixed(0)}</td>
                    <td>{m.low_stock_threshold.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {lowStock.length > 0 && (
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              ⚠ {lowStock.length} material(s) low on stock.
            </p>
          )}
        </div>

        <div className="card">
          <h2>SimplyPrint sync</h2>
          <p>
            Status:{' '}
            {simplyprint.configured ? (
              <span className={`badge ${simplyprint.last_sync_status === 'error' ? 'error' : 'ok'}`}>
                {simplyprint.last_sync_status || 'pending first sync'}
              </span>
            ) : (
              <span className="badge disabled">not configured</span>
            )}
          </p>
          <p className="muted">Last sync: {simplyprint.last_sync_at || 'never'}</p>
          {simplyprint.last_sync_error && <p className="error-banner">{simplyprint.last_sync_error}</p>}

          <h3>Recent completed jobs</h3>
          {recentJobs.length === 0 ? (
            <p className="muted">No jobs synced yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Filament (g)</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.file_name}</td>
                    <td>{j.filament_used_grams ?? '—'}</td>
                    <td>{j.completed_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Product cost breakdown</h2>
        {products.length === 0 ? (
          <p className="muted">No products yet. Create one in the Products page.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Material</th>
                <th>Electricity</th>
                <th>Labor</th>
                <th>Overhead</th>
                <th>Total cost</th>
                <th>Suggested price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                  <td>${p.cost?.material_cost?.toFixed(2) ?? '—'}</td>
                  <td>${p.cost?.electricity_cost?.toFixed(2) ?? '—'}</td>
                  <td>${p.cost?.labor_cost?.toFixed(2) ?? '—'}</td>
                  <td>${p.cost?.overhead_cost?.toFixed(2) ?? '—'}</td>
                  <td><strong>${p.cost?.total_cost?.toFixed(2) ?? '—'}</strong></td>
                  <td>${p.cost?.suggested_price?.toFixed(2) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
