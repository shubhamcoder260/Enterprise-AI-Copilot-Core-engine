// ==========================================
// VERIFICATION TEST 4: Simple Retrieval (LLM Link)
// ==========================================

import { runCoreEngine } from "./src/core/core.engine.js";
import { executeReadOnlySql, switchDatabase } from "./src/config/database.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("==========================================");
  console.log("TEST 4: SIMPLE RETRIEVAL VIA LOCAL LLM");
  console.log("==========================================\n");

  // Ensure active database is cognicore.db
  const cognicorePath = path.resolve(__dirname, "cognicore.db");
  await switchDatabase(cognicorePath);

  const query = "Show all students enrolled in the year 2026";
  console.log(`[Test] Submitting natural language query: "${query}"`);

  const startTime = Date.now();
  const response = await runCoreEngine({
    query,
    organization: "college",
    role: "admin",
    sessionId: "test-session-4"
  });
  const elapsed = Date.now() - startTime;

  console.log("\n[Test] Engine Response Envelope:");
  console.log(JSON.stringify(response, null, 2));

  // Ground truth verification
  const groundTruthRows = await executeReadOnlySql(
    "SELECT id, name, cgpa, country, enrollment_year FROM students WHERE enrollment_year = 2026 ORDER BY id ASC;"
  );

  console.log("\n[Test] Ground Truth Rows:", groundTruthRows);

  let passed = true;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  assert(response.source === "llm", `Expected response.source === 'llm', got '${response.source}'`);
  assert(response.meta?.engineMode === "local_llm", `Expected meta.engineMode === 'local_llm', got '${response.meta?.engineMode}'`);
  assert(typeof response.data?.sql === "string" && response.data.sql.length > 0, "Expected data.sql to be a non-empty string");
  assert(Array.isArray(response.data?.records), "Expected data.records to be an array");
  assert(response.data?.rowCount === groundTruthRows.length, `Expected rowCount === ${groundTruthRows.length}, got ${response.data?.rowCount}`);

  // Compare returned records with ground truth
  const returnedIds = (response.data?.records || []).map(r => r.id).sort();
  const expectedIds = groundTruthRows.map(r => r.id).sort();
  assert(
    JSON.stringify(returnedIds) === JSON.stringify(expectedIds),
    `Expected IDs ${JSON.stringify(expectedIds)}, got ${JSON.stringify(returnedIds)}`
  );

  assert(typeof response.meta?.llmDurationMs === "number" && response.meta.llmDurationMs > 0, `Expected meta.llmDurationMs > 0, got ${response.meta?.llmDurationMs}`);
  assert(typeof response.meta?.processingMs === "number" && response.meta.processingMs > 0, `Expected meta.processingMs > 0, got ${response.meta?.processingMs}`);
  assert(typeof response.meta?.model === "string" && response.meta.model.length > 0, `Expected meta.model, got ${response.meta?.model}`);

  console.log("\n==========================================");
  if (passed) {
    console.log(`🎉 TEST 4 PASSED: Simple retrieval verified in ${elapsed}ms`);
  } else {
    console.error("💥 TEST 4 FAILED");
    process.exit(1);
  }
  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("FATAL in test 4:", err);
  process.exit(1);
});
