import { NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Materials from './pages/Materials.jsx'
import Products from './pages/Products.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Settings from './pages/Settings.jsx'

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Oktos-3D</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/materials">Materials</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
