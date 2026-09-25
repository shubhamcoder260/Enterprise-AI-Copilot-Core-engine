// ============================================================
// ERPNEXT DOCTYPE METADATA CLIENT (API-KEY CHANNEL)
// Phase D2: erp.meta.js across Accounting, Selling, Buying, Stock, HR
// Consumes Frappe Desk API: /api/method/frappe.desk.form.load.getdoctype
// Extracts labels, foreign key link graphs, select options, and issubmittable doctrine.
// Caches results in-memory with deepFreeze contracts.
// ============================================================

import http from 'http';
import https from 'https';
import { resolveCredentials } from '../config/credentials.js';
import { deepFreeze } from './dialects/index.js';

const metaCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Normalizes and extracts structured metadata from raw Frappe DocType schema.
 */
function extractDocTypeMetadata(doc) {
  if (!doc || !doc.name) {
    throw new Error("Invalid Frappe DocType payload: missing doc.name");
  }

  const name = String(doc.name);
  const module = String(doc.module || 'Unknown');
  const issubmittable = Number(doc.issubmittable) === 1;
  const istable = Number(doc.istable) === 1;
  const rawFields = Array.isArray(doc.fields) ? doc.fields : [];

  const fields = [];
  const links = [];
  const selectOptions = {};
  let primaryDateField = null;
  let primaryAmountField = null;

  for (const f of rawFields) {
    if (!f.fieldname) continue;

    const fieldObj = {
      fieldname: f.fieldname,
      label: f.label || f.fieldname,
      fieldtype: f.fieldtype || 'Data',
      options: f.options || null,
      reqd: Number(f.reqd) === 1
    };
    fields.push(fieldObj);

    // Foreign key / Link graph edge
    if (f.fieldtype === 'Link' && f.options) {
      links.push({
        field: f.fieldname,
        targetDocType: f.options,
        targetTable: `tab${f.options}`,
        label: f.label || f.fieldname
      });
    }

    // Select options enum
    if (f.fieldtype === 'Select' && typeof f.options === 'string') {
      selectOptions[f.fieldname] = f.options
        .split('\n')
        .map(opt => opt.trim())
        .filter(Boolean);
    }

    // Primary date candidate detection
    if (!primaryDateField && (f.fieldtype === 'Date' || f.fieldtype === 'Datetime')) {
      if (/posting_date|transaction_date|order_date|start_date|creation/i.test(f.fieldname)) {
        primaryDateField = f.fieldname;
      }
    }

    // Primary amount candidate detection
    if (!primaryAmountField && (f.fieldtype === 'Currency' || f.fieldtype === 'Float')) {
      if (/grand_total|net_total|total_debit|paid_amount|gross_pay|stock_value_difference|amount/i.test(f.fieldname)) {
        primaryAmountField = f.fieldname;
      }
    }
  }

  // Fallbacks if no candidate found yet
  if (!primaryDateField) {
    const fallbackDate = fields.find(f => f.fieldtype === 'Date' || f.fieldtype === 'Datetime');
    if (fallbackDate) primaryDateField = fallbackDate.fieldname;
  }
  if (!primaryAmountField) {
    const fallbackAmount = fields.find(f => f.fieldtype === 'Currency' || f.fieldtype === 'Float');
    if (fallbackAmount) primaryAmountField = fallbackAmount.fieldname;
  }

  return deepFreeze({
    name,
    tableName: `tab${name}`,
    module,
    issubmittable,
    submittable: issubmittable,
    istable,
    fields,
    links,
    selectOptions,
    primaryDateField,
    primaryAmountField,
    fetchedAt: Date.now()
  });
}

/**
 * Performs HTTP/HTTPS GET request to Frappe Desk API.
 */
function fetchFromFrappeApi(targetUrl, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.get(urlObj, { headers, timeout: 5000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse Frappe JSON response: ${err.message}`));
          }
        } else {
          reject(new Error(`Frappe API responded with HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Frappe API request timed out after 5000ms: ${targetUrl}`));
    });
  });
}

/**
 * Fetches DocType metadata for a given doctype name via Frappe Desk API.
 * Uses in-memory cache to guarantee sub-millisecond repeated lookups.
 *
 * @param {string} doctypeName
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function fetchDocTypeMeta(doctypeName, options = {}) {
  if (!doctypeName || typeof doctypeName !== 'string') {
    throw new Error("fetchDocTypeMeta requires a valid string doctypeName");
  }

  const cached = metaCache.get(doctypeName);
  const now = Date.now();
  if (cached && (now - cached.cachedAt < CACHE_TTL_MS) && !options.forceRefresh) {
    return cached.data;
  }

  const creds = resolveCredentials('erpnext');
  const baseUrl = options.baseUrl || process.env.ERPNEXT_URL || 'http://localhost:8000';
  const apiKey = options.apiKey || creds.apiKey || process.env.ERPNEXT_API_KEY || 'default_key';
  const apiSecret = options.apiSecret || creds.apiSecret || process.env.ERPNEXT_API_SECRET || 'default_secret';

  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent(doctypeName)}`;
  const headers = {
    'Accept': 'application/json',
    'Authorization': `token ${apiKey}:${apiSecret}`
  };

  const json = await fetchFromFrappeApi(endpoint, headers);
  const doc = json?.message?.docs?.[0];
  if (!doc) {
    throw new Error(`DocType ${doctypeName} not returned in Frappe message.docs payload`);
  }

  const meta = extractDocTypeMetadata(doc);
  metaCache.set(doctypeName, {
    cachedAt: now,
    data: meta
  });

  return meta;
}

/**
 * Generates a semantic profile fragment from extracted DocType metadata.
 * Suitable for incorporation into erpnext.profile.js.
 */
export function generateSemanticProfileFragment(meta) {
  if (!meta || !meta.name) {
    throw new Error("generateSemanticProfileFragment requires extracted DocType metadata");
  }

  const cleanAlias = meta.name.toLowerCase();
  const pluralAlias = cleanAlias.endsWith('s') ? `${cleanAlias}es` : `${cleanAlias}s`;

  return deepFreeze({
    doctype: meta.name,
    tableName: meta.tableName,
    module: meta.module,
    aliases: [cleanAlias, pluralAlias],
    submittable: meta.submittable,
    docstatusRequired: meta.submittable ? 1 : null,
    dateColumn: meta.primaryDateField,
    amountColumn: meta.primaryAmountField,
    links: meta.links.map(l => ({
      field: l.field,
      targetTable: l.targetTable,
      targetDocType: l.targetDocType
    })),
    selectOptions: meta.selectOptions
  });
}

/**
 * Clears the in-memory metadata cache. Useful for test isolation.
 */
export function clearMetaCache() {
  metaCache.clear();
}

/**
 * Returns the current count of cached DocType metadata entries.
 */
export function getMetaCacheSize() {
  return metaCache.size;
}
