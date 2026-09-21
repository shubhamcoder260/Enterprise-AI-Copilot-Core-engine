// ==========================================
// FAST INTENT ROUTER — Deterministic NL → Parameterized SQL Router
// Returns { sql, params, shape, table } or null.
//
// Invariants (§2 of Part 1 Build Plan):
//   • NEVER executes SQL — only builds plans for query.executor.js
//   • Parameterized values only (? placeholders)
//   • Returns null on any doubt (soft-cascade preserved)
//   • Evaluated through sql.validator.js before execution
// ==========================================

"use strict";

import { checkGroupByRequired } from "./guard-markers.js";
import { SEMANTIC_PROFILE } from "../config/semantic.profile.js";

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

// Typo tolerance: "attendence" → "attendance", "absent percentage" → "absent_percentage". distance <= 2
export function bestColumn(phrase, cols) {
  const t = norm(phrase);
  for (const c of cols) {
    if (norm(c) === t) return c;
  }
  for (const c of cols) {
    if (norm(c).includes(t) || t.includes(norm(c))) return c;
  }
  let best = null;
  let bd = 3;
  for (const c of cols) {
    const dd = editDistance(norm(c), t);
    if (dd < bd) {
      bd = dd;
      best = c;
    }
  }
  return bd <= 2 ? best : null;
}

const STOP = new Set([
  "how", "many", "much", "is", "are", "the", "a", "an", "of", "in", "for",
  "to", "and", "what", "which", "show", "me", "give", "please", "calculate",
  "find", "get", "no", "by", "with", "from", "there", "were", "was"
]);

