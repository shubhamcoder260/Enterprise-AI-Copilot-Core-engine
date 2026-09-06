// ==========================================
// VERIFICATION TEST 10: <think> Tag Stripping
// ==========================================

import { cleanLlmSql } from "./src/llm/llm.client.js";
import { runCoreEngine } from "./src/core/core.engine.js";
import { switchDatabase } from "./src/config/database.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("==========================================");
  console.log("TEST 10: <THINK> TAG STRIPPING (SYNTHETIC & LIVE)");
  console.log("==========================================\n");

  let passed = true;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  // 1. Synthetic Adversarial / Multi-line Think Blocks
  console.log("[Test 10A] Testing synthetic reasoning token inputs...");
  const syntheticInputs = [
    {
      raw: "<think>\nThinking step by step...\nLet's check the schema.\n</think>\nSELECT * FROM students LIMIT 50",
      expected: "SELECT * FROM students LIMIT 50"
    },
    {
      raw: "<think>deep reasoning</think>```sqlite\nSELECT name, cgpa FROM students\n```",
      expected: "SELECT name, cgpa FROM students"
    },
    {
      raw: "   <think>\nline 1\nline 2\n</think>   SELECT id FROM students;  ",
      expected: "SELECT id FROM students"
    }
  ];

  for (let i = 0; i < syntheticInputs.length; i++) {
    const item = syntheticInputs[i];
    const cleaned = cleanLlmSql(item.raw);
    assert(!cleaned.includes("<think"), `Synthetic #${i+1}: cleaned output must not contain '<think'`);
    assert(!cleaned.includes("</think>"), `Synthetic #${i+1}: cleaned output must not contain '</think>'`);
    assert(cleaned === item.expected, `Synthetic #${i+1}: expected '${item.expected}', got '${cleaned}'`);
  }

  // 2. Live Query on gemma3:4b
  console.log("\n[Test 10B] Testing live Ollama response on cognicore.db...");
  const cognicorePath = path.resolve(__dirname, "cognicore.db");
  await switchDatabase(cognicorePath);

  const liveResponse = await runCoreEngine({
    query: "Show all students enrolled in the year 2026",
    organization: "college",
    role: "admin",
    sessionId: "test-session-10"
  });

  console.log("\n[Test] Live Response SQL:", liveResponse.data?.sql);

  assert(liveResponse.source === "llm", `Expected response.source === 'llm', got '${liveResponse.source}'`);
  assert(typeof liveResponse.data?.sql === "string", "Expected data.sql to be string");
  assert(!liveResponse.data.sql.includes("<think"), "Live data.sql must not contain '<think'");
  assert(!liveResponse.data.sql.includes("</think"), "Live data.sql must not contain '</think'");
  assert(!liveResponse.answer.includes("<think"), "Live answer must not contain '<think'");

  console.log("\n==========================================");
  if (passed) {
    console.log("🎉 TEST 10 PASSED: <think> tags stripped cleanly across synthetic and live runs");
  } else {
    console.error("💥 TEST 10 FAILED");
    process.exit(1);
  }
  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("FATAL in test 10:", err);
  process.exit(1);
});
