// ==========================================
// VERIFICATION TEST P3.3: SESSION ISOLATION
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
  console.log("VERIFY P3.3: SESSION ISOLATION VIA HTTP API");
  console.log("==========================================\n");

  const sessionA = "session-p3-iso-A";
  const sessionB = "session-p3-iso-B";

  const historyDb = await initHistoryStore();
  await historyDb.run("DELETE FROM exchanges WHERE session_id IN (?, ?)", [sessionA, sessionB]);

  const chinookPath = path.resolve(__dirname, "chinook.db");
  await switchDb(chinookPath);

  // Turn 1 on Session A
  const qA = "Top 5 artists by number of tracks";
  console.log(`[Session A] POST /api/ai/query: "${qA}"`);
  const rA = await postQuery({ query: qA, sessionId: sessionA });
  console.log(`[Session A] Answer: "${rA.answer}", Source: "${rA.source}"`);

  // Short pause for CPU inference queue cooldown
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Turn 2 on Session B (Isolated - no history!)
  const qB = "and for albums?";
  console.log(`\n[Session B] POST /api/ai/query: "${qB}"`);
  const rB = await postQuery({ query: qB, sessionId: sessionB });
  console.log(`[Session B] Answer: "${rB.answer}", Source: "${rB.source}"`);
  console.log(`[Session B] SQL: ${rB.data?.sql}`);
  console.log(`[Session B] Meta:`, JSON.stringify(rB.meta, null, 2));

  // Check history endpoints
  const histA = await getHistory(sessionA);
  const histB = await getHistory(sessionB);

  console.log(`\n[History Session A Count]: ${histA.count}`);
  console.log(`[History Session B Count]: ${histB.count}`);

  let passed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  // Verification points:
  // 1. Session B had 0 context turns
  assert(!rB.meta?.contextTurns, `Session B had 0 context turns (got: ${rB.meta?.contextTurns || 0})`);

  // 2. History A only contains Session A's query
  assert(histA.count === 1, `Session A history has exactly 1 entry, got ${histA.count}`);
  assert(histA.history[0]?.question === qA, `Session A history entry matches qA`);

  // 3. History B only contains Session B's query
  assert(histB.count === 1, `Session B history has exactly 1 entry, got ${histB.count}`);
  assert(histB.history[0]?.question === qB, `Session B history entry matches qB`);

  // 4. Zero leak: Session B response does NOT include artists grouped query from Session A
  // If LLM resolved against artists, it would produce "FROM artists JOIN albums GROUP BY artists.ArtistId"
  const isLeaked = rB.data?.sql && /artists/i.test(rB.data.sql) && /group\s+by\s+artists/i.test(rB.data.sql);
  assert(!isLeaked, "Zero history leak: Session B did not resolve query against Session A's artists context");

  console.log("\n------------------------------------------");
  console.log(passed ? "🎉 VERIFY P3.3 PASSED" : "💥 VERIFY P3.3 FAILED");
  console.log("------------------------------------------");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
