// ============================================================
// VALIDATOR — THE single validation authority for all suites.
// Pure functions. ZERO engine imports (anti-corruption: the judge
// cannot be biased by the thing it judges).
//
// validate(response, expectation) → { pass: bool, reason: string, ...ctx }
//
// Expectation kinds (closed set):
//   count    { kind:"count", value: 200 }
//   scalar   { kind:"scalar", value: 4.66, tol: 0.01, key?: "colName" }
//   rows     { kind:"rows", count: 6, min?: 6, contains: ["Engineering"] }
//   refusal  { kind:"refusal" }                    — must refuse/clarify
//   routing  { kind:"routing", source: "tool" }    — which engine answered
//   trace    { kind:"trace", visited: ["tools","dynamic"] } — which links
//                                                    were attempted, in order
//   swf      { kind:"swf", truth: ... }  — correct OR flagged OR disclosed
//                                          OR refused. FAILS only on bare,
//                                          undisclosed wrongness.
//
// Every result carries { sql, source, answer } for failure reports.
// ============================================================

// ── real response shape (observed live, 2026-09-15, /api/ai/query) ──
// {
//   answer: "There are 80 record(s) in the students table.",
//   source: "dynamic",              // "tool" | "dynamic" | "llm" | "fallback"
//   data: {
//     type: "count", table: "students",   // present on dynamic-engine answers
//     value: 80,
//     sql: "SELECT COUNT(*) AS result FROM \"students\""
//   },
//   meta: {
//     sessionId, organization, role,
//     engineMode: "dynamic_query",
//     intent: "dynamic_query",
//     processingMs: 1,
//     pipelineTrace: [ { link: "Configured Tools", ... }, ... ]
//   }
// }
// A fallback response carries no data.value/records — instead
// data.error = "unresolved_query" and data.availableTables = [...].
// Observed live: a fallback after a full LLM cascade took processingMs
// 45069 — the honest-refusal tax (L7) is real, not theoretical, and
// this validator's job is partly to catch how often that tax is paid.

// ── numeric coercion, done carefully ──
// Number(null) === 0 and Number(undefined) === NaN — neither is nullish,
// so naive `Number(x) ?? fallback` never falls back. toNumOrNull() keeps
// "no data" distinguishable from an actual zero.
function toNumOrNull(x) {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isNaN(n) ? null : n;
}

// ── response shape accessors (tolerate source variance) ──
function getRows(response) {
  if (Array.isArray(response?.data?.records)) return response.data.records;
  if (Array.isArray(response?.data)) return response.data;
  return null;
}
function getValue(response) {
  return toNumOrNull(response?.data?.value);
}
function getSql(response) {
  return response?.data?.sql || "(no sql)";
}
function getSource(response) {
  return response?.source || "unknown";
}
function getTrace(response) {
  const t = response?.meta?.pipelineTrace;
  return Array.isArray(t) ? t.map(step => step.link || step.name || String(step)) : [];
}
function isRefusal(response) {
  if (!response) return false;
  if (response.source === "fallback") return true;
  // Forward-compatible with the CANNOT_ANSWER protocol (step 5.5): prefer
  // a structured meta flag once it exists, fall back to text matching for
  // today's engine.
  if (response?.meta?.abstained === true || response?.meta?.cannotAnswer === true) return true;
  const a = String(response.answer || "").toLowerCase();
  return a.includes("could not find") || a.includes("cannot answer") ||
         a.includes("did you mean") || a.includes("unable to determine");
}
// NEW: recognizes an answer that discloses a substitution/assumption
// instead of either refusing or staying silent about it — the third
// acceptable outcome for S6-style specimens per MASTER_CONTEXT §9.
// Prefers a structured meta flag (meta.disclosed / meta.substitution) if
// the engine ever sets one; falls back to hedge-phrase detection today.
function isDisclosed(response, extraPatterns = []) {
  if (!response) return false;
  if (response?.meta?.disclosed === true || response?.meta?.substitution) return true;
  const a = String(response.answer || "").toLowerCase();
  const patterns = [
    "note:", "however,", "closest match", "instead of", "assuming",
    "no such table", "no exact match", "interpreted as", ...extraPatterns,
  ];
  return patterns.some(p => a.includes(String(p).toLowerCase()));
}
function firstCellValue(rows, preferKey) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  if (preferKey && row[preferKey] !== undefined) return row[preferKey];
  const keys = Object.keys(row);
  return keys.length ? row[keys[0]] : null;
}
function closeEnough(a, b, tol) {
  if (typeof a !== "number" || typeof b !== "number") return false;
  return Math.abs(a - b) <= (tol ?? 0.0001);
}

