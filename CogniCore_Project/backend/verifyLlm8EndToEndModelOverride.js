// ==========================================
// VERIFICATION TEST 8B: End-to-End Model Passthrough
// ==========================================

import { runCoreEngine } from "./src/core/core.engine.js";
import { switchDatabase } from "./src/config/database.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("==========================================");
  console.log("TEST 8B: MODEL OVERRIDE PASSTHROUGH");
  console.log("==========================================\n");

  const cognicorePath = path.resolve(__dirname, "cognicore.db");
  await switchDatabase(cognicorePath);

  const query = "Show all students enrolled in the year 2026";
  const requestedModel = "gemma3:4b";
  console.log(`[Test] Running query with explicit model override: "${requestedModel}"`);

  const startTime = Date.now();
  const response = await runCoreEngine({
    query,
    organization: "college",
    role: "admin",
    sessionId: "test-session-8b",
    model: requestedModel
  });
  const elapsed = Date.now() - startTime;

  console.log("\n[Test] Engine Response Envelope:");
  console.log(JSON.stringify(response, null, 2));

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
  assert(response.meta?.model === requestedModel, `Expected meta.model === '${requestedModel}', got '${response.meta?.model}'`);
  assert(response.data?.rowCount === 4, `Expected rowCount === 4, got ${response.data?.rowCount}`);

  console.log("\n==========================================");
  if (passed) {
    console.log(`🎉 TEST 8B PASSED: Model override verified in ${elapsed}ms`);
  } else {
    console.error("💥 TEST 8B FAILED");
    process.exit(1);
  }
  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("FATAL in test 8B:", err);
  process.exit(1);
});
