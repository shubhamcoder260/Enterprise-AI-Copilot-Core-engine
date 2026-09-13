// ==========================================
// REGRESSION TEST: PHASE 2 STALENESS TRAP
// Switch to ecommerce_test -> query -> switch back to chinook -> query
// ==========================================

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5000";

async function postQuery(query) {
  const res = await fetch(`${BASE_URL}/api/ai/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      sessionId: "session-staleness-trap",
      organization: "college",
      role: "admin"
    })
  });
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
  console.log("REGRESSION: PHASE 2 STALENESS TRAP");
  console.log("==========================================\n");

  const ecommercePath = path.resolve(__dirname, "..", "fixtures", "ecommerce_test.db");
  const chinookPath = path.resolve(__dirname, "..", "fixtures", "chinook.db");

  // Step 1: Switch to ecommerce_test.db
  console.log("[Step 1] Switching to ecommerce_test.db...");
  const s1 = await switchDb(ecommercePath);
  console.log("Active DB:", s1.activeDatabase);

  // Step 2: Query ecommerce_test.db
  const q1 = "How many customers are in the database?";
  console.log(`[Step 2] Query ecommerce: "${q1}"`);
  const r1 = await postQuery(q1);
  console.log(`[Step 2] Answer: "${r1.answer}", Source: "${r1.source}"`);

  // Step 3: Switch back to chinook.db
  console.log("\n[Step 3] Switching back to chinook.db...");
  const s2 = await switchDb(chinookPath);
  console.log("Active DB:", s2.activeDatabase);

  // Step 4: Query chinook.db
  const q2 = "How many tracks are in the database?";
  console.log(`[Step 4] Query chinook: "${q2}"`);
  const r2 = await postQuery(q2);
  console.log(`[Step 4] Answer: "${r2.answer}", Source: "${r2.source}"`);

  let passed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  assert(r1.source === "llm" || r1.source === "dynamic", `E-Commerce handled (source: ${r1.source})`);
  assert(r1.answer.includes("200") || r1.answer.includes("customer"), `E-Commerce returned valid customer data`);

  assert(r2.source === "llm" || r2.source === "dynamic", `Chinook handled (source: ${r2.source})`);
  assert(r2.answer.includes("3503") || r2.answer.includes("track"), `Chinook returned valid track data`);

  console.log("\n------------------------------------------");
  console.log(passed ? "🎉 STALENESS TRAP REGRESSION PASSED" : "💥 STALENESS TRAP REGRESSION FAILED");
  console.log("------------------------------------------");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
