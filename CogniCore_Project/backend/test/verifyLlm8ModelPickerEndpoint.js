// ==========================================
// VERIFICATION TEST 8A: Model Picker Endpoint & Graceful Degradation
// ==========================================

import http from "http";
import express from "express";
import aiRoutes from "../src/routes/ai.routes.js";

async function runTest() {
  console.log("==========================================");
  console.log("TEST 8A: MODEL PICKER ENDPOINT VERIFICATION");
  console.log("==========================================\n");

  const app = express();
  app.use(express.json());
  app.use("/api/llm", aiRoutes);
  app.use("/api/ai", aiRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(58890, "127.0.0.1", resolve));

  let passed = true;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  try {
    // 1. Live call to GET /api/llm/models
    console.log("[Test] 1. Requesting GET http://127.0.0.1:58890/api/llm/models (live)...");
    const resLive = await fetch("http://127.0.0.1:58890/api/llm/models");
    assert(resLive.status === 200, `Expected 200 OK, got ${resLive.status}`);
    const dataLive = await resLive.json();
    console.log("[Test] Live models response:", dataLive);
    assert(dataLive.available === true, "Expected available: true");
    assert(dataLive.current === "gemma3:4b", `Expected current: 'gemma3:4b', got '${dataLive.current}'`);
    assert(Array.isArray(dataLive.models) && dataLive.models.includes("gemma3:4b"), "Expected models array containing 'gemma3:4b'");

    // 2. Dead port test (Ollama offline graceful degradation)
    console.log("\n[Test] 2. Testing graceful degradation with offline LLM...");
    const originalUrl = process.env.LOCAL_LLM_URL;
    process.env.LOCAL_LLM_URL = "http://127.0.0.1:59999";

    const resDead = await fetch("http://127.0.0.1:58890/api/llm/models");
    assert(resDead.status === 200, `Expected 200 OK even when offline, got ${resDead.status}`);
    const dataDead = await resDead.json();
    console.log("[Test] Offline models response:", dataDead);
    assert(dataDead.available === false, "Expected available: false when offline");
    assert(dataDead.current === "gemma3:4b", "Expected fallback current to default");
    assert(Array.isArray(dataDead.models) && dataDead.models.length > 0, "Expected fallback models list with default");

    if (originalUrl) process.env.LOCAL_LLM_URL = originalUrl;
    else delete process.env.LOCAL_LLM_URL;

    console.log("\n==========================================");
    if (passed) {
      console.log("🎉 TEST 8A PASSED: Model picker endpoint contract verified");
    } else {
      console.error("💥 TEST 8A FAILED");
      process.exit(1);
    }
    console.log("==========================================");
  } finally {
    server.close();
  }
}

runTest().catch((err) => {
  console.error("FATAL in test 8A:", err);
  process.exit(1);
});
