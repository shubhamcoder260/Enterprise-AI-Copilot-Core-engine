// ==========================================
// VERIFICATION TEST 8: Hallucinated Table Execution Error Cascade
// ==========================================

import http from "http";
import { runCoreEngine } from "../src/core/core.engine.js";
import { switchDatabase } from "../src/config/database.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("==========================================");
  console.log("TEST 8: HALLUCINATED TABLE (llm_execution_error) CASCADE");
  console.log("==========================================\n");

  const originalUrl = process.env.LOCAL_LLM_URL;
  const originalTimeout = process.env.LOCAL_LLM_TIMEOUT_MS;

  const mockPort = 58882;
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      model: "mock-hallucinating-model",
      response: "SELECT * FROM definitely_not_a_table",
      done: true
    }));
  });

  await new Promise((resolve) => mockServer.listen(mockPort, "127.0.0.1", resolve));
  console.log(`[Test] Mock Ollama server running on http://127.0.0.1:${mockPort}`);

  process.env.LOCAL_LLM_URL = `http://127.0.0.1:${mockPort}`;
  process.env.LOCAL_LLM_TIMEOUT_MS = "2000";

  try {
    const cognicorePath = path.resolve(__dirname, "..", "fixtures", "cognicore.db");
    await switchDatabase(cognicorePath);

    const query = "Count total students";
    console.log(`[Test] Submitting query: "${query}"`);

    const startTime = Date.now();
    const response = await runCoreEngine({
      query,
      organization: "college",
      role: "admin",
      sessionId: "test-session-8"
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
    assert(response.source === "dynamic" || response.source === "fallback", `Expected cascade to dynamic/fallback, got '${response.source}'`);
    assert(typeof response.answer === "string" && response.answer.length > 0, "Expected non-empty answer string");
    assert(elapsed < 2000, `Expected elapsed < 2000ms, took ${elapsed}ms`);

    console.log("\n==========================================");
    if (passed) {
      console.log(`🎉 TEST 8 PASSED: Hallucinated table cascaded cleanly in ${elapsed}ms`);
    } else {
      console.error("💥 TEST 8 FAILED");
      process.exit(1);
    }
    console.log("==========================================");
  } finally {
    mockServer.close();
    if (originalUrl) process.env.LOCAL_LLM_URL = originalUrl;
    else delete process.env.LOCAL_LLM_URL;
    if (originalTimeout) process.env.LOCAL_LLM_TIMEOUT_MS = originalTimeout;
    else delete process.env.LOCAL_LLM_TIMEOUT_MS;
  }
}

runTest().catch((err) => {
  console.error("FATAL in test 8:", err);
  process.exit(1);
});
