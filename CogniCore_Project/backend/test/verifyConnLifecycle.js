// ==========================================
// TEST: CONNECTION LIFECYCLE & CONCURRENCY (TASK C)
// Fires 20 concurrent POST /api/ai/query count questions.
// Asserts zero errors and zero SQLITE_MISUSE.
// Follows snapshot/restore hygiene on active-database.json.
// ==========================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5000";
const CONFIG_FILE = path.join(__dirname, "..", "active-database.json");

async function main() {
  console.log("==========================================");
  console.log("   VERIFY CONNECTION LIFECYCLE (20 CONCURRENT) ");
  console.log("==========================================\n");

  // 1. Snapshot active-database.json
  let originalConfig = null;
  try {
    originalConfig = await fs.readFile(CONFIG_FILE, "utf8");
    console.log("📸 [Hygiene] Snapshotted active-database.json");
  } catch (e) {
    console.warn("⚠️ Could not snapshot config:", e.message);
  }

  try {
    // 2. Fire 20 concurrent requests
    console.log("🚀 Firing 20 concurrent query requests...");
    const queries = Array.from({ length: 20 }, (_, i) => ({
      query: "how many students are there",
      sessionId: `lifecycle-test-${i}`
    }));

    const startTime = Date.now();
    const promises = queries.map((q, i) =>
      fetch(`${BASE_URL}/api/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q)
      })
        .then(async (res) => {
          const body = await res.json();
          return { status: res.status, body, index: i };
        })
        .catch((err) => ({ error: err.message, index: i }))
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    console.log(`⏱️ Completed 20 concurrent queries in ${duration}ms\n`);

    let passed = 0;
    let failed = 0;
    const errors = [];

    for (const r of results) {
      if (r.error) {
        failed++;
        errors.push(`Request ${r.index} fetch error: ${r.error}`);
        continue;
      }

      const bodyStr = JSON.stringify(r.body);
      if (bodyStr.includes("SQLITE_MISUSE")) {
        failed++;
        errors.push(`Request ${r.index} encountered SQLITE_MISUSE`);
        continue;
      }

      if (r.status === 200 && r.body?.source === "dynamic") {
        passed++;
      } else {
        failed++;
        errors.push(`Request ${r.index} status: ${r.status}, source: ${r.body?.source}, answer: ${r.body?.answer}`);
      }
    }

    console.log(`Summary: ${passed}/20 requests succeeded cleanly.`);

    if (failed > 0) {
      console.error(`❌ Failures (${failed}):`);
      errors.forEach((e) => console.error(`   ${e}`));
      process.exit(1);
    }

    console.log("✅ Zero errors, zero SQLITE_MISUSE. Connection singleton confirmed safe under concurrency!");
  } finally {
    // 3. Restore config
    if (originalConfig !== null) {
      try {
        await fs.writeFile(CONFIG_FILE, originalConfig, "utf8");
        console.log("🔄 [Hygiene] Restored active-database.json snapshot.");
      } catch (e) {
        console.error("❌ Failed to restore config snapshot:", e);
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
