// ============================================================================
// VERIFICATION: RLS WRITE POLICY GOLDEN CORPUS (PHASE D5 EXIT CRITERION 3)
// Evaluates all 20 golden test cases against evaluateRlsWritePolicy.
// Confirms 100% green compliance across all allow/deny paths.
// ============================================================================

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateRlsWritePolicy } from "../src/security/rls.policy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runGoldenVerification() {
  console.log("==================================================");
  console.log("   STEP D5 — VERIFY RLS WRITE POLICY GOLDEN       ");
  console.log("==================================================");

  const corpusPath = path.resolve(__dirname, "golden/rls_write_policy_golden.json");
  const rawCorpus = fs.readFileSync(corpusPath, "utf-8");
  const testCases = JSON.parse(rawCorpus);

  let passed = 0;
  let total = 0;

  for (const tc of testCases) {
    total++;
    try {
      const res = evaluateRlsWritePolicy(tc.input);

      assert.strictEqual(
        res.verdict,
        tc.expected.verdict,
        `Case ${tc.id}: verdict mismatch. Expected '${tc.expected.verdict}', got '${res.verdict}'`
      );

      if (tc.expected.error) {
        assert.strictEqual(
          res.error,
          tc.expected.error,
          `Case ${tc.id}: error code mismatch. Expected '${tc.expected.error}', got '${res.error}'`
        );
      } else {
        assert.strictEqual(res.error, null, `Case ${tc.id}: expected no error, got '${res.error}'`);
      }

      console.log(`✅ [PASS] Case ${tc.id}: ${tc.description}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] Case ${tc.id}: ${tc.description}`);
      console.error(`   Details: ${err.message}`);
    }
  }

  console.log("==================================================");
  console.log(`RLS WRITE GOLDEN RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log("🏆 ALL RLS WRITE POLICY GOLDEN CORPUS TESTS GREEN");
    console.log("==================================================");
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

runGoldenVerification().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
