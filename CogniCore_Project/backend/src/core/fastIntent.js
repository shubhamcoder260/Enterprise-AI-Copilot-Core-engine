// ==========================================
// FAST INTENT ROUTER — Deterministic NL → Parameterized SQL Router
// Simplified 3-Shape Essential System:
//   Shape 1: Basic Count   ("how many customers are there?")
//   Shape 2: Filtered Count ("how many orders where status is completed?")
//   Shape 3: Simple List    ("show me all customers")
// All other complex shapes return null -> cleanly cascade to LLM link.
// ==========================================
"use strict";

import { getDialect } from "../adapters/dialects/index.js";
import { isSubmittable, ERPNEXT_PROFILE } from "../config/profiles/erpnext.profile.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
const normVal = (s) => String(s ?? "").trim().toLowerCase();

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

const STOP = new Set([
  "how", "many", "much", "is", "are", "the", "a", "an", "of", "in", "for",
  "to", "and", "what", "which", "show", "me", "give", "please", "calculate",
  "find", "get", "no", "by", "with", "from", "there", "were", "was",
  "do", "does", "did", "we", "i", "you", "our", "my", "your", "have", "has", "had", "can", "all"
]);

export function tokenize(q) {
  return String(q || "").toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
}

export function pickTable(tokens, schema, getDistinct) {
  let best = null, bestScore = 0, bestTokenCount = 0, tie = false;
  const tables = Array.isArray(schema?.tables) ? schema.tables : [];
  const fullTokens = tokens.join("");
  const aliases = ERPNEXT_PROFILE?.schemaAliases || {};

  for (const t of tables) {
    const tn = norm(t.name), cleanTn = tn.startsWith("tab") ? tn.slice(3) : tn;
    const cols = (t.columns || []).map((c) => norm(c.name));
    const distinctVals = typeof getDistinct === "function" ? getDistinct(t.name) || [] : [];
    const matchedTokens = new Set();
    let s = 0;

    if (tn === fullTokens || cleanTn === fullTokens || cleanTn + "s" === fullTokens || fullTokens + "s" === cleanTn) {
      tokens.forEach((tok) => matchedTokens.add(tok));
      s += 15;
    }
    for (const tok of tokens) {
      const aliasTarget = aliases[tok];
      if (aliasTarget && (norm(aliasTarget) === tn || norm(aliasTarget) === cleanTn)) {
        matchedTokens.add(tok);
        s += 12;
      }
      if (tn === tok || cleanTn === tok || cleanTn + "s" === tok || tok + "s" === cleanTn) {
        matchedTokens.add(tok);
        s += 3;
      } else if (tn.includes(tok) || tok.includes(tn) || cleanTn.includes(tok) || tok.includes(cleanTn) ||
        (tn.length > 4 && tok.length > 4 && editDistance(tn, tok) <= 2) ||
        (cleanTn.length > 4 && tok.length > 4 && editDistance(cleanTn, tok) <= 2)) {
        matchedTokens.add(tok);
        s += 2;
      }
      if (cols.some((c) => c.includes(tok) || tok.includes(c) || editDistance(norm(c), tok) <= 2)) {
        matchedTokens.add(tok);
        s += 1;
      }
      if (distinctVals.some((v) => normVal(v.value) === tok)) {
        matchedTokens.add(tok);
        s += 2;
      }
    }

    const tokenCount = matchedTokens.size;
    if (s > bestScore || (s === bestScore && tokenCount > bestTokenCount)) {
      bestScore = s; bestTokenCount = tokenCount; best = t; tie = false;
    } else if (s === bestScore && tokenCount === bestTokenCount && s > 0) {
      tie = true;
    }
  }
  return !best || bestScore < 2 || tie ? null : best;
}

export function compile(act, table, filters = [], dialect = "sqlite") {
  const d = getDialect(dialect);
  const quote = d ? d.quote : (x) => `"${x}"`;
  const qt = quote(table.name);

  if (act.type === "count") {
    if (filters.length > 0) {
      const wsql = " WHERE " + filters.map((f) => `${quote(f.column)} = ?`).join(" AND ");
      return { sql: `SELECT COUNT(*) AS result FROM ${qt}${wsql}`, params: filters.map((f) => f.value) };
    }
    return { sql: `SELECT COUNT(*) AS result FROM ${qt}`, params: [] };
  }
  if (act.type === "list") {
    if (filters.length === 0) return { sql: `SELECT * FROM ${qt} LIMIT 50`, params: [] };
    return null;
  }
  return null;
}

export function tryRoute(question, deps, dialect = "sqlite") {
  if (!question || !deps || typeof deps.getSchema !== "function") return null;
  const rawSchema = deps.getSchema();
  if (!rawSchema) return null;
  let schema = rawSchema;
  if (!Array.isArray(schema.tables)) {
    schema = { tables: Object.entries(rawSchema).map(([name, data]) => ({ name, columns: data.columns || [] })) };
  }
  if (!schema.tables || !schema.tables.length) return null;

  const q = String(question).trim();
  if (/\b(top|bottom|highest|lowest|max|min|average|avg|mean|total|sum|group|per|each|every|percentage|percent|ratio|trend|chart|graph|report|compare|between|more than|greater than|less than|above|below|over|under|draft|cancell?ed)\b/i.test(q)) {
    return null;
  }

  const isCount = /\b(how many|count|number of)\b/i.test(q);
  const isList = /\b(show|list|display)\b/i.test(q);
  if (!isCount && !isList) return null;

  const tokens = tokenize(q);
  const table = pickTable(tokens, schema, deps.getDistinct);
  if (!table) return null;

  const activeDialect = (dialect || deps.dialect || deps.source?.dialect || "sqlite").toLowerCase();

  // Shape 3: Simple List (pure list, no filters)
  if (isList) {
    const out = compile({ type: "list" }, table, [], activeDialect);
    return out ? { ...out, shape: "list", table: table.name, orderCol: null, aggCol: null } : null;
  }

  // Count branch: Shape 1 (pure count) or Shape 2 (filtered count via distinct cache)
  if (isCount) {
    const distinctVals = typeof deps.getDistinct === "function" ? deps.getDistinct(table.name) || [] : [];
    let matchedFilter = null;

    for (const tok of tokens) {
      const matches = distinctVals.filter((v) => v && v.column && normVal(v.value) === tok);
      if (matches.length > 1) return null;
      if (matches.length === 1) {
        if (matchedFilter) return null;
        const hit = matches[0];
        const colExists = (table.columns || []).some((c) => norm(c.name) === norm(hit.column));
        if (!colExists) return null;
        matchedFilter = { column: hit.column, value: hit.value };
      }
    }

    const filters = matchedFilter ? [matchedFilter] : [];
    if (isSubmittable(table.name) && (table.columns || []).some((c) => c.name === "docstatus") && !filters.some((f) => f.column === "docstatus")) {
      filters.push({ column: "docstatus", value: 1 });
    }

    const out = compile({ type: "count" }, table, filters, activeDialect);
    return out ? { ...out, shape: "count", table: table.name, orderCol: null, aggCol: null } : null;
  }

  return null;
}
