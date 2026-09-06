// ==========================================
// VERIFICATION TEST P3.1: HISTORY PERSISTENCE
// ==========================================

import path from "path";
import { fileURLToPath } from "url";
import { initHistoryStore } from "./src/store/history.store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5000";

async function postQuery({ query, sessionId }) {
  const res = await fetch(`${BASE_URL}/api/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      sessionId,
      organization: "college",
      role: "admin"
    })
  });
  return res.json();
}

async function getHistory(sessionId) {
  const res = await fetch(`${BASE_URL}/api/history/${sessionId}`);
  return res.json();
}

async function switchDb(dbPath) {
  const res = await fetch(`${BASE_URL}/api/database/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databasePath: dbPath })
  });
  return res.json();
}

async function run() {
  console.log("==========================================");
  console.log("VERIFY P3.1: HISTORY PERSISTENCE VIA HTTP API");
  console.log("==========================================\n");

  const sessionId = "session-p3-1";

  // Clean up any previous test runs for this session
  const historyDb = await initHistoryStore();
  await historyDb.run("DELETE FROM exchanges WHERE session_id = ?", [sessionId]);

  // Ensure active database is chinook.db
  const chinookPath = path.resolve(__dirname, "chinook.db");
  await switchDb(chinookPath);

  // Question 1
  const q1 = "How many tracks are in the database?";
  console.log(`[Turn 1] POST /api/ai/query: "${q1}"`);
  const r1 = await postQuery({ query: q1, sessionId });
  console.log(`[Turn 1] Answer: "${r1.answer}", Source: "${r1.source}"`);

  // Question 2
  const q2 = "How many artists are in the database?";
  console.log(`\n[Turn 2] POST /api/ai/query: "${q2}"`);
  const r2 = await postQuery({ query: q2, sessionId });
  console.log(`[Turn 2] Answer: "${r2.answer}", Source: "${r2.source}"`);

  // Fetch History
  console.log(`\n[History] GET /api/history/${sessionId}`);
  const historyData = await getHistory(sessionId);
  console.log("[History Payload]:\n", JSON.stringify(historyData, null, 2));

  let passed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  assert(historyData.sessionId === sessionId, `Expected sessionId === '${sessionId}'`);
  assert(historyData.count === 2, `Expected count === 2, got ${historyData.count}`);
  assert(Array.isArray(historyData.history) && historyData.history.length === 2, "Expected history to have length 2");

  if (historyData.history && historyData.history.length === 2) {
    const [ex1, ex2] = historyData.history;
    assert(ex1.question === q1, `First exchange question should match Q1, got "${ex1.question}"`);
    assert(ex2.question === q2, `Second exchange question should match Q2, got "${ex2.question}"`);
    assert(typeof ex1.answer === "string" && ex1.answer.length > 0, "First exchange answer is non-empty");
    assert(typeof ex2.answer === "string" && ex2.answer.length > 0, "Second exchange answer is non-empty");
    assert(
      (ex1.sql && ex1.sql.length > 0) || (ex2.sql && ex2.sql.length > 0),
      "At least one exchange has non-null SQL recorded"
    );
    assert(Number(ex1.id) < Number(ex2.id), "Exchanges are strictly in chronological order (ex1.id < ex2.id)");
  }

  console.log("\n------------------------------------------");
  console.log(passed ? "🎉 VERIFY P3.1 PASSED" : "💥 VERIFY P3.1 FAILED");
  console.log("------------------------------------------");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
