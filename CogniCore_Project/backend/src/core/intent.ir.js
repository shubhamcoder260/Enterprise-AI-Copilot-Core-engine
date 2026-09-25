// ============================================================================
// INTENT-IR LIGHT — Normalized Semantic Intermediate Representation (CAP v2.2 §272)
//
// Extracts structured intent:
//   {
//     entities: string[],         // Matched table names
//     primaryTable: string|null,  // Best table candidate
//     metric: string|null,        // COUNT, SUM, AVG, MIN, MAX, LIST, PERCENTAGE
//     targetColumn: string|null,  // Bound column for metric or ordering
//     filters: object[],          // [{ column, op, value, type }]
//     grain: object|null,         // { type: "temporal"|"categorical", unit, count, column }
//     visual: object|null,        // { requested: boolean, type: "chart"|"graph"|"bar"|"line" }
//     confidence: string,         // "HIGH" | "MEDIUM" | "AMBIGUOUS" | "UNRESOLVABLE"
//     clarificationPrompt: string|null, // Emitted when AMBIGUOUS
//     refusalReason: string|null        // Emitted when UNRESOLVABLE
//   }
//
// Confidence Ladder:
//   - HIGH: Exact/unambiguous match of entity, target column, filters, grain.
//   - MEDIUM: Single viable match with standard defaults (e.g. canonical date column).
//   - AMBIGUOUS: Multiple plausible interpretations requiring user clarification.
//   - UNRESOLVABLE: Ungrounded entities, unresolvable joins, or unknown columns.
// ============================================================================

"use strict";

const STOP_WORDS = new Set([
  "how", "many", "much", "is", "are", "the", "a", "an", "of", "in", "for",
  "to", "and", "or", "what", "which", "show", "me", "give", "please", "calculate",
  "find", "get", "no", "by", "with", "from", "there", "were", "was", "our",
  "as", "at", "all"
]);

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
const normVal = (s) => String(s ?? "").trim().toLowerCase();

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return d[m][n];
}

