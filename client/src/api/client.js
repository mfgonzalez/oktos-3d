const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {
      // not JSON, use raw text
    }
    throw new Error(message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  dashboard: () => request('/dashboard'),

  materials: {
    list: () => request('/materials'),
    get: (id) => request(`/materials/${id}`),
    create: (data) => request('/materials', { method: 'POST', body: data }),
    update: (id, data) => request(`/materials/${id}`, { method: 'PUT', body: data }),
    adjustStock: (id, deltaGrams, reason) =>
      request(`/materials/${id}/adjust-stock`, { method: 'POST', body: { delta_grams: deltaGrams, reason } }),
    remove: (id) => request(`/materials/${id}`, { method: 'DELETE' }),
  },

  products: {
    list: () => request('/products'),
    get: (id) => request(`/products/${id}`),
    create: (data) => request('/products', { method: 'POST', body: data }),
    update: (id, data) => request(`/products/${id}`, { method: 'PUT', body: data }),
    updateBom: (id, bom) => request(`/products/${id}/bom`, { method: 'PUT', body: { bom } }),
    applyJob: (id, jobId) => request(`/products/${id}/apply-job/${jobId}`, { method: 'POST' }),
    remove: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  },

  costSettings: {
    get: () => request('/cost-settings'),
    update: (data) => request('/cost-settings', { method: 'PUT', body: data }),
  },

  simplyprint: {
    getConfig: () => request('/simplyprint/config'),
    updateConfig: (data) => request('/simplyprint/config', { method: 'PUT', body: data }),
    syncNow: () => request('/simplyprint/sync-now', { method: 'POST' }),
    printers: () => request('/simplyprint/printers'),
    jobs: () => request('/simplyprint/jobs'),
  },
};
