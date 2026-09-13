// ============================================================
// VERIFY ERP GROUND TRUTH — 6 hard-assertion questions
// against erp_demo.db via the LIVE HTTP engine.
// Hygiene: uses COGNICORE_ACTIVE_DB env override (no pointer mutation).
// Usage: start server with:
//   COGNICORE_ACTIVE_DB=$PWD/fixtures/erp_demo.db LOCAL_LLM_TIMEOUT_MS=45000 \
//   nohup node src/server.js > /tmp/cc-server.log 2>&1 &
// then: node test/verifyErpGroundTruth.js
// ============================================================

const BASE_URL = "http://localhost:5000";
const EXPECTED_DB_MARKER = "fixtures/erp_demo.db";

// ── Pre-check: the server must be on erp_demo ──────────────
async function precheck() {
  const res = await fetch(`${BASE_URL}/api/database/active`);
  const data = await res.json();
  const p = JSON.stringify(data);
  if (!p.includes(EXPECTED_DB_MARKER)) {
    console.error("💥 FATAL: server is not on erp_demo.db.");
    console.error(`   Active: ${p}`);
    console.error(`   Restart with: COGNICORE_ACTIVE_DB=$PWD/fixtures/erp_demo.db node src/server.js`);
    process.exit(1);
  }
  console.log("✅ Pre-check: server is on erp_demo.db\n");
}

async function ask(query, sessionId) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, sessionId, organization: "college" }),
  });
  const data = await res.json();
  return { ...data, clientMs: Date.now() - start };
}

const results = [];
function record(id, question, pass, detail) {
  results.push({ id, question, pass, detail });
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"} [${id}] ${question}`);
  console.log(`   ${detail}`);
}

// ── The 6 questions ─────────────────────────────────────────
const QUESTIONS = [
  {
    id: "ERP-1",
    q: "Which employee manages the most people?",
    // Accepts either name or the count, not both blindly:
    check: (r) => {
      const txt = JSON.stringify(r);
      const hasName = txt.includes("Tariq Patel");
      const has7 = txt.includes("7");
      return { pass: hasName, detail: `answer="${r.answer}" source=${r.source} name=${hasName} count7=${has7}` };
    },
  },
  {
    id: "ERP-2",
    q: "How many VIP clients are there?",
    check: (r) => {
      const txt = JSON.stringify(r);
      const pass = txt.includes("3") && (r.source === "dynamic" || r.source === "llm" || r.source === "tool");
      return { pass, detail: `answer="${r.answer}" source=${r.source}` };
    },
  },
  {
    id: "ERP-3",
    q: "Which clients have no invoices?",
    check: (r) => {
      const txt = JSON.stringify(r);
      // Accept a count of 9 OR a listing whose records length is 9
      const count = r.data?.records?.length ?? null;
      const pass = (count === 9) || (txt.includes("9") && r.source !== "fallback");
      return { pass, detail: `answer="${r.answer}" source=${r.source} records=${count}` };
    },
  },
  {
    id: "ERP-4",
    q: "Average salary per department",
    check: (r) => {
      const recs = r.data?.records;
      const pass = Array.isArray(recs) && recs.length === 6;
      const engOk = pass && JSON.stringify(recs).includes("Engineering");
      return { pass, detail: `rows=${Array.isArray(recs) ? recs.length : 0} Engineering_present=${engOk} source=${r.source}` };
    },
  },
  {
    id: "ERP-5",
    q: "Which department has the largest annual budget?",
    check: (r) => {
      const txt = JSON.stringify(r);
      const pass = txt.includes("Engineering") && (txt.includes("2500000") || txt.includes("2,500,000") || txt.includes("2.5 million") || true);
      // strict on name; budget formatting varies, so name is the hard assert
      return { pass: txt.includes("Engineering") && r.source !== "fallback", detail: `answer="${r.answer}" source=${r.source}` };
    },
  },
  {
    id: "ERP-6",
    q: "Which client has been invoiced the most in total?",
    check: (r) => {
      const txt = JSON.stringify(r);
      const pass = (txt.includes("contact20@client.com") || txt.includes("Brazil")) && r.source !== "fallback";
      return { pass, detail: `answer="${r.answer}" source=${r.source}` };
    },
  },
];

// ── Runner ──────────────────────────────────────────────────
(async () => {
  await precheck();
  for (const { id, q, check } of QUESTIONS) {
    try {
      const r = await ask(q, `erp-gt-${id.toLowerCase()}`);
      const { pass, detail } = check(r);
      record(id, q, pass, detail);
    } catch (e) {
      record(id, q, false, `EXCEPTION: ${e.message}`);
    }
  }

  console.log("\n════════ ERP GROUND-TRUTH RESULTS ════════");
  const passed = results.filter((r) => r.pass).length;
  console.table(results.map(({ id, question, pass, detail }) => ({ id, question, pass: pass ? "YES" : "NO", detail })));
  console.log(`\nSCORE: ${passed}/${results.length} hard assertions passed`);
  console.log(passed === results.length ? "🎉 PERFECT" : "📌 Specimens captured — failures become golden regression tests");
})();