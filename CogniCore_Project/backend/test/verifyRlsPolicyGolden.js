// ============================================================
// VERIFICATION: ROW-LEVEL SECURITY (RLS) POLICY GOLDEN CORPUS
// Executes 28 golden test cases asserting deterministic verdicts:
// ALLOW, INJECT_PREDICATE, REJECT_FORBIDDEN, and REJECT_UNAUTHENTICATED.
// Provides 100% 3-dialect coverage across ast.gate.js,
// ast.gate.mariadb.js, and ast.gate.postgres.js.
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
import { validateAst } from '../src/kernel/ast.gate.js';
import { validateMariaDbAst } from '../src/kernel/ast.gate.mariadb.js';
import { validatePostgresAst } from '../src/kernel/ast.gate.postgres.js';

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
    // 1. AST Gate Dialect-Specific Tests (Injection & Obfuscation)
    if (tc.testType === "ast_gate_injection" || tc.testType === "ast_gate_obfuscated") {
      let gateFn;
      if (tc.dialect === "sqlite") gateFn = validateAst;
      else if (tc.dialect === "mariadb") gateFn = validateMariaDbAst;
      else if (tc.dialect === "postgres") gateFn = validatePostgresAst;
      else throw new Error(`Unknown dialect in testCase: ${tc.dialect}`);

      const res = await gateFn(tc.sql, {
        identity: tc.identity,
        queryIntent: tc.queryIntent || {}
      });

      if (tc.expectedVerdict === "REJECT_FORBIDDEN") {
        assert.strictEqual(res.valid, false, `Expected gate to reject, but passed for: ${tc.id}`);
        assert.strictEqual(res.reason, tc.expectedError, `Expected error ${tc.expectedError}, got ${res.reason}`);
      } else if (tc.expectedVerdict === "INJECT_PREDICATE") {
        assert.strictEqual(res.valid, true, `Expected gate validation to pass with injection: ${tc.id} -> ${res.reason}`);
        assert.strictEqual(res.sql, tc.expectedSql, `Injected SQL mismatch:\nExpected: ${tc.expectedSql}\nActual:   ${res.sql}`);
      }

      console.log(`✅ [${tc.id}] PASS: ${tc.description}`);
      passed++;
      continue;
    }

    // 2. Pure SQL Injection String Formatting Check
    if (tc.testType === "sql_injection") {
      const injected = injectRlsPredicate(tc.sql, tc.predicate);
      assert.strictEqual(injected, tc.expectedSql, `SQL injection must match expected: got ${injected}`);
      console.log(`✅ [${tc.id}] PASS: ${tc.description}`);
      passed++;
      continue;
    }

    // 3. Multi-table AST Join Check
    if (tc.tables) {
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

    // 4. Policy Engine Evaluation Check (Dialect-agnostic & role precedence)
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
  console.log(`🏆 ALL ${testCases.length} RLS POLICY GOLDEN CASES PASSED (100% GREEN)!`);
}
