// ============================================================
// UNIT PROOF for the validator — the tester gets tested.
// Uses REAL response shapes observed live (2026-09-15).
// ============================================================
import { validate } from "./lib/validator.js";

let pass = 0, fail = 0;
const check = (id, expectPass, result) => {
  const ok = result.pass === expectPass;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${result.reason}`);
};

// real captured shapes:
const dyn80 = { answer: "There are 80 record(s) in the students table.", source: "dynamic",
  data: { type: "count", table: "students", value: 80, sql: 'SELECT COUNT(*) AS result FROM "students"' },
  meta: { pipelineTrace: [ { link: "Configured Tools", status: "PASS", reason: "intent_not_configured" },
                           { link: "Dynamic Query Engine", status: "ANSWERED", reason: "count" } ] } };

const fallbackAfterLLM = { answer: 'I could not find an exact answer for: "x".', source: "fallback",
  data: { error: "unresolved_query" },
  meta: { pipelineTrace: [ { link: "Configured Tools", status: "PASS", reason: "intent_not_configured" },
                           { link: "Dynamic Query Engine", status: "PASS", reason: "no table resolved" },
                           { link: "Local LLM", status: "PASS", reason: "llm_timeout" },
                           { link: "Helpful Fallback", status: "ANSWERED", reason: "schema inspection" } ] } };

const disclosedSub = { answer: "Note: this database has no 'students' table — interpreted as 'customers' (200).",
  source: "llm", data: { value: 200, sql: "SELECT COUNT(*) FROM customers" }, meta: {} };

const silentWrong = { answer: "There are 40 record(s) in the students table.", source: "dynamic",
  data: { value: 40, sql: "SELECT COUNT(*) FROM students WHERE section='A'" }, meta: {} };

// ── count ──
check("count-ok",      true,  validate(dyn80, { kind: "count", value: 80 }));
check("count-wrong",   false, validate(dyn80, { kind: "count", value: 81 }));
// ── refusal ──
check("refusal-ok",    true,  validate(fallbackAfterLLM, { kind: "refusal" }));
check("refusal-false", false, validate(dyn80, { kind: "refusal" }));
// ── trace (YOUR new kind) ──
check("trace-visited",  true,  validate(fallbackAfterLLM, { kind: "trace", visited: ["Local LLM", "Helpful Fallback"] }));
check("trace-notVisit", true,  validate(dyn80, { kind: "trace", visited: ["Dynamic Query Engine"], notVisited: ["Local LLM"] }));
check("trace-miss",     false, validate(dyn80, { kind: "trace", visited: ["Local LLM"] }));
// ── swf ──
check("swf-correct",   true,  validate(dyn80, { kind: "swf", truth: 80 }));
check("swf-refused",   true,  validate(fallbackAfterLLM, { kind: "swf", truth: 80 }));
check("swf-disclosed", true,  validate(disclosedSub, { kind: "swf", truth: 80 }));
check("swf-silent",    false, validate(silentWrong, { kind: "swf", truth: 80 }));
// ── scalar (your toNumOrNull fix path) ──
check("scalar-ok",     true,  validate({ answer: "x", source: "dynamic", data: { value: 46.9 } }, { kind: "scalar", value: 46.9, tol: 0.1 }));
check("scalar-nodata", false, validate(fallbackAfterLLM, { kind: "scalar", value: 1 }));

console.log(`\nSCORE: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
