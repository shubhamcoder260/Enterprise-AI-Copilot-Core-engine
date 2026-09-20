// ==========================================
// TEST: AST GATE (LAYER 1.5 IN GATE CHAIN)
// Tests:
//   1. Function Whitelist enforcement
//   2. Schema existence (tables & columns)
//   3. Bare-column / aggregate / GROUP-BY rule (S1-LLM acceptance test)
//   4. O16 measurement (load_extension rejection latency)
// ==========================================

import { validateAst, ALLOWED_FUNCTIONS } from "../src/kernel/ast.gate.js";
import { GATE_CHAIN } from "../src/kernel/gate.chain.js";
import assert from "assert";

const mockSchema = {
  products: {
    columns: [
      { name: "product_id", type: "INTEGER" },
      { name: "name", type: "TEXT" },
      { name: "category", type: "TEXT" },
      { name: "price", type: "REAL" }
    ]
  },
  suppliers: {
    columns: [
      { name: "supplier_id", type: "INTEGER" },
      { name: "name", type: "TEXT" }
    ]
  }
};

console.log("==================================================");
console.log("       STEP 2 (A2) — AST GATE VERIFICATION        ");
console.log("==================================================\n");

// 1. Check GATE_CHAIN order: [validator, ast, readonly-executor]
console.log("--- 1. GATE_CHAIN Slot Order Check ---");
assert.strictEqual(GATE_CHAIN.length, 3, "GATE_CHAIN must have exactly 3 gates");
assert.strictEqual(GATE_CHAIN[0].name, "validator", "Position 0 must be frozen Layer 1 validator");
assert.strictEqual(GATE_CHAIN[1].name, "ast", "Position 1 must be AST gate");
assert.strictEqual(GATE_CHAIN[2].name, "readonly-executor", "Position 2 must be readonly-executor");
console.log("✅ PASS: GATE_CHAIN slot order: [validator, ast, readonly-executor]\n");

// 2. O16 Measurement: load_extension rejection
console.log("--- 2. O16 Measurement: Disallowed Function (load_extension) ---");
// Warm up parser
for (let i = 0; i < 5; i++) {
  validateAst("SELECT load_extension('warmup')", { schema: mockSchema });
}

const t0 = performance.now();
const o16Res = validateAst("SELECT load_extension('evil')", { schema: mockSchema });
const o16Ms = performance.now() - t0;
console.log(`Input   : SELECT load_extension('evil')`);
console.log(`Result  : valid=${o16Res.valid}, reason="${o16Res.reason}"`);
console.log(`Latency : ${o16Ms.toFixed(3)}ms (warmed AST parse & walk)`);
assert.strictEqual(o16Res.valid, false, "load_extension must be rejected");
assert.strictEqual(o16Res.reason, "ast_disallowed_function:load_extension");
assert(o16Ms < 10.0, "O16 rejection must execute in < 10ms (warmed)");
console.log("✅ PASS: O16 load_extension rejected structurally in < 10ms\n");

// 3. Function Whitelist: Allowed vs Disallowed
console.log("--- 3. Function Whitelist Check ---");
const allowedQueries = [
  "SELECT COUNT(*) FROM products",
  "SELECT SUM(price) FROM products",
  "SELECT AVG(price) FROM products",
  "SELECT MIN(price), MAX(price) FROM products",
  "SELECT ROUND(AVG(price), 2) FROM products",
  "SELECT LOWER(name), UPPER(category) FROM products"
];

for (const q of allowedQueries) {
  const r = validateAst(q, { schema: mockSchema });
  assert.strictEqual(r.valid, true, `Allowed query should pass: ${q}, got reason: ${r.reason}`);
}
console.log("✅ PASS: All whitelisted functions (COUNT, SUM, AVG, MIN, MAX, ROUND, LOWER, UPPER) pass.");

const disallowedQueries = [
  { sql: "SELECT hex('abc') FROM products", func: "hex" },
  { sql: "SELECT randomblob(16) FROM products", func: "randomblob" },
  { sql: "SELECT char(65) FROM products", func: "char" }
];

for (const item of disallowedQueries) {
  const r = validateAst(item.sql, { schema: mockSchema });
  assert.strictEqual(r.valid, false, `Disallowed query should fail: ${item.sql}`);
  assert.strictEqual(r.reason, `ast_disallowed_function:${item.func}`);
}
console.log("✅ PASS: Disallowed functions (hex, randomblob, char) strictly rejected.\n");

// 4. Schema Existence Check (Tables & Columns)
console.log("--- 4. Schema Existence Check ---");
const ghostTableRes = validateAst("SELECT * FROM ghost_table", { schema: mockSchema });
assert.strictEqual(ghostTableRes.valid, false);
assert.strictEqual(ghostTableRes.reason, "ast_table_not_in_schema:ghost_table");
console.log("✅ PASS: Non-existent table 'ghost_table' rejected: " + ghostTableRes.reason);

const ghostColRes = validateAst("SELECT fake_column FROM products", { schema: mockSchema });
assert.strictEqual(ghostColRes.valid, false);
assert.strictEqual(ghostColRes.reason, "ast_column_not_in_schema:fake_column");
console.log("✅ PASS: Non-existent column 'fake_column' rejected: " + ghostColRes.reason + "\n");

// 5. Strict-Mode Bare-Column / Aggregate / GROUP-BY Rule (S1-LLM Acceptance Specimen)
console.log("--- 5. S1-LLM Acceptance Specimen: Bare-Column without GROUP-BY ---");
const s1BadSql = 'SELECT "category", AVG("price") AS average_price FROM "products" ORDER BY "price" DESC LIMIT 50';
console.log(`Testing S1-LLM Flawed SQL:\n  ${s1BadSql}`);
const s1BadRes = validateAst(s1BadSql, { schema: mockSchema });
console.log(`Result: valid=${s1BadRes.valid}, reason="${s1BadRes.reason}"`);
assert.strictEqual(s1BadRes.valid, false, "Bare column 'category' without GROUP BY must be rejected");
assert.strictEqual(s1BadRes.reason, "ast_bare_column_without_group_by:category");
console.log("✅ PASS: S1-LLM flawed SQL rejected by AST Gate: ast_bare_column_without_group_by:category");

const s1GoodSql = 'SELECT "category", AVG("price") AS average_price FROM "products" GROUP BY "category" ORDER BY average_price DESC LIMIT 50';
console.log(`\nTesting S1 Valid SQL (with GROUP BY):\n  ${s1GoodSql}`);
const s1GoodRes = validateAst(s1GoodSql, { schema: mockSchema });
console.log(`Result: valid=${s1GoodRes.valid}, reason="${s1GoodRes.reason || "none"}"`);
assert.strictEqual(s1GoodRes.valid, true, "Valid SQL with GROUP BY must pass AST Gate");
console.log("✅ PASS: S1 valid SQL with matching GROUP BY accepted by AST Gate.\n");

console.log("==================================================");
console.log("🎉 ALL STEP 2 (A2) AST GATE ASSERTIONS PASSED!    ");
console.log("==================================================");
