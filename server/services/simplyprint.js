'use strict';

const axios = require('axios');

const BASE_URL = 'https://api.simplyprint.io';

/**
 * Thin client around the SimplyPrint API (https://apidocs.simplyprint.io).
 *
 * All requests are authenticated with the `X-API-KEY` header and scoped to a
 * company id in the URL path, per SimplyPrint's documented API shape:
 *   GET /{company_id}/Printers/  -> list printers
 *   GET /{company_id}/Jobs/GetHistory -> list historical/completed print jobs
 *
 * NOTE: We have not validated these exact endpoint paths against a live
 * SimplyPrint account/API key (none was available during implementation).
 * The shapes below follow the publicly documented API docs as of writing.
 * Once a real API key is available, confirm the exact endpoint names/response
 * shapes and adjust `listPrinters` / `listCompletedJobs` accordingly.
 */
class SimplyPrintClient {
  constructor({ apiKey, companyId, timeoutMs = 10000 }) {
    if (!apiKey || !companyId) {
      throw new Error('SimplyPrintClient requires both apiKey and companyId');
    }
    this.apiKey = apiKey;
    this.companyId = companyId;
    this.http = axios.create({
      baseURL: `${BASE_URL}/${encodeURIComponent(companyId)}`,
      timeout: timeoutMs,
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
    });
  }

  async listPrinters() {
    const { data } = await this.http.get('/Printers/');
    return normalizePrinters(data);
  }

  async listCompletedJobs({ since } = {}) {
    const params = {};
    if (since) params.since = since;
    const { data } = await this.http.get('/Jobs/GetHistory', { params });
    return normalizeJobs(data);
  }
}

function normalizePrinters(data) {
  const list = Array.isArray(data) ? data : data?.printers || data?.data || [];
  return list.map((p) => ({
    id: String(p.id ?? p.printer_id ?? p.uuid),
    name: p.name ?? p.printer_name ?? 'Unknown printer',
    status: p.status ?? p.state ?? 'unknown',
    last_seen: p.last_seen ?? p.lastSeen ?? p.updated_at ?? null,
  }));
}

function normalizeJobs(data) {
  const list = Array.isArray(data) ? data : data?.jobs || data?.history || data?.data || [];
  return list
    .filter((j) => isCompletedJob(j))
    .map((j) => ({
      id: String(j.id ?? j.job_id ?? j.uuid),
      printer_id: String(j.printer_id ?? j.printerId ?? ''),
      file_name: j.file_name ?? j.filename ?? j.file?.name ?? 'unknown.gcode',
      filament_used_grams: Number(j.filament_used_grams ?? j.filament_usage ?? j.filament_grams ?? 0),
      print_time_minutes: Number(j.print_time_minutes ?? (j.print_time_seconds ? j.print_time_seconds / 60 : 0)),
      completed_at: j.completed_at ?? j.finished_at ?? j.end_time ?? null,
      simplyprint_filament_id: j.filament_id ?? j.filamentId ?? null,
    }));
}

function isCompletedJob(j) {
  const status = (j.status ?? j.state ?? '').toString().toLowerCase();
  if (!status) return true; // assume history endpoint only returns finished jobs
  return status.includes('complet') || status.includes('finish') || status === 'done';
}

module.exports = { SimplyPrintClient };
