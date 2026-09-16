// ============================================================
// REALMS RUNNER — one command benchmark across realms/databases.
// Reads test/suites/<realm>.json · switches DBs via env override ·
// POSTs each question to the live engine · validates via the judge ·
// reports per-stage × per-DB scores · harvests specimens.
//
// Usage:
//   1. start server: COGNICORE_ACTIVE_DB=<db> node src/server.js
//      (the runner tells you which DB each question needs and skips
//       questions whose DB doesn't match the boot — multi-DB sweeps
//       restart the server externally per DB for now)
//   2. node test/runRealms.js test/suites/hospital.json
// ============================================================
import { readFileSync } from "fs";
import { validate } from "./lib/validator.js";

const BASE = "http://localhost:5000";
const suitePath = process.argv[2];
if (!suitePath) {
  console.error("Usage: node test/runRealms.js <suite.json>");
  process.exit(1);
}

const suite = JSON.parse(readFileSync(suitePath, "utf8"));
console.log(`\n═══ REALMS RUNNER — realm: ${suite.realm} · ${suite.questions.length} questions ═══\n`);

// group by db so a single server boot handles one db's full set
const byDb = {};
for (const q of suite.questions) {
  (byDb[q.db] ||= []).push(q);
}

async function ask(question, sessionId) {
  console.log(`🔎 ASK: "${String(question).slice(0,60)}"`);
  const start = Date.now();
  const res = await fetch(`${BASE}/api/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: question, sessionId, organization: "college" }),
  });
  const rawText = await res.text();
  console.log(`🔎 RAW (status ${res.status}):`, rawText.slice(0,150));
  const response = JSON.parse(rawText);
  return { response, ms: Date.now() - start };
}

const results = [];
let specimenCount = 0;

for (const [db, questions] of Object.entries(byDb)) {
  console.log(`\n━━━ DATABASE: ${db} — ${questions.length} questions ━━━`);

  // verify the server is actually on this db before running (H2: boot-proof!)
  const active = await (await fetch(`${BASE}/api/database/active`)).json();
  const activeStr = JSON.stringify(active);
  if (!activeStr.includes(db)) {
    console.log(`⏭️  SKIPPED — server is on a different DB (${activeStr.slice(0, 80)}...).`);
    console.log(`   Restart with: COGNICORE_ACTIVE_DB=$PWD/fixtures/realms/${suite.realm}/${db} node src/server.js`);
    for (const q of questions) results.push({ ...q, db, skipped: true });
    continue;
  }

  for (const q of questions) {
    const session = `${suite.realm}-${q.id}`;
    try {
      const { response, ms } = await ask(q.text, session);
      const result = validate(response, q.validate);
      results.push({ ...q, db, ms, pass: result.pass, reason: result.reason, source: result.source, sql: result.sql });

      const icon = result.pass ? "✅" : "🚨";
      console.log(`${icon} [${q.id}] (${q.stage}, ${ms}ms, ${result.source}) ${result.reason}`);
      if (!result.pass && q.stage === "S4") specimenCount++;
      if (!result.pass && q.stage !== "S4") specimenCount++;
    } catch (e) {
      results.push({ ...q, db, ms: 0, pass: false, reason: `EXCEPTION: ${e.message}` });
      console.log(`💥 [${q.id}] EXCEPTION: ${e.message}`);
      specimenCount++;
    }
  }
}

// ── report ──
console.log(`\n═══════════ REPORT — realm: ${suite.realm} ═══════════`);
const ran = results.filter(r => !r.skipped);
const stages = {};
for (const r of ran) {
  stages[r.stage] ||= { pass: 0, total: 0 };
  stages[r.stage].total++;
  if (r.pass) stages[r.stage].pass++;
}
for (const [stage, s] of Object.entries(stages)) {
  const pct = Math.round((s.pass / s.total) * 100);
  console.log(`${stage}: ${s.pass}/${s.total} (${pct}%)`);
}
const totalPass = ran.filter(r => r.pass).length;
const skipped = results.length - ran.length;
console.log(`TOTAL: ${totalPass}/${ran.length} passed (${skipped} skipped for DB mismatch)`);
console.log(`Specimens harvested: ${specimenCount} (failures auto-logged above)`);

const byDbScore = {};
for (const r of ran) {
  byDbScore[r.db] ||= { pass: 0, total: 0 };
  byDbScore[r.db].total++;
  if (r.pass) byDbScore[r.db].pass++;
}
for (const [db, s] of Object.entries(byDbScore)) {
  console.log(`${db}: ${s.pass}/${s.total} (${Math.round((s.pass / s.total) * 100)}%)`);
}
console.log("\nSILENT-WRONG watch: S4 traps and swf expectations above — any 🚨 on a");
console.log("trap question = a specimen for the golden set.");