export function tokenize(q) {
  return String(q || "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
}

export function pickTable(tokens, schema, getDistinct) {
  let best = null;
  let bestScore = 0;
  let bestTokenCount = 0;
  let tie = false;

  const tables = Array.isArray(schema?.tables) ? schema.tables : [];

  for (const t of tables) {
    const tn = norm(t.name);
    const cols = (t.columns || []).map((c) => norm(c.name));
    const distinctVals = typeof getDistinct === "function" ? getDistinct(t.name) || [] : [];

    const matchedTokens = new Set();
    let s = 0;

    for (const tok of tokens) {
      if (tn === tok) {
        matchedTokens.add(tok);
        s += 3;
      } else if (
        tn.includes(tok) ||
        tok.includes(tn) ||
        (tn.length > 4 && tok.length > 4 && editDistance(tn, tok) <= 2)
      ) {
        matchedTokens.add(tok);
        s += 2;
      }
    }

    for (const tok of tokens) {
      if (
        cols.some(
          (c) =>
            c.includes(tok) ||
            tok.includes(c) ||
            editDistance(norm(c), tok) <= 2 ||
            (c.includes("attendance") && tok.includes("attend"))
        )
      ) {
        matchedTokens.add(tok);
        s += 1;
      }
    }

    for (const tok of tokens) {
      if (distinctVals.some((v) => normVal(v.value) === tok)) {
        matchedTokens.add(tok);
        s += 2;
      }
    }

    const tokenCount = matchedTokens.size;

    if (s > bestScore || (s === bestScore && tokenCount > bestTokenCount)) {
      bestScore = s;
      bestTokenCount = tokenCount;
      best = t;
      tie = false;
    } else if (s === bestScore && tokenCount === bestTokenCount && s > 0) {
      tie = true;
    }
  }

  return !best || bestScore < 2 || tie ? null : best;
}

export function detectAction(q) {
  const queryStr = String(q || "").toLowerCase();

  const isBottom = /\b(bottom|lowest|min(?:imum)?)\b/i.test(queryStr);
  const isTop = /\b(top|highest|max(?:imum)?)\b/i.test(queryStr);

  if (/\b(average|avg|mean)\b/i.test(queryStr)) return { type: "aggregate", fn: "AVG" };
  if (/\b(total|sum)\b/i.test(queryStr)) return { type: "aggregate", fn: "SUM" };

  if (/\bwhat\s+percentage\s+of\b/i.test(queryStr) || /\b(?:percentage|proportion|fraction)\s+of\b/i.test(queryStr)) {
    return { type: "percentage" };
  }

  const topM = queryStr.match(/\b(top|highest|max(?:imum)?)\s*(\d+)?/i);
  const botM = queryStr.match(/\b(bottom|lowest|min(?:imum)?)\s*(\d+)?/i);

  // If query contains both "lowest" and "top 5" (e.g. "lowest attendance top 5"), prioritize lowest direction
  if (isBottom) {
    const limit = botM && botM[2] ? +botM[2] : (topM && topM[2] ? +topM[2] : 5);
    return { type: "bottomN", limit };
  }
  if (isTop) {
    const limit = topM && topM[2] ? +topM[2] : 5;
    return { type: "topN", limit };
  }

  if (/\b(how many|count|number of)\b/i.test(queryStr)) return { type: "count" };
  if (/\b(show|list|find|get|display)\b/i.test(queryStr)) return { type: "list" };

  return null; // follow-ups, joins, unknown → LLM escalation
}

// "student id = 80" | "student id 80" | "id 80" → { column, op:"=", value }
// "more than|above|over|greater than N" → { op:">" } ; "at least N" → { op:">=" }
export function extractFilters(q, table, getDistinct) {
  const filters = [];
  const queryStr = String(q || "");

  // 1. ID Filter
  let idPrefix = null;
  let idValue = null;

  const m1 = queryStr.match(/\b([a-zA-Z0-9]+)[_\s]id\s*(?:=|is|equals)?\s*(\d+)/i);
  if (m1 && !STOP.has(m1[1].toLowerCase())) {
    idPrefix = m1[1];
    idValue = +m1[2];
  } else {
    const m2 = queryStr.match(/\bid\s*(?:=|is|equals)?\s*(\d+)/i);
    if (m2) {
      idValue = +m2[1];
    }
  }

  if (idValue !== null) {
    const wanted = idPrefix ? `${norm(idPrefix)}_id` : null;
    let col = null;
    if (wanted && table.columns.some((c) => norm(c.name) === wanted)) {
      col = table.columns.find((c) => norm(c.name) === wanted).name;
    } else {
      // Look for table_name_id first, then id, then any _id
      const tableIdName = `${norm(table.name)}_id`;
      const tableIdCol = table.columns.find((c) => norm(c.name) === tableIdName);
      if (tableIdCol) {
        col = tableIdCol.name;
      } else {
        const pkCol = table.columns.find((c) => /^id$/.test(norm(c.name)));
        if (pkCol) {
          col = pkCol.name;
        } else {
          const anyIdCol = table.columns.find((c) => norm(c.name).endsWith("_id"));
          if (anyIdCol) col = anyIdCol.name;
        }
      }
    }
    if (!col) return null;
    filters.push({ column: col, op: "=", value: idValue });
  }

  // 2. Numeric Threshold Filter
  const thM = queryStr.match(
    /\b(?:more than|greater than|above|over|exceeding)\s+(\d+)/i
  );
  if (thM) {
    const col = table.columns.find(
      (c) =>
        /absent|miss|late|fail|due|attendance|score|mark|percentage|pct/.test(norm(c.name)) &&
        /int|real|num|float|double/i.test(c.type)
    );
    if (!col) return null;
    filters.push({ column: col.name, op: ">", value: +thM[1] });
  }

  // 3. Value-match: "present"/"absent"/any token equal to a cached distinct TEXT value
  const distinctVals =
    typeof getDistinct === "function" ? getDistinct(table.name) || [] : [];
  const tokens = tokenize(queryStr);
  const matchedDistinctTokens = new Set();

  for (const tok of tokens) {
    // Note M1: Keep normVal to prevent collision degradation. Cross-column duplicates are caught by ambiguity decline.
    const matches = distinctVals.filter(
      (v) => v && v.column && normVal(v.value) === tok
    );
    // b2(b) Ambiguity-decline: if a token matches more than one distinct value, decline rather than guessing
    if (matches.length > 1) {
      return null;
    }
    if (matches.length === 1) {
      const hit = matches[0];
      matchedDistinctTokens.add(tok);
      // Conflict check: if filter on this column already exists with different value, decline
      const existing = filters.find((f) => f.column === hit.column);
      if (existing) {
        if (existing.value !== hit.value) {
          return null;
        }
      } else {
        filters.push({ column: hit.column, op: "=", value: hit.value });
      }
    }
  }

  // b2(a) Bind-or-decline: every token that matched a distinct value must be bound in filters
  for (const tok of matchedDistinctTokens) {
    const isBound = filters.some((f) => normVal(f.value) === tok);
    if (!isBound) {
      return null;
    }
  }

  return filters;
}

export function compile(act, table, filters) {
  const where = filters.length ? filters : [];
  const wsql = where.length
    ? " WHERE " + where.map((f) => `"${f.column}" ${f.op} ?`).join(" AND ")
    : "";
  const params = where.map((f) => f.value);
  const qt = `"${table.name}"`;

  if (act.type === "percentage") {
    if (!filters.length) return null; // Unmatchable filter -> return null (cascade), never guess
    return {
      sql: `SELECT ROUND((SELECT COUNT(*) FROM ${qt}${wsql}) * 100.0 / COUNT(*), 2) AS result FROM ${qt}`,
      params
    };
  }
  if (act.type === "count") {
    return { sql: `SELECT COUNT(*) AS result FROM ${qt}${wsql}`, params };
  }
  if (act.type === "list") {
    return { sql: `SELECT * FROM ${qt}${wsql} LIMIT 50`, params };
  }
  if (act.type === "topN" || act.type === "bottomN") {
    const col = act.orderCol;
    if (!col) return null;
    return {
      sql: `SELECT * FROM ${qt}${wsql} ORDER BY "${col}" ${
        act.type === "topN" ? "DESC" : "ASC"
      } LIMIT ?`,
      params: [...params, act.limit]
    };
  }
  if (act.type === "aggregate") {
    if (act.derivedExpr) {
      return {
        sql: `SELECT ${act.derivedExpr} AS result FROM ${qt}${wsql}`,
        params
      };
    }
    const col = act.aggCol;
    if (!col) return null;
    return {
      sql: `SELECT ${act.fn}("${col}") AS result FROM ${qt}${wsql}`,
      params
    };
  }
  return null;
}

// SEMANTIC GUARDS — polarity and granularity. Wrong-but-confident is worse than null.
export function resolveOrderedCol(q, table) {
  const queryStr = String(q || "").toLowerCase();
  const wantAbsent = /\b(absent\w*|absence|miss\w*)\b/i.test(queryStr);
  const wantPresent = /\b(present\w*|attend\w*)\b/i.test(queryStr);
  const numCols = (table.columns || []).filter((c) =>
    /int|real|num|float|double/i.test(c.type)
  );

  let cand = null;
  if (wantPresent) {
    cand = numCols.find((c) => /present|attend/.test(norm(c.name)));
  } else if (wantAbsent) {
    cand = numCols.find((c) => /absent|miss/.test(norm(c.name)));
  } else {
    // Check if query mentioned any specific column
    const mentioned = bestColumn(q, numCols.map((c) => c.name));
    cand = mentioned ? numCols.find((c) => c.name === mentioned) : numCols[0];
  }

  return cand ? cand.name : null;
}

/**
 * Main deterministic intent router.
 *
 * @param {string} question - Natural language user question
 * @param {object} deps - Injected dependencies: { getSchema, getDistinct, isLongFormat }
 * @returns {object|null} - { sql, params, shape, table } or null
 */
export function tryRoute(question, deps) {
  if (!question || !deps || typeof deps.getSchema !== "function") return null;

  const rawSchema = deps.getSchema();
  if (!rawSchema) return null;

  // Adapt schema if it's in CogniCore map format { [tableName]: { columns: [...] } }
  let schema = rawSchema;
  if (!Array.isArray(schema.tables)) {
    schema = {
      tables: Object.entries(rawSchema).map(([name, data]) => ({
        name,
        columns: data.columns || []
      }))
    };
  }

  if (!schema.tables || !schema.tables.length) return null;

  let table = pickTable(tokenize(question), schema, deps.getDistinct);
  if (!table) return null;

  // b1 Guard: Reject grouping/count-by markers that require GROUP BY aggregation
  const gbCheck = checkGroupByRequired(question, table);
  if (gbCheck.requiresGroupBy) {
    return null;
  }

  let act = detectAction(question);
  let filters = extractFilters(question, table, deps.getDistinct);
  if (filters === null) return null;

  if (!act) {
    if (filters.length > 0) {
      act = { type: "list" };
    } else {
      return null;
    }
  }

  // GUARD A: aggregation grouped "per/by/each" → needs GROUP BY → not in Part 1
  if (act.type === "aggregate" && /\b(per|each|every|group)\b/i.test(question)) {
    return null;
  }

  // GUARD B: long-format table (rows per date) → topN/bottomN/avg would mislead
  if (
    (act.type === "topN" || act.type === "bottomN" || act.type === "aggregate") &&
    typeof deps.isLongFormat === "function" &&
    deps.isLongFormat(table.name)
  ) {
    // Check if a related short-format table exists with an attendance-like numeric column
    const altTable =
      schema.tables.find(
        (t) =>
          !deps.isLongFormat(t.name) &&
          t.columns.some(
            (c) =>
              /attend|present/i.test(c.name) &&
              /percentage|pct|rate|score|count/i.test(c.name) &&
              /int|real|num|float|double/i.test(c.type)
          )
      ) ||
      schema.tables.find(
        (t) =>
          !deps.isLongFormat(t.name) &&
          t.columns.some(
            (c) =>
              /attend|present|absent/i.test(c.name) &&
              /int|real|num|float|double/i.test(c.type)
          )
      );
    if (altTable) {
      table = altTable;
      filters = extractFilters(question, table, deps.getDistinct);
      if (filters === null) return null;
    } else {
      return null;
    }
  }

  // NUMERIC COVERAGE GUARD: every number in the question must be consumed. Else refuse.
  const asked = (question.match(/\d+/g) || []).map(Number);
  const limitM = question.match(/\b(?:top|bottom|highest|lowest)\s*(\d+)/i);
  const used = filters
    .map((f) => f.value)
    .concat(limitM ? [+limitM[1]] : [])
    .filter((n) => asked.includes(n)); // ignore bare LIMIT defaults

  if (!asked.every((n) => used.includes(n))) {
    return null;
  }

  if (act.type === "topN" || act.type === "bottomN") {
    act.orderCol = resolveOrderedCol(question, table);
    if (!act.orderCol) return null;
  }

  if (act.type === "aggregate") {
    // Resolve aggregate column with polarity and context awareness
    const queryStr = String(question).toLowerCase();
    const wantAbsent = /\b(absent|absence|miss)\b/i.test(queryStr);
    const numCols = (table.columns || []).filter((c) =>
      /int|real|num|float|double/i.test(c.type)
    );

    if (wantAbsent) {
      const absentCol = numCols.find((c) => /absent|miss/.test(norm(c.name)));
      if (absentCol) {
        act.aggCol = absentCol.name;
      } else {
        let derived = false;
        for (const rule of SEMANTIC_PROFILE.derivations) {
          const rateWord = rule.requiresRateWord && rule.requiresRateWord.test(question);
          const vetoed = rule.veto && rule.veto.test(question);
          if (rateWord && !vetoed) {
            const baseCol =
              numCols.find((c) => rule.base.test(c.name) && rule.baseRate && rule.baseRate.test(c.name)) ||
              numCols.find((c) => rule.base.test(c.name));
            if (baseCol) {
              act.derivedExpr = rule.expr(baseCol.name);
              derived = true;
              break;
            }
          }
        }
        if (!derived) {
          return null;
        }
      }
    } else {
      const col = table.columns.find(
        (c) =>
          /absent|miss|late|fail|due|fee|salary|mark|score|percentage|percent|pct|attendance|budget/.test(
            norm(c.name)
          ) && /int|real|num|float|double/i.test(c.type)
      );
      if (!col) return null;
      act.aggCol = col.name;
    }
  }

  const out = compile(act, table, filters);
  return out
    ? {
        ...out,
        shape: act.type,
        table: table.name,
        orderCol: act.orderCol || null,
        aggCol: act.aggCol || (act.derivedExpr ? "derived_aggregate" : null)
      }
    : null;
}