export function tokenize(q) {
  return String(q || "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

function normalizeSchema(rawSchema) {
  if (!rawSchema) return [];
  if (Array.isArray(rawSchema.tables)) return rawSchema.tables;
  return Object.entries(rawSchema).map(([name, data]) => ({
    name,
    columns: data.columns || []
  }));
}

/**
 * Detect visualization request in query
 */
export function detectVisualization(q) {
  const queryStr = String(q || "").toLowerCase();
  const hasGraph = /\b(graph|chart|plot|visualiz\w*|trend)\b/i.test(queryStr);
  if (!hasGraph) return null;

  let type = "chart";
  if (/\bbar\b/i.test(queryStr)) type = "bar";
  else if (/\bline|trend\b/i.test(queryStr)) type = "line";
  else if (/\bpie\b/i.test(queryStr)) type = "pie";

  return { requested: true, type };
}

/**
 * Detect temporal or categorical grain
 */
export function detectGrain(q, table) {
  const queryStr = String(q || "").toLowerCase();

  // Temporal grain: "last N years", "past N months", "in YYYY", "yearly", "monthly"
  const lastNYears = queryStr.match(/\b(?:last|past)\s+(\d+)\s+years?\b/i);
  if (lastNYears) {
    return { type: "temporal", unit: "year", count: +lastNYears[1] };
  }

  const lastNMonths = queryStr.match(/\b(?:last|past)\s+(\d+)\s+months?\b/i);
  if (lastNMonths) {
    return { type: "temporal", unit: "month", count: +lastNMonths[1] };
  }

  const inYear = queryStr.match(/\b(?:in|for|during)\s+(20\d\d|19\d\d)\b/i);
  if (inYear) {
    return { type: "temporal", unit: "year", count: 1, exactValue: inYear[1] };
  }

  if (/\b(?:yearly|annually|per year|by year)\b/i.test(queryStr)) {
    return { type: "temporal", unit: "year", count: null };
  }

  if (/\b(?:monthly|per month|by month)\b/i.test(queryStr)) {
    return { type: "temporal", unit: "month", count: null };
  }

  // Categorical grain: "per department", "by section", "grouped by X"
  const perM = queryStr.match(/\b(?:per|by|each)\s+([a-zA-Z0-9_]+)\b/i);
  if (perM && !STOP_WORDS.has(perM[1].toLowerCase()) && !/year|month|day/i.test(perM[1])) {
    const rawDimension = perM[1];
    let matchedCol = null;
    if (table && table.columns) {
      matchedCol = table.columns.find((c) => norm(c.name).includes(norm(rawDimension)));
    }
    return {
      type: "categorical",
      dimension: rawDimension,
      column: matchedCol ? matchedCol.name : null
    };
  }

  return null;
}

/**
 * Score and resolve table candidates from schema
 */
export function resolveEntityCandidates(tokens, tables, getDistinct) {
  const scored = [];

  for (const t of tables) {
    const tn = norm(t.name);
    // Strip tab prefix for ERPNext tables in matching
    const cleanTn = tn.startsWith("tab") ? tn.slice(3) : tn;
    const cols = (t.columns || []).map((c) => norm(c.name));
    const distinctVals = typeof getDistinct === "function" ? getDistinct(t.name) || [] : [];

    let score = 0;
    const matchedTokens = new Set();

    for (const tok of tokens) {
      if (cleanTn === tok || tn === tok) {
        matchedTokens.add(tok);
        score += 4;
      } else if (cleanTn.includes(tok) || tok.includes(cleanTn) || editDistance(cleanTn, tok) <= 2) {
        matchedTokens.add(tok);
        score += 2;
      }
    }

    for (const tok of tokens) {
      if (cols.some((c) => c === tok)) {
        matchedTokens.add(tok);
        score += 2;
      } else if (cols.some((c) => c.includes(tok) || tok.includes(c) || editDistance(c, tok) <= 2)) {
        matchedTokens.add(tok);
        score += 1;
      }
    }

    for (const tok of tokens) {
      if (distinctVals.some((v) => normVal(v.value) === tok)) {
        matchedTokens.add(tok);
        score += 2;
      }
    }

    if (score >= 2) {
      scored.push({ table: t, score, matchedTokens: Array.from(matchedTokens) });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Detect Metric / Action
 */
export function detectMetric(queryStr) {
  const q = String(queryStr || "").toLowerCase();

  if (/\b(total|sum)\b/i.test(q)) return "SUM";
  if (/\b(average|avg|mean)\b/i.test(q)) return "AVG";
  if (/\b(how many|count|number of)\b/i.test(q)) return "COUNT";
  if (/\bwhat\s+percentage\s+of\b/i.test(q) || /\b(?:percentage|proportion|fraction)\s+of\b/i.test(q)) return "PERCENTAGE";
  if (/\b(top|highest|max(?:imum)?)\b/i.test(q)) return "MAX";
  if (/\b(bottom|lowest|min(?:imum)?)\b/i.test(q)) return "MIN";
  if (/\b(show|list|find|get|display)\b/i.test(q)) return "LIST";

  return null;
}

/**
 * Parse natural language query into Intent-IR Light
 *
 * @param {string} query
 * @param {object} context - { schema, getDistinct, dialect }
 * @returns {object} Intent-IR
 */
export function parseIntentIR(query, context = {}) {
  const queryStr = String(query || "").trim();
  const tables = normalizeSchema(context.schema);
  const tokens = tokenize(queryStr);
  const visual = detectVisualization(queryStr);

  const ir = {
    entities: [],
    primaryTable: null,
    metric: detectMetric(queryStr),
    targetColumn: null,
    filters: [],
    grain: null,
    visual,
    confidence: null,
    clarificationPrompt: null,
    refusalReason: null
  };

  if (!queryStr || tables.length === 0) {
    ir.confidence = "UNRESOLVABLE";
    ir.refusalReason = "Empty query or empty database schema.";
    return ir;
  }

  // 1. Resolve Tables
  const scoredTables = resolveEntityCandidates(tokens, tables, context.getDistinct);

  if (scoredTables.length === 0) {
    ir.confidence = "UNRESOLVABLE";
    ir.refusalReason = `No database table matches the concepts in query: "${queryStr}"`;
    return ir;
  }

  // Check for ambiguous table match
  if (scoredTables.length > 1 && scoredTables[0].score === scoredTables[1].score) {
    ir.confidence = "AMBIGUOUS";
    ir.entities = [scoredTables[0].table.name, scoredTables[1].table.name];
    ir.clarificationPrompt = `Your question could refer to either '${scoredTables[0].table.name}' or '${scoredTables[1].table.name}'. Which one did you mean?`;
    return ir;
  }

  const primary = scoredTables[0].table;
  ir.primaryTable = primary.name;
  ir.entities = [primary.name];

  // 2. Grain Detection
  ir.grain = detectGrain(queryStr, primary);

  // 3. Resolve Target Column for Metric
  const numCols = (primary.columns || []).filter((c) =>
    /int|real|num|float|double|decimal|currency/i.test(c.type) ||
    /total|amount|rate|percentage|pct|salary|budget|score|count|days/i.test(c.name)
  );

  const dateCols = (primary.columns || []).filter((c) =>
    /date|time|timestamp|datetime/i.test(c.type) ||
    /date|time|period|year|posting_date|due_date|creation/i.test(c.name)
  );

  if (ir.metric === "SUM" || ir.metric === "AVG" || ir.metric === "MAX" || ir.metric === "MIN") {
    // Check if query specifically mentions a column
    const tokenCols = numCols.filter((col) => {
      const cn = norm(col.name);
      return tokens.some((t) => cn.includes(t) || t.includes(cn));
    });

    if (tokenCols.length === 1) {
      ir.targetColumn = tokenCols[0].name;
    } else if (tokenCols.length > 1) {
      // Prioritize canonical totals (e.g. grand_total over net_total)
      const preferred = tokenCols.find((c) => /grand_total|total_amount|total$/i.test(c.name));
      if (preferred) {
        ir.targetColumn = preferred.name;
      } else {
        // Multiple candidate metric columns without clear priority
        ir.confidence = "AMBIGUOUS";
        ir.clarificationPrompt = `Multiple columns match your request: ${tokenCols.map((c) => c.name).join(", ")}. Which metric should be aggregated?`;
        return ir;
      }
    } else if (numCols.length === 1) {
      ir.targetColumn = numCols[0].name;
    } else if (numCols.length > 1) {
      // Priority to total/grand_total/amount for SUM, percentage/rate for AVG
      if (ir.metric === "SUM") {
        const totalCol = numCols.find((c) => /grand_total|total_amount|total|net_total/i.test(c.name));
        if (totalCol) ir.targetColumn = totalCol.name;
      } else if (ir.metric === "AVG") {
        const rateCol = numCols.find((c) => /percentage|rate|score/i.test(c.name));
        if (rateCol) ir.targetColumn = rateCol.name;
      }
    }
  }

  // 4. Temporal Grain Date Column Resolution
  if (ir.grain && ir.grain.type === "temporal") {
    if (dateCols.length === 0) {
      ir.confidence = "UNRESOLVABLE";
      ir.refusalReason = `Table '${primary.name}' does not contain any date or timestamp column to satisfy temporal grain '${ir.grain.unit}'.`;
      return ir;
    } else if (dateCols.length === 1) {
      ir.grain.column = dateCols[0].name;
    } else {
      // Multiple date columns — check if query mentions multiple date columns or a single specific one
      const canonicalDate = dateCols.find((c) => /posting_date|transaction_date/i.test(c.name));
      const specificDateMentions = dateCols.filter((c) => {
        const cn = norm(c.name);
        return tokens.some((t) => cn.includes(t) || t.includes(cn));
      });

      if (specificDateMentions.length > 1) {
        ir.confidence = "AMBIGUOUS";
        ir.clarificationPrompt = `Table '${primary.name}' has multiple date columns (${specificDateMentions.map((c) => c.name).join(", ")}). Which date column should be used for the ${ir.grain.unit} trend?`;
        return ir;
      } else if (specificDateMentions.length === 1) {
        ir.grain.column = specificDateMentions[0].name;
      } else if (canonicalDate) {
        ir.grain.column = canonicalDate.name;
      } else {
        ir.confidence = "AMBIGUOUS";
        ir.clarificationPrompt = `Table '${primary.name}' has multiple date columns (${dateCols.map((c) => c.name).join(", ")}). Which date column should be used for the ${ir.grain.unit} trend?`;
        return ir;
      }
    }
  }

  // 5. Categorical Grain Column Resolution
  if (ir.grain && ir.grain.type === "categorical" && !ir.grain.column) {
    ir.confidence = "UNRESOLVABLE";
    ir.refusalReason = `Requested grouping dimension '${ir.grain.dimension}' does not exist in table '${primary.name}'.`;
    return ir;
  }

  // 6. Final Confidence Ladder Assignment
  if (ir.confidence === "UNRESOLVABLE" || ir.confidence === "AMBIGUOUS") {
    return ir;
  }

  if (ir.primaryTable && (ir.metric || ir.grain || ir.visual)) {
    if (ir.targetColumn && ir.grain && ir.grain.column) {
      ir.confidence = "HIGH";
    } else if (ir.metric === "COUNT" || ir.metric === "LIST" || ir.targetColumn) {
      ir.confidence = "HIGH";
    } else {
      ir.confidence = "MEDIUM";
    }
  } else {
    ir.confidence = "MEDIUM";
  }

  return ir;
}
