// ============================================================
// VERIFICATION: ROW-LEVEL SECURITY (RLS) POLICY GOLDEN CORPUS
// Executes 20 golden test cases asserting deterministic verdicts:
// ALLOW, INJECT_PREDICATE, REJECT_FORBIDDEN, and REJECT_UNAUTHENTICATED.
// ============================================================

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import {
  evaluateRlsPolicy,
  injectRlsPredicate,
  enforceRlsOnAst,
  RLS_VERDICT
} from '../src/security/rls.policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const goldenPath = path.join(__dirname, 'golden/rls_policy_golden.json');
const testCases = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

console.log("==================================================");
console.log("    VERIFYING RLS POLICY GOLDEN CORPUS (D4)       ");
console.log("==================================================");

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  try {
    if (tc.testType === "sql_injection") {
      const injected = injectRlsPredicate(tc.sql, tc.predicate);
      assert.strictEqual(injected, tc.expectedSql, `SQL injection must match expected: got ${injected}`);
      console.log(`✅ [${tc.id}] PASS: ${tc.description}`);
      passed++;
      continue;
    }

    if (tc.tables) {
      // AST multi-table enforcement check
      const res = enforceRlsOnAst({
        tables: tc.tables,
        sql: "SELECT * FROM tabSalary Slip JOIN tabEmployee ON tabSalary Slip.employee = tabEmployee.name",
        identity: tc.identity,
        queryIntent: tc.queryIntent
      });
      assert.strictEqual(res.verdict, tc.expectedVerdict, `Expected verdict ${tc.expectedVerdict}, got ${res.verdict}`);
      if (tc.expectedError) {
        assert.strictEqual(res.error, tc.expectedError, `Expected error ${tc.expectedError}, got ${res.error}`);
      }
      console.log(`✅ [${tc.id}] PASS: ${tc.description}`);
      passed++;
      continue;
    }

    const res = evaluateRlsPolicy({
      tableName: tc.tableName,
      identity: tc.identity,
      queryIntent: tc.queryIntent,
      dialect: tc.dialect || 'mariadb'
    });

    assert.strictEqual(res.verdict, tc.expectedVerdict, `Expected verdict ${tc.expectedVerdict}, got ${res.verdict}`);
    if (tc.expectedError) {
      assert.strictEqual(res.error, tc.expectedError, `Expected error ${tc.expectedError}, got ${res.error}`);
    }
    if (tc.expectedPredicatePattern) {
      assert(res.injectedPredicate?.includes(tc.expectedPredicatePattern), `Predicate must include pattern: ${tc.expectedPredicatePattern}`);
    }

    console.log(`✅ [${tc.id}] PASS: ${tc.description}`);
    passed++;
  } catch (err) {
    console.error(`❌ [${tc.id}] FAIL: ${tc.description}`);
    console.error(`   ${err.message}`);
    failed++;
  }
}

console.log("==================================================");
console.log(`Summary: ${passed} passed, ${failed} failed (Total: ${testCases.length})`);
console.log("==================================================");

if (failed > 0) {
  console.error("❌ RLS POLICY GOLDEN CORPUS VERIFICATION FAILED");
  process.exit(1);
} else {
  console.log("🏆 ALL 20 RLS POLICY GOLDEN CASES PASSED (100% GREEN)!");
}
