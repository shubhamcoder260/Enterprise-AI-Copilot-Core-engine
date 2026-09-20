// ==========================================
// TEST: MECHANISM 1 (M1) — CORRECTIVE RETRY UNIT TEST (T1a)
// Tests:
//   1. buildCorrectivePrompt exports and contents (reason, hint, prior SQL)
//   2. Mock LLM counter proof: failing validation causes exactly 2 calls, then corrective_retry_exhausted
//   3. Mock LLM proves no 3rd call
//   4. Mock LLM generation failure / offline does NOT retry (exactly 1 call)
// ==========================================

import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { buildCorrectivePrompt, executeLlmLink, getRuleHint } from "../src/core/links/llm.link.js";
import { switchDatabase, getActiveDatabasePath } from "../src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, "../active-database.json");
const originalConfig = fs.readFileSync(CONFIG_FILE, "utf-8");

console.log("==================================================");
console.log("   TEST M1 (T1a): CORRECTIVE RETRY UNIT TEST     ");
console.log("==================================================");
console.log("📸 [Hygiene] Snapshotted active-database.json");

const ecommerceDb = path.join(__dirname, "../fixtures/ecommerce_test.db");
await switchDatabase(ecommerceDb);
console.log("🔄 Switched to ecommerce_test.db for mock schema validation");

// 1. buildCorrectivePrompt assertions
console.log("\n--- 1. buildCorrectivePrompt Structure & Hints ---");
const testReason = "ast_bare_column_without_group_by:category";
const testSql = "SELECT category, AVG(price) FROM products";
const promptWithoutBase = buildCorrectivePrompt(testReason, testSql);

console.log("Generated Prompt:\n", promptWithoutBase);
assert(promptWithoutBase.includes(testReason), "Prompt must include the exact reason");
assert(promptWithoutBase.includes(testSql), "Prompt must include the prior SQL");
const expectedHint = getRuleHint(testReason);
assert(promptWithoutBase.includes(expectedHint), "Prompt must include the rule hint");
assert(promptWithoutBase.includes("Regenerate the complete corrected SQL"), "Prompt must instruct regeneration");

const promptWithBase = buildCorrectivePrompt(testReason, testSql, "Original system instructions");
assert(promptWithBase.startsWith("Original system instructions\n\n"), "Prompt with basePrompt must prepend basePrompt");
assert(promptWithBase.includes(testReason), "Prompt with basePrompt must include reason");
console.log("✅ PASS: buildCorrectivePrompt contains reason, rule hint, and prior SQL.");

// 2. Counter Proof: Mock LLM client that fails validation
console.log("\n--- 2. Mock LLM Counter Proof (Max 2 Attempts) ---");
let callCount = 0;
const calls = [];

const mockFailingLlm = {
  async generateSql({ prompt, model }) {
    callCount++;
    calls.push({ call: callCount, prompt });
    // Always return invalid SQL that fails AST validation (bare column without group by)
    return {
      success: true,
      sql: 'SELECT category, AVG(price) FROM products',
      durationMs: 15,
      model: "mock-llm"
    };
  }
};

const mockDb = {
  async executeReadOnlySql(sql) {
    return [];
  }
};

const ctx = {
  query: "Average product price per category",
  organization: "retail",
  role: "analyst",
  sessionId: "mock-session-retry",
  model: "mock-model",
  startTime: Date.now(),
  capabilities: {
    db: mockDb,
    llm: mockFailingLlm
  },
  attempts: []
};

const outcome = await executeLlmLink(ctx);

console.log(`Outcome status : ${outcome.status}`);
console.log(`Outcome reason : ${outcome.reason}`);
console.log(`Total LLM calls: ${callCount}`);

assert.strictEqual(callCount, 2, "Must make EXACTLY 2 calls: 1 initial + 1 corrective retry");
assert.strictEqual(outcome.status, "PASS", "Exhausted retry must return PASS status");
assert(
  outcome.reason.startsWith("corrective_retry_exhausted:"),
  `Reason must start with corrective_retry_exhausted:, got: ${outcome.reason}`
);
assert(
  outcome.reason.includes("ast_bare_column_without_group_by"),
  `Reason must include underlying validation failure, got: ${outcome.reason}`
);
console.log("✅ PASS: Exactly 2 calls executed, then corrective_retry_exhausted returned.");

// 3. Prove NO 3rd call occurs
console.log("\n--- 3. Structural Limit Check: Prove No 3rd Call ---");
assert.strictEqual(callCount, 2, "Call count strictly capped at 2; no 3rd call possible");
console.log("✅ PASS: Call count strictly bounded to 2.");

// 4. Prove no retry on initial generation error / offline
console.log("\n--- 4. Generation Error / Offline Non-Retry Check ---");
let offlineCallCount = 0;
const mockOfflineLlm = {
  async generateSql() {
    offlineCallCount++;
    return {
      success: false,
      errorType: "llm_offline"
    };
  }
};

const offlineCtx = {
  query: "Total revenue",
  capabilities: {
    db: mockDb,
    llm: mockOfflineLlm
  },
  attempts: []
};

const offlineOutcome = await executeLlmLink(offlineCtx);
console.log(`Offline outcome status: ${offlineOutcome.status}`);
console.log(`Offline outcome reason: ${offlineOutcome.reason}`);
console.log(`Offline total calls   : ${offlineCallCount}`);
assert.strictEqual(offlineCallCount, 1, "Offline/generation failure must NOT retry; exactly 1 call");
assert.strictEqual(offlineOutcome.reason, "llm_offline", "Offline outcome reason must be llm_offline");
console.log("✅ PASS: Offline endpoint fails fast with 1 call, zero wasted retries.");

// Restore snapshot
fs.writeFileSync(CONFIG_FILE, originalConfig, "utf-8");
console.log("🔄 [Hygiene] Restored active-database.json snapshot.");

console.log("\n==================================================");
console.log("🎉 T1a UNIT TEST PASSED ALL ASSERTIONS!           ");
console.log("==================================================");
