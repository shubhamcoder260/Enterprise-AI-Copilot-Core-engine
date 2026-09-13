// ==========================================
// VERIFICATION TEST P3.4: HYDRATION ON PAGE REFRESH
// ==========================================

import path from "path";
import { fileURLToPath } from "url";
import { initHistoryStore } from "../src/store/history.store.js";

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
  console.log("VERIFY P3.4: FRONTEND HYDRATION SIMULATION");
  console.log("==========================================\n");

  const sessionId = "session-p3-hydration";

  const historyDb = await initHistoryStore();
  await historyDb.run("DELETE FROM exchanges WHERE session_id = ?", [sessionId]);

  const chinookPath = path.resolve(__dirname, "..", "fixtures", "chinook.db");
  await switchDb(chinookPath);

  const testQueries = [
    "How many genres are there?",
    "How many media types are there?",
    "How many playlists are there?"
  ];

  const results = [];
  for (let i = 0; i < testQueries.length; i++) {
    const q = testQueries[i];
    console.log(`[Turn ${i + 1}] Query: "${q}"`);
    const res = await postQuery({ query: q, sessionId });
    console.log(`[Turn ${i + 1}] Answer: "${res.answer}" (source: ${res.source})`);
    results.push({ question: q, answer: res.answer, source: res.source });
    if (i < testQueries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Simulate frontend page refresh: fetch GET /api/history/:sessionId
  console.log(`\n[Simulating Page Refresh] Fetching GET /api/history/${sessionId}...`);
  const hydratedHistory = await getHistory(sessionId);
  console.log(`[Hydrated History Count]: ${hydratedHistory.count}`);

  let passed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  assert(hydratedHistory.count === 3, `Expected exactly 3 hydrated exchanges, got ${hydratedHistory.count}`);
  assert(Array.isArray(hydratedHistory.history) && hydratedHistory.history.length === 3, "Expected array of 3 items");

  for (let i = 0; i < testQueries.length; i++) {
    const expected = results[i];
    const actual = hydratedHistory.history[i];
    assert(actual?.question === expected.question, `Exchange ${i + 1} question matches ('${actual?.question}')`);
    assert(actual?.answer === expected.answer, `Exchange ${i + 1} answer matches ('${actual?.answer}')`);
    assert(actual?.source === expected.source, `Exchange ${i + 1} source matches ('${actual?.source}')`);
  }

  console.log("\n------------------------------------------");
  console.log(passed ? "🎉 VERIFY P3.4 PASSED" : "💥 VERIFY P3.4 FAILED");
  console.log("------------------------------------------");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