// ── the judge ──
export function validate(response, exp) {
  const ctx = { sql: getSql(response), source: getSource(response), answer: response?.answer };

  try {
    switch (exp.kind) {
        // FIX: was `getValue ?? Number(firstCellValue)` — Number(null) is 0,
        // so a genuinely data-less response silently reported count=0.
        // toNumOrNull keeps "no data" as null, distinguishable from a real 0.
            case "count": {
        // toNumOrNull keeps "no data" as null, distinguishable from a real 0.
        const v = getValue(response) ?? toNumOrNull(firstCellValue(getRows(response)));
        const pass = v !== null && v === exp.value;
        // zero-result prose: LLM path expresses count-0 in prose ("No records
        // matched"). Word boundaries prevent "400 record(s)" from matching
        // "0 record" — the false-trigger bug found in the hospital run.
        const zeroProse = exp.value === 0 &&
          /\bno records\b|\b0 records?\b|\bno rows\b|\bdid not match\b/i.test(String(response?.answer || ""));
        return {
          pass: pass || zeroProse,
          reason: pass ? `count=${v}` : zeroProse ? "count=0 (prose-confirmed)" : `expected count ${exp.value}, got ${v === null ? "no data" : v}`,
          ...ctx,
        };
      }
      case "scalar": {
        // Use the row value if a row genuinely exists, else fall back to data.value.
        const raw = firstCellValue(getRows(response), exp.key);
        const v = raw !== null ? toNumOrNull(raw) : getValue(response);
        const pass = closeEnough(v, exp.value, exp.tol);
        return { pass, reason: pass ? `scalar=${v}` : `expected ≈${exp.value} (±${exp.tol ?? 0.0001}), got ${v === null ? "no data" : v}`, ...ctx };
      }
      case "rows": {
        const rows = getRows(response);
        if (!Array.isArray(rows)) return { pass: false, reason: "no rows array in response", ...ctx };
        if (exp.count !== undefined && rows.length !== exp.count)
          return { pass: false, reason: `expected ${exp.count} rows, got ${rows.length}`, ...ctx };
        if (exp.min !== undefined && rows.length < exp.min)
          return { pass: false, reason: `expected ≥${exp.min} rows, got ${rows.length}`, ...ctx };
        if (exp.contains) {
          const blob = JSON.stringify(rows).toLowerCase();
          for (const needle of exp.contains) {
            if (!blob.includes(String(needle).toLowerCase()))
              return { pass: false, reason: `rows missing "${needle}"`, ...ctx };
          }
        }
        return { pass: true, reason: `${rows.length} rows ok`, ...ctx };
      }
      case "refusal": {
        const refused = isRefusal(response);
        return { pass: refused, reason: refused ? "refused as expected" : `expected refusal, got answer: ${String(response?.answer).slice(0, 80)}`, ...ctx };
      }
      case "routing": {
        const pass = getSource(response) === exp.source;
        return { pass, reason: pass ? `routed to ${exp.source}` : `expected source=${exp.source}, got ${getSource(response)}`, ...ctx };
      }
      // NEW: assert which links were attempted, using the real
      // meta.pipelineTrace field observed in live responses. Useful for
      // confirming a cascade actually reached (or didn't reach) the LLM —
      // e.g. proving a fast-path guard declined BEFORE paying the 45s tax.
      case "trace": {
        const trace = getTrace(response);
        if (exp.visited) {
          const missing = exp.visited.filter(v => !trace.some(t => t.toLowerCase().includes(v.toLowerCase())));
          if (missing.length) return { pass: false, reason: `trace missing expected link(s): ${missing.join(", ")} — got [${trace.join(" → ")}]`, ...ctx };
        }
        if (exp.notVisited) {
          const present = exp.notVisited.filter(v => trace.some(t => t.toLowerCase().includes(v.toLowerCase())));
          if (present.length) return { pass: false, reason: `trace should NOT include ${present.join(", ")} — got [${trace.join(" → ")}]`, ...ctx };
        }
        return { pass: true, reason: `trace ok: [${trace.join(" → ")}]`, ...ctx };
      }
      case "swf": {
        // silent-wrong-free: pass if (a) answer matches truth, OR (b) flagged
        // as uncertain/abstained, OR (c) refused, OR (d) discloses the
        // substitution/assumption it made. FAIL only if bare-wrong with none
        // of the above — the actual "silent" in silent-wrong.
        const raw = firstCellValue(getRows(response));
        const v = getValue(response) ?? toNumOrNull(raw) ?? raw;
        const matchesTruth = exp.truth !== undefined &&
          (typeof exp.truth === "number" ? closeEnough(v, exp.truth, exp.tol ?? 0.01) : String(v) === String(exp.truth));
        if (matchesTruth) return { pass: true, reason: "answered correctly", ...ctx };
        const flagged = response?.meta?.confidence === "low" || response?.meta?.flagged === true;
        if (flagged) return { pass: true, reason: "answered but flagged uncertain", ...ctx };
        if (isRefusal(response)) return { pass: true, reason: "refused/clarified", ...ctx };
        if (isDisclosed(response, exp.disclosurePatterns)) return { pass: true, reason: "answered with disclosed substitution/assumption", ...ctx };
        return { pass: false, reason: `SILENT-WRONG: gave "${String(response?.answer).slice(0, 60)}" but truth is ${exp.truth ?? "not derivable"}`, ...ctx };
      }
      case "mentions": {
        // orient questions: the answer must reference real schema entities —
        // proves schema-awareness without demanding a specific engine path.
        const a = String(response?.answer || "").toLowerCase();
        const missing = (exp.anyOf || []).filter(t => !a.includes(String(t).toLowerCase()));
        const pass = missing.length < (exp.anyOf || []).length;   // ≥1 mentioned
        return { pass, reason: pass ? "mentions real schema entities" : `mentions none of: ${(exp.anyOf || []).join(", ")}`, ...ctx };
      }


      default:
        return { pass: false, reason: `unknown expectation kind: ${exp.kind}`, ...ctx };
    }
  } catch (e) {
    return { pass: false, reason: `validator exception: ${e.message}`, ...ctx };
  }
}

// ── formatting helper for reports ──
export function formatFailure(result, question) {
  return `❌ "${question}"\n   ${result.reason}\n   sql: ${result.sql}`;
}
