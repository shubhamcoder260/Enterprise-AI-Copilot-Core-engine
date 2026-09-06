import { runDynamicQuery } from "./src/core/dynamic.query.engine.js";
import {
  clearSchemaCache,
  resetSchemaCacheStats,
  getSchemaCacheStats
} from "./src/core/schema.reader.js";

async function main() {
  console.log("\n==========================================");
  console.log("🧪 RUNNING SCHEMA CACHE HIT/MISS PROOF");
  console.log("==========================================\n");

  // Step 0: Clear cache and reset counters
  clearSchemaCache();
  resetSchemaCacheStats();

  console.log("--- Initial Stats ---");
  console.log(getSchemaCacheStats());

  // Step 1: Call 1 (Cold cache)
  console.log("\n▶️ [CALL 1] Executing: 'show records from students'");
  await runDynamicQuery("show records from students");
  const statsAfterCall1 = getSchemaCacheStats();
  console.log("\n📌 Counter value after Call 1:", statsAfterCall1);

  // Step 2: Call 2 (Warm cache)
  console.log("\n▶️ [CALL 2] Executing identical query: 'show records from students'");
  await runDynamicQuery("show records from students");
  const statsAfterCall2 = getSchemaCacheStats();
  console.log("\n📌 Counter value after Call 2:", statsAfterCall2);

  // Assertions
  console.log("\n==========================================");
  console.log("📊 PROOF VERIFICATION SUMMARY");
  console.log("==========================================");
  console.log(`Call 1 DB Schema Reads : ${statsAfterCall1.dbReads}`);
  console.log(`Call 2 DB Schema Reads : ${statsAfterCall2.dbReads - statsAfterCall1.dbReads}`);
  console.log(`Total DB Schema Reads  : ${statsAfterCall2.dbReads}`);
  console.log(`Total Cache Hits       : ${statsAfterCall2.hits}`);
  console.log(`Total PRAGMA Reads     : ${statsAfterCall2.pragmaCalls}`);

  if (statsAfterCall2.dbReads === 1 && statsAfterCall2.hits === 1) {
    console.log("\n✅ SUCCESS: Exactly 1 DB read total across both calls!");
  } else {
    console.error("\n❌ FAILED: Cache did not prevent second DB read!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
