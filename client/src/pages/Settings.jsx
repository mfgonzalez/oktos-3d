import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function Settings() {
  const [costSettings, setCostSettings] = useState(null)
  const [spConfig, setSpConfig] = useState(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [companyIdInput, setCompanyIdInput] = useState('')
  const [intervalInput, setIntervalInput] = useState('15')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [syncing, setSyncing] = useState(false)

  function load() {
    api.costSettings.get().then(setCostSettings).catch((e) => setError(e.message))
    api.simplyprint.getConfig().then((c) => {
      setSpConfig(c)
      setCompanyIdInput(c.company_id || '')
      setIntervalInput(String(c.sync_interval_minutes))
    }).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  function handleCostChange(e) {
    setCostSettings({ ...costSettings, [e.target.name]: Number(e.target.value) })
  }

  async function handleSaveCostSettings(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const result = await api.costSettings.update(costSettings)
      setCostSettings(result)
      setMessage(`Saved. Recomputed costs for ${result.recomputed_products} product(s).`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSaveSimplyPrint(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const payload = {
        company_id: companyIdInput || null,
        sync_interval_minutes: Number(intervalInput) || 15,
      }
      if (apiKeyInput) payload.api_key = apiKeyInput
      const result = await api.simplyprint.updateConfig(payload)
      setSpConfig(result)
      setApiKeyInput('')
      setMessage('SimplyPrint settings saved.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSyncNow() {
    setSyncing(true)
    setError(null)
    setMessage(null)
    try {
      const result = await api.simplyprint.syncNow()
      if (result.status === 'error') {
        setError(result.error)
      } else if (result.status === 'disabled') {
        setMessage('Sync is disabled: no API key/company id configured yet.')
      } else {
        setMessage(`Sync complete. ${result.newJobs?.length ?? 0} new job(s) processed.`)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  if (!costSettings || !spConfig) return <p className="muted">Loading settings…</p>

  return (
    <div>
      <h1>Settings</h1>
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="card">{message}</div>}

      <div className="card">
        <h2>Cost settings</h2>
        <form className="inline-form" onSubmit={handleSaveCostSettings}>
          <label>Electricity rate ($/kWh)
            <input type="number" step="0.01" name="electricity_rate_kwh" value={costSettings.electricity_rate_kwh} onChange={handleCostChange} />
          </label>
          <label>Default printer wattage (W)
            <input type="number" step="1" name="printer_wattage_default" value={costSettings.printer_wattage_default} onChange={handleCostChange} />
          </label>
          <label>Labor rate ($/hour)
            <input type="number" step="0.01" name="labor_rate_hour" value={costSettings.labor_rate_hour} onChange={handleCostChange} />
          </label>
          <label>Default labor minutes
            <input type="number" step="1" name="labor_minutes_default" value={costSettings.labor_minutes_default} onChange={handleCostChange} />
          </label>
          <label>Overhead (%)
            <input type="number" step="0.1" name="overhead_percent" value={costSettings.overhead_percent} onChange={handleCostChange} />
          </label>
          <label>Margin (%)
            <input type="number" step="0.1" name="margin_percent" value={costSettings.margin_percent} onChange={handleCostChange} />
          </label>
          <button type="submit">Save cost settings</button>
        </form>
      </div>

      <div className="card">
        <h2>SimplyPrint integration</h2>
        <p className="muted">
          Status:{' '}
          <span className={`badge ${spConfig.api_key_set ? 'ok' : 'disabled'}`}>
            {spConfig.api_key_set ? 'configured' : 'not configured'}
          </span>
          {' '}Last sync: {spConfig.last_sync_at || 'never'} ({spConfig.last_sync_status || 'n/a'})
        </p>
        {spConfig.last_sync_error && <div className="error-banner">{spConfig.last_sync_error}</div>}

        <form className="inline-form" onSubmit={handleSaveSimplyPrint}>
          <label>API key {spConfig.api_key_set && <span className="muted">(already set — leave blank to keep)</span>}
            <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="sp_..." />
          </label>
          <label>Company ID
            <input value={companyIdInput} onChange={(e) => setCompanyIdInput(e.target.value)} />
          </label>
          <label>Sync interval (minutes)
            <input type="number" min="1" value={intervalInput} onChange={(e) => setIntervalInput(e.target.value)} />
          </label>
          <div className="actions-row">
            <button type="submit">Save</button>
            <button type="button" className="secondary" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </form>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Get your API key and company ID from your SimplyPrint account under Account Settings → API.
          See the README for details.
        </p>
      </div>
    </div>
  )
}
