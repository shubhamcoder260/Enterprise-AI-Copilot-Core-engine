// ==========================================
// VERIFICATION TEST 9: Offline LLM Failover
// ==========================================

import { runCoreEngine } from "./src/core/core.engine.js";
import { switchDatabase } from "./src/config/database.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("==========================================");
  console.log("TEST 9: OLLAMA OFFLINE FAILOVER (<1.5s CASCADE)");
  console.log("==========================================\n");

  const originalUrl = process.env.LOCAL_LLM_URL;

  // Point to guaranteed dead port
  process.env.LOCAL_LLM_URL = "http://localhost:59999";

  try {
    const cognicorePath = path.resolve(__dirname, "cognicore.db");
    await switchDatabase(cognicorePath);

    const query = "Count total students";
    console.log(`[Test] Submitting query to offline LLM: "${query}"`);

    const startTime = Date.now();
    const response = await runCoreEngine({
      query,
      organization: "college",
      role: "admin",
      sessionId: "test-session-9"
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

    assert(response.source !== "llm", `Expected response.source !== 'llm', got '${response.source}'`);
    assert(response.source === "dynamic" || response.source === "fallback", `Expected response.source === 'dynamic' or 'fallback', got '${response.source}'`);
    assert(typeof response.answer === "string" && response.answer.length > 0, "Expected non-empty answer string");
    assert(elapsed < 1500, `Expected failover cascade < 1500ms, took ${elapsed}ms`);

    console.log("\n==========================================");
    if (passed) {
      console.log(`🎉 TEST 9 PASSED: Offline LLM cascaded in ${elapsed}ms (<1500ms limit)`);
    } else {
      console.error("💥 TEST 9 FAILED");
      process.exit(1);
    }
    console.log("==========================================");
  } finally {
    if (originalUrl) process.env.LOCAL_LLM_URL = originalUrl;
    else delete process.env.LOCAL_LLM_URL;
  }
}

runTest().catch((err) => {
  console.error("FATAL in test 9:", err);
  process.exit(1);
});
