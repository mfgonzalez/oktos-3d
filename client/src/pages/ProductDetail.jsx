import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [materials, setMaterials] = useState([])
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [printTime, setPrintTime] = useState('')
  const [notes, setNotes] = useState('')
  const [bomLines, setBomLines] = useState([])

  function load() {
    Promise.all([api.products.get(id), api.materials.list(), api.simplyprint.jobs()])
      .then(([p, m, j]) => {
        setProduct(p)
        setMaterials(m)
        setJobs(j)
        setName(p.name)
        setDescription(p.description || '')
        setPrintTime(String(p.print_time_minutes))
        setNotes(p.notes || '')
        setBomLines(p.bom.map((b) => ({ material_id: b.material_id, grams_used: b.grams_used })))
      })
      .catch((e) => setError(e.message))
  }

  useEffect(load, [id])

  async function handleSaveDetails(e) {
    e.preventDefault()
    try {
      await api.products.update(id, {
        name,
        description,
        print_time_minutes: Number(printTime) || 0,
        notes,
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function addBomLine() {
    if (materials.length === 0) return
    setBomLines([...bomLines, { material_id: materials[0].id, grams_used: 0 }])
  }

  function updateBomLine(index, patch) {
    setBomLines(bomLines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function removeBomLine(index) {
    setBomLines(bomLines.filter((_, i) => i !== index))
  }

  async function handleSaveBom() {
    try {
      await api.products.updateBom(id, bomLines)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleApplyJob(jobId) {
    try {
      await api.products.applyJob(id, jobId)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this product?')) return
    await api.products.remove(id)
    navigate('/products')
  }

  if (error) return <div className="error-banner">{error}</div>
  if (!product) return <p className="muted">Loading…</p>

  const cost = product.cost

  return (
    <div>
      <h1>{product.name}</h1>

      <div className="grid grid-2">
        <div className="card">
          <h2>Details</h2>
          <form className="inline-form" onSubmit={handleSaveDetails}>
            <label>Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>Print time (min)
              <input type="number" step="1" value={printTime} onChange={(e) => setPrintTime(e.target.value)} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>
            <div className="actions-row">
              <button type="submit">Save</button>
              <button type="button" className="danger" onClick={handleDelete}>Delete product</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2>Cost breakdown</h2>
          {cost ? (
            <div className="cost-breakdown">
              <div className="stat"><div className="muted">Material</div><div className="value">${cost.material_cost.toFixed(2)}</div></div>
              <div className="stat"><div className="muted">Electricity</div><div className="value">${cost.electricity_cost.toFixed(2)}</div></div>
              <div className="stat"><div className="muted">Labor</div><div className="value">${cost.labor_cost.toFixed(2)}</div></div>
              <div className="stat"><div className="muted">Overhead</div><div className="value">${cost.overhead_cost.toFixed(2)}</div></div>
              <div className="stat"><div className="muted">Total cost</div><div className="value">${cost.total_cost.toFixed(2)}</div></div>
              <div className="stat"><div className="muted">Suggested price</div><div className="value">${cost.suggested_price.toFixed(2)}</div></div>
            </div>
          ) : (
            <p className="muted">No cost computed yet.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Bill of materials</h2>
        {bomLines.map((line, i) => (
          <div className="bom-row" key={i}>
            <select
              value={line.material_id}
              onChange={(e) => updateBomLine(i, { material_id: Number(e.target.value) })}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name} (${m.cost_per_kg}/kg)</option>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              value={line.grams_used}
              onChange={(e) => updateBomLine(i, { grams_used: Number(e.target.value) })}
              placeholder="grams used"
            />
            <button className="danger" onClick={() => removeBomLine(i)}>Remove</button>
          </div>
        ))}
        <div className="actions-row" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="secondary" onClick={addBomLine} disabled={materials.length === 0}>
            + Add material
          </button>
          <button type="button" onClick={handleSaveBom}>Save BOM</button>
        </div>
        {materials.length === 0 && <p className="muted">Add materials first on the Materials page.</p>}
      </div>

      <div className="card">
        <h2>Match a SimplyPrint job</h2>
        <p className="muted">Auto-fill print time from a cached completed job.</p>
        {jobs.length === 0 ? (
          <p className="muted">No SimplyPrint jobs cached yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Print time (min)</th>
                <th>Filament (g)</th>
                <th>Completed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.file_name}</td>
                  <td>{j.print_time_minutes ?? '—'}</td>
                  <td>{j.filament_used_grams ?? '—'}</td>
                  <td>{j.completed_at || '—'}</td>
                  <td><button className="secondary" onClick={() => handleApplyJob(j.id)}>Apply</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
