// ==========================================
// VERIFICATION TEST P3.5: HISTORY SURVIVES DATABASE SWITCH
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
  console.log("VERIFY P3.5: HISTORY SURVIVES DATABASE SWITCH");
  console.log("==========================================\n");

  const sessionId = "session-switch-test";

  const historyDb = await initHistoryStore();
  await historyDb.run("DELETE FROM exchanges WHERE session_id = ?", [sessionId]);

  const chinookPath = path.resolve(__dirname, "chinook.db");
  const ecommercePath = path.resolve(__dirname, "ecommerce_test.db");

  // Step 1: Switch to chinook.db
  console.log(`[Step 1] Switching to chinook.db...`);
  const sw1 = await switchDb(chinookPath);
  console.log(`Active DB: ${sw1.activeDatabase}`);

  // Step 2: Query on chinook.db
  const qChinook = "How many tracks are in the database?";
  console.log(`\n[Turn 1 - Chinook] Query: "${qChinook}"`);
  const rChinook = await postQuery({ query: qChinook, sessionId });
  console.log(`[Turn 1] Answer: "${rChinook.answer}", Source: "${rChinook.source}"`);

  // Short pause for CPU inference queue cooldown
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 3: Switch to ecommerce_test.db
  console.log(`\n[Step 3] Switching to ecommerce_test.db...`);
  const sw2 = await switchDb(ecommercePath);
  console.log(`Active DB: ${sw2.activeDatabase}`);

  // Step 4: Query on ecommerce_test.db
  const qEcommerce = "How many customers are there?";
  console.log(`\n[Turn 2 - E-Commerce] Query: "${qEcommerce}"`);
  const rEcommerce = await postQuery({ query: qEcommerce, sessionId });
  console.log(`[Turn 2] Answer: "${rEcommerce.answer}", Source: "${rEcommerce.source}"`);

  // Step 5: Check history
  console.log(`\n[Step 5] Checking history for session '${sessionId}'...`);
  const hist = await getHistory(sessionId);
  console.log("[History Payload]:\n", JSON.stringify(hist, null, 2));

  let passed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  assert(hist.count === 2, `Expected history count === 2, got ${hist.count}`);
  assert(Array.isArray(hist.history) && hist.history.length === 2, "Expected 2 history items");

  if (hist.history && hist.history.length === 2) {
    assert(hist.history[0]?.question === qChinook, `History entry 1 question is Chinook query`);
    assert(hist.history[1]?.question === qEcommerce, `History entry 2 question is E-Commerce query`);
    assert(typeof hist.history[0]?.answer === "string" && hist.history[0]?.answer.length > 0, "Chinook answer recorded");
    assert(typeof hist.history[1]?.answer === "string" && hist.history[1]?.answer.length > 0, "E-Commerce answer recorded");
  }

  console.log("\n------------------------------------------");
  console.log(passed ? "🎉 VERIFY P3.5 PASSED" : "💥 VERIFY P3.5 FAILED");
  console.log("------------------------------------------");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
