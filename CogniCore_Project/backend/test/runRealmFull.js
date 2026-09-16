// ============================================================
// REALM FULL-TEST ORCHESTRATOR
// One command per realm: boots EVERY database variant in sequence,
// runs that realm's suite against each, validates, aggregates.
//   node test/runRealmFull.js hospital
//   node test/runRealmFull.js all
// Handles: stale-server kills, env-override boots, boot-proofing,
// per-DB execution, per-stage scoring, realm-level verdict.
// ============================================================
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const BACKEND = path.join(__dirname, "..");
const SUITES_DIR = path.join(BACKEND, "test", "suites");
const BASE = "http://localhost:5000";
const BOOT_TIMEOUT_MS = 10000;
const QUESTION_TIMEOUT_MS = 120000;

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node test/runRealmFull.js <realm|all>");
  console.error("Realms with suites:", execSync(`ls ${SUITES_DIR}`).toString().trim().split("\n").map(f => f.replace(".json", "")).join(", "));
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function killServers() {
  try { execSync('pkill -9 -f "node src/server.js"', { stdio: "pipe" }); } catch {}
  sleep(500);
}

function bootServer(dbPath) {
  execSync(
    `COGNICORE_ACTIVE_DB=${dbPath} LOCAL_LLM_TIMEOUT_MS=45000 nohup node src/server.js > /tmp/cc-realm.log 2>&1 &`,
    { cwd: BACKEND, shell: "/bin/bash" }
  );
}

async function waitHealthy() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {}
    await sleep(300);
  }
  throw new Error("SERVER NEVER CAME UP — check /tmp/cc-realm.log");
}

async function ask(question, sessionId) {
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), QUESTION_TIMEOUT_MS);
  const res = await fetch(`${BASE}/api/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: question, sessionId, organization: "college" }),
    signal: ctrl.signal,
  });
  clearTimeout(t);
  const response = await res.json();
  return { response, ms: Date.now() - start };
}

async function runDbGroup(suite, dbFile) {
  console.log(`\n┏━━ DATABASE: ${dbFile}`);
  killServers();
  const dbPath = path.join(BACKEND, "test", "fixtures", "realms", suite.realm, dbFile);
  bootServer(dbPath);
  const healthy = await waitHealthy();

  // BOOT PROOF — the only trusted evidence:
  const bootLog = execSync("grep -E 'override active|Loaded on Boot' /tmp/cc-realm.log | tail -2").toString().trim();
  console.log(`┃ boot evidence: ${bootLog.split("\n").pop()}`);
  const active = await (await fetch(`${BASE}/api/database/active`)).json();
  const activeStr = JSON.stringify(active);
  const bootOk = activeStr.includes(dbFile);
  console.log(`┃ boot: ${bootOk ? "✅ verified" : "❌ MISMATCH"} → ${activeStr.slice(activeStr.lastIndexOf("/") + 1, -2) || activeStr.slice(0, 80)}`);
  if (!bootOk) {
    console.log(`┗━━ SKIPPED (wrong db serving)`);
    return { pass: 0, total: questionsFor(suite, dbFile).length, skipped: true };
  }

  let pass = 0, total = 0;
  const qs = questionsFor(suite, dbFile);
  for (const q of qs) {
    const session = `${suite.realm}-${q.id}`;
    let result, ms = 0, response;
    try {
      const r = await ask(q.text, session);
      response = r.response; ms = r.ms;
      result = validate(response, q.validate);
    } catch (e) {
      result = { pass: false, reason: `EXCEPTION: ${e.message}` };
    }
    total++;
    if (result.pass) pass++;
    const icon = result.pass ? "✅" : "🚨";
    console.log(`┃ ${icon} [${q.id}] (${q.stage}, ${ms}ms, ${response?.source || "?"}) ${result.reason}`);

    // specimen harvest:
    if (!result.pass) {
      specimens.push({
        realm: suite.realm, db: dbFile, id: q.id, stage: q.stage, question: q.text,
        got: String(response?.answer || result.reason).slice(0, 120),
        expected: JSON.stringify(q.validate), sql: response?.data?.sql || null,
        source: response?.source || null, ms,
      });
    }
  }
  console.log(`┗━━ ${dbFile}: ${pass}/${total}`);
  return { pass, total, skipped: false };
}

// helper: which questions belong to a db
function questionsFor(suite, dbFile) {
  return suite.questions.filter(q => q.db === dbFile);
}

// ── kernel imports AFTER path setup (validator from lib) ──
const { validate } = await import(path.join(__dirname, "lib", "validator.js"));
const specimens = [];

function dbFilesFor(suite) {
  return [...new Set(suite.questions.map(q => q.db))];
}

async function runRealm(realmName) {
  const suitePath = path.join(SUITES_DIR, `${realmName}.json`);
  let suite;
  try {
    suite = JSON.parse(readFileSync(suitePath, "utf8"));
  } catch (e) {
    console.error(`💥 cannot read suite: ${suitePath} — ${e.message}`);
    return { pass: 0, total: 0 };
  }
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║ REALM: ${realmName.toUpperCase()} — ${suite.questions.length} questions`);
  console.log(`╚══════════════════════════════════════════╝`);

  let pass = 0, total = 0;
  for (const dbFile of dbFilesFor(suite)) {
    const r = await runDbGroup(suite, dbFile);
    pass += r.pass; total += r.total;
  }

  const pct = total ? Math.round((pass / total) * 100) : 0;
  console.log(`\n╔══ REALM VERDICT: ${realmName} — ${pass}/${total} (${pct}%)`);
  return { pass, total, pct };
}

// ── MAIN ──
const realms = arg === "all"
  ? execSync(`ls ${SUITES_DIR}`).toString().trim().split("\n").map(f => f.replace(".json", ""))
  : [arg];

const grand = { pass: 0, total: 0 };
const verdicts = [];
for (const realm of realms) {
  const r = await runRealm(realm);
  verdicts.push({ realm, ...r });
  grand.pass += r.pass; grand.total += r.total;
}

console.log(`\n╔══════════════════════════════════════════════╗`);
for (const v of verdicts) {
  console.log(`║ ${v.realm.padEnd(16)} ${String(v.pass).padStart(3)}/${String(v.total).padEnd(3)} (${v.pct ?? 0}%)`);
}
if (verdicts.length > 1) console.log(`║ ${"-".repeat(40)}\n║ TOTAL          ${String(grand.pass).padStart(3)}/${String(grand.total).padEnd(3)}`);
console.log(`╚══════════════════════════════════════════════`);

// specimen dump for the golden set:
if (specimens.length) {
  const specPath = path.join(BACKEND, "test", "specimens", `${arg}-specimens.json`);
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(path.dirname(specPath), { recursive: true });
  writeFileSync(specPath, JSON.stringify(specimens, null, 2));
  console.log(`\n📌 ${specimens.length} specimens → ${specPath}`);
}

process.exit(0);
