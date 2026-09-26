import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const emptyForm = {
  name: '',
  type: 'PLA',
  color: '',
  cost_per_kg: '',
  stock_grams: '',
  low_stock_threshold: '200',
  simplyprint_filament_id: '',
}

export default function Materials() {
  const [materials, setMaterials] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)

  function load() {
    api.materials.list().then(setMaterials).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const payload = {
      name: form.name,
      type: form.type,
      color: form.color || null,
      cost_per_kg: Number(form.cost_per_kg) || 0,
      stock_grams: Number(form.stock_grams) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      simplyprint_filament_id: form.simplyprint_filament_id || null,
    }
    try {
      if (editingId) {
        await api.materials.update(editingId, payload)
      } else {
        await api.materials.create(payload)
      }
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(material) {
    setEditingId(material.id)
    setForm({
      name: material.name,
      type: material.type,
      color: material.color || '',
      cost_per_kg: String(material.cost_per_kg),
      stock_grams: String(material.stock_grams),
      low_stock_threshold: String(material.low_stock_threshold),
      simplyprint_filament_id: material.simplyprint_filament_id || '',
    })
  }

  async function handleDelete(id) {
    if (!confirm('Delete this material?')) return
    try {
      await api.materials.remove(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdjust(id) {
    const delta = prompt('Grams to add (negative to subtract):', '0')
    if (delta === null) return
    try {
      await api.materials.adjustStock(id, Number(delta), 'manual adjustment')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1>Materials</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2>{editingId ? 'Edit material' : 'Add material'}</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <label>Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>Type
            <input name="type" value={form.type} onChange={handleChange} placeholder="PLA, PETG…" />
          </label>
          <label>Color
            <input name="color" value={form.color} onChange={handleChange} />
          </label>
          <label>Cost / kg ($)
            <input name="cost_per_kg" type="number" step="0.01" value={form.cost_per_kg} onChange={handleChange} required />
          </label>
          <label>Stock (g)
            <input name="stock_grams" type="number" step="1" value={form.stock_grams} onChange={handleChange} required />
          </label>
          <label>Low stock threshold (g)
            <input name="low_stock_threshold" type="number" step="1" value={form.low_stock_threshold} onChange={handleChange} />
          </label>
          <label>SimplyPrint filament ID
            <input name="simplyprint_filament_id" value={form.simplyprint_filament_id} onChange={handleChange} />
          </label>
          <div className="actions-row">
            <button type="submit">{editingId ? 'Save' : 'Add material'}</button>
            {editingId && (
              <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(emptyForm) }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Inventory</h2>
        {materials.length === 0 ? (
          <p className="muted">No materials yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Color</th>
                <th>Cost/kg</th>
                <th>Stock (g)</th>
                <th>Threshold</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className={m.low_stock ? 'low-stock' : ''}>
                  <td>{m.name}</td>
                  <td>{m.type}</td>
                  <td>{m.color || '—'}</td>
                  <td>${m.cost_per_kg.toFixed(2)}</td>
                  <td>{m.stock_grams.toFixed(0)}</td>
                  <td>{m.low_stock_threshold.toFixed(0)}</td>
                  <td className="actions-row">
                    <button className="secondary" onClick={() => handleAdjust(m.id)}>Adjust</button>
                    <button className="secondary" onClick={() => startEdit(m)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(m.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
