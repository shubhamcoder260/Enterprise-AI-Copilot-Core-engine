// ==========================================
// VERIFICATION TEST 7: Malformed / Prose Output Cascade
// ==========================================

import http from "http";
import { runCoreEngine } from "./src/core/core.engine.js";
import { switchDatabase } from "./src/config/database.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("==========================================");
  console.log("TEST 7: MALFORMED / PROSE OUTPUT CASCADE");
  console.log("==========================================\n");

  const originalUrl = process.env.LOCAL_LLM_URL;
  const originalTimeout = process.env.LOCAL_LLM_TIMEOUT_MS;

  // Spin up mock server that returns prose
  const mockPort = 58881;
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      model: "mock-prose-model",
      response: "Sure, here is your query: SELECT * FROM",
      done: true
    }));
  });

  await new Promise((resolve) => mockServer.listen(mockPort, "127.0.0.1", resolve));
  console.log(`[Test] Mock Ollama server running on http://127.0.0.1:${mockPort}`);

  process.env.LOCAL_LLM_URL = `http://127.0.0.1:${mockPort}`;
  process.env.LOCAL_LLM_TIMEOUT_MS = "2000";

  try {
    // Ensure active database is cognicore.db
    const cognicorePath = path.resolve(__dirname, "cognicore.db");
    await switchDatabase(cognicorePath);

    const query = "Count total students";
    console.log(`[Test] Submitting query: "${query}"`);

    const startTime = Date.now();
    const response = await runCoreEngine({
      query,
      organization: "college",
      role: "admin",
      sessionId: "test-session-7"
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

    // Assert Link 2 cascaded past LLM because of llm_invalid_sql
    assert(response.source !== "llm", `Expected response.source !== 'llm', got '${response.source}'`);
    assert(response.source === "dynamic" || response.source === "fallback", `Expected response.source === 'dynamic' or 'fallback', got '${response.source}'`);
    assert(typeof response.answer === "string" && response.answer.length > 0, "Expected non-empty answer string");
    assert(elapsed < 2000, `Expected prompt handling < 2000ms, took ${elapsed}ms`);

    console.log("\n==========================================");
    if (passed) {
      console.log(`🎉 TEST 7 PASSED: Malformed prose cascaded cleanly in ${elapsed}ms`);
    } else {
      console.error("💥 TEST 7 FAILED");
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
  console.error("FATAL in test 7:", err);
  process.exit(1);
});
