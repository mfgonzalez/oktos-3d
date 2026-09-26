import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

export default function Products() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const navigate = useNavigate()

  function load() {
    api.products.list().then(setProducts).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const product = await api.products.create({ name })
      navigate(`/products/${product.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return
    try {
      await api.products.remove(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1>Products</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2>New product</h2>
        <form className="inline-form" onSubmit={handleCreate}>
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button type="submit">Create</button>
        </form>
      </div>

      <div className="card">
        <h2>All products</h2>
        {products.length === 0 ? (
          <p className="muted">No products yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Print time (min)</th>
                <th>Total cost</th>
                <th>Suggested price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                  <td>{p.print_time_minutes}</td>
                  <td>${p.cost?.total_cost?.toFixed(2) ?? '—'}</td>
                  <td>${p.cost?.suggested_price?.toFixed(2) ?? '—'}</td>
                  <td>
                    <button className="danger" onClick={() => handleDelete(p.id)}>Delete</button>
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
