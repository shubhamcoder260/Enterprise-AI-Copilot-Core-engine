// ==========================================
// REGRESSION TEST: CATEGORICAL VALUE PRECISION (S13)
// Specimen S13: "How many enrollments received a B grade?" on U3_institute.db
// Verifies that normVal preserves categorical precision (e.g. 'B' vs 'B-')
// and yields exact ground-truth count of 5541.
//
// Invariants tested:
//   • Black-box testing over HTTP API (http://localhost:5000)
//   • active-database.json snapshotted on entry, restored in finally block
//   • Exact count assertion: 5541 (not 5391 for B- or collapsed sum)
// ==========================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5000";
const CONFIG_FILE = path.join(__dirname, "..", "active-database.json");
const U3_DB = path.join(
  __dirname,
  "fixtures",
  "realms",
  "university",
  "U3_institute.db"
);

async function main() {
  console.log("==================================================");
  console.log("   COGNICORE S13 — CATEGORICAL PRECISION VERIFY   ");
  console.log("==================================================");

  let originalConfig = null;

  try {
    // 1. Snapshot active-database.json
    try {
      originalConfig = await fs.readFile(CONFIG_FILE, "utf8");
      console.log("📸 [Hygiene] Snapshotted active-database.json");
    } catch (err) {
      console.warn("⚠️ [Hygiene] Could not snapshot config:", err.message);
    }

    // 2. Switch to U3_institute.db
    console.log("🔄 Switching active database to U3_institute.db...");
    const switchRes = await fetch(`${BASE_URL}/api/database/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ databasePath: U3_DB })
    });

    if (!switchRes.ok) {
      throw new Error(`Failed to switch DB: HTTP ${switchRes.status}`);
    }
    const switchData = await switchRes.json();
    console.log("✅ Active database switched:", switchData.activeDatabase);

    // 3. Query: "How many enrollments received a B grade?"
    const question = "How many enrollments received a B grade?";
    console.log(`\n❓ Querying: "${question}"`);
    const start = Date.now();

    const queryRes = await fetch(`${BASE_URL}/api/ai/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: question,
        sessionId: "verify-s13-precision"
      })
    });

    const elapsed = Date.now() - start;
    if (!queryRes.ok) {
      throw new Error(`Query failed: HTTP ${queryRes.status}`);
    }

    const res = await queryRes.json();
    console.log(`⏱️ Response received in ${elapsed}ms:`);
    console.log(`   ↳ Source: ${res.source}`);
    console.log(`   ↳ Value:  ${res.data?.value}`);
    console.log(`   ↳ SQL:    ${res.data?.sql}`);
    console.log(`   ↳ Answer: ${res.answer}`);

    // 4. Assertions (Hard check)
    const isDynamic = res.source === "dynamic";
    const exactCount = res.data?.value === 5541;
    const latencyOk = elapsed < 3000;

    if (!isDynamic) {
      throw new Error(`FAIL: Expected source 'dynamic', got '${res.source}'`);
    }
    if (!exactCount) {
      throw new Error(`FAIL: Expected value 5541, got ${res.data?.value}`);
    }
    if (!latencyOk) {
      throw new Error(`FAIL: Latency exceeded 3000ms: ${elapsed}ms`);
    }

    console.log("\n--------------------------------------------------");
    console.log("✅ S13 HARD ASSERTION PASSED: Exact 5541 B enrollments verified.");
    console.log("--------------------------------------------------");
  } finally {
    // 5. Restore original active-database.json
    if (originalConfig !== null) {
      try {
        await fs.writeFile(CONFIG_FILE, originalConfig, "utf8");
        // Also call switch endpoint to ensure in-memory connection matches restored config
        const parsed = JSON.parse(originalConfig);
        if (parsed.activeDatabasePath) {
          await fetch(`${BASE_URL}/api/database/switch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ databasePath: parsed.activeDatabasePath })
          }).catch(() => {});
        }
        console.log("🔄 [Hygiene] Restored active-database.json snapshot.");
      } catch (e) {
        console.error("❌ Failed to restore config snapshot:", e.message);
      }
    }
  }

  console.log("🎉 Categorical value precision test complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("🚨 Test failed with error:", err.message);
  process.exit(1);
});
