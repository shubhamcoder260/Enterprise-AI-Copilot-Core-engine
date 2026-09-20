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
  artists: {
    columns: [
      { name: "artist_id", type: "INTEGER" },
      { name: "name", type: "TEXT" }
    ]
  },
  suppliers: {
    columns: [
      { name: "supplier_id", type: "INTEGER" },
      { name: "name", type: "TEXT" }
    ]
  },
  orders: {
    columns: [
      { name: "order_id", type: "INTEGER" },
      { name: "order_date", type: "TEXT" },
      { name: "total_amount", type: "REAL" }
    ]
  },
  albums: {
    columns: [
      { name: "album_id", type: "INTEGER" },
      { name: "artist_id", type: "INTEGER" },
      { name: "title", type: "TEXT" }
    ]
  }
};

console.log("==================================================");
console.log("       STEP 2 (A2) — AST GATE VERIFICATION        ");
console.log("==================================================");

// 1. Check GATE_CHAIN order: [validator, ast, readonly-executor]
console.log("\n--- 1. GATE_CHAIN Slot Order Check ---");
assert.strictEqual(GATE_CHAIN.length, 3, "GATE_CHAIN must have exactly 3 gates");
assert.strictEqual(GATE_CHAIN[0].name, "validator", "Position 0 must be frozen Layer 1 validator");
assert.strictEqual(GATE_CHAIN[1].name, "ast", "Position 1 must be AST gate");
assert.strictEqual(GATE_CHAIN[2].name, "readonly-executor", "Position 2 must be readonly-executor");
console.log("✅ PASS: GATE_CHAIN slot order: [validator, ast, readonly-executor]");

// 2. O16 Measurement: load_extension rejection
console.log("\n--- 2. O16 Measurement: Disallowed Function (load_extension) ---");
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
console.log("✅ PASS: O16 load_extension rejected structurally in < 10ms");

// 3. Function Whitelist: Allowed vs Disallowed
console.log("\n--- 3. Function Whitelist Check ---");
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
console.log("✅ PASS: Disallowed functions (hex, randomblob, char) strictly rejected.");

// 4. Schema Existence Check (Tables & Columns)
console.log("\n--- 4. Schema Existence Check ---");
const ghostTableRes = validateAst("SELECT * FROM ghost_table", { schema: mockSchema });
assert.strictEqual(ghostTableRes.valid, false);
assert.strictEqual(ghostTableRes.reason, "ast_table_not_in_schema:ghost_table");
console.log("✅ PASS: Non-existent table 'ghost_table' rejected: " + ghostTableRes.reason);

const ghostColRes = validateAst("SELECT fake_column FROM products", { schema: mockSchema });
assert.strictEqual(ghostColRes.valid, false);
assert.strictEqual(ghostColRes.reason, "ast_column_not_in_schema:fake_column");
console.log("✅ PASS: Non-existent column 'fake_column' rejected: " + ghostColRes.reason);

// 5. Strict-Mode Bare-Column / Aggregate / GROUP-BY Matrix (4 Cases)
console.log("\n--- 5. Strict-Mode Bare-Column / Aggregate / GROUP-BY Matrix ---");

// CASE 1: SELECT name, COUNT(*) FROM artists GROUP BY artist_id
// → valid=FALSE (name-strict: artist_id ≠ name) [this is the S14 class]
console.log("\n[CASE 1: S14 Class — Mismatched Column / ID Grouping]");
const c1Sql = "SELECT name, COUNT(*) FROM artists GROUP BY artist_id";
const c1Res = validateAst(c1Sql, { schema: mockSchema });
console.log(`  SQL   : ${c1Sql}`);
console.log(`  Result: valid=${c1Res.valid}, reason="${c1Res.reason}"`);
assert.strictEqual(c1Res.valid, false, "CASE 1 must be rejected under column-name strict mode");
assert.strictEqual(c1Res.reason, "ast_bare_column_without_group_by:name");
console.log("  ✅ PASS: CASE 1 rejected (name-strict: artist_id ≠ name)");

// CASE 2: SELECT category, AVG(price) FROM products GROUP BY category
// → valid=TRUE
console.log("\n[CASE 2: Valid Grouping — Projected Bare Column in GROUP BY]");
const c2Sql = "SELECT category, AVG(price) FROM products GROUP BY category";
const c2Res = validateAst(c2Sql, { schema: mockSchema });
console.log(`  SQL   : ${c2Sql}`);
console.log(`  Result: valid=${c2Res.valid}, reason="${c2Res.reason || "none"}"`);
assert.strictEqual(c2Res.valid, true, "CASE 2 must pass under column-name strict mode");
console.log("  ✅ PASS: CASE 2 accepted");

// CASE 3: SELECT "category", AVG("price") FROM "products" ORDER BY "price" DESC LIMIT 50 (no GROUP BY)
// → valid=FALSE, reason=ast_bare_column_without_group_by
console.log("\n[CASE 3: S1-LLM Specimen — Aggregate + Bare Column with No GROUP BY]");
const c3Sql = 'SELECT "category", AVG("price") AS average_price FROM "products" ORDER BY "price" DESC LIMIT 50';
const c3Res = validateAst(c3Sql, { schema: mockSchema });
console.log(`  SQL   : ${c3Sql}`);
console.log(`  Result: valid=${c3Res.valid}, reason="${c3Res.reason}"`);
assert.strictEqual(c3Res.valid, false, "CASE 3 must be rejected (no GROUP BY)");
assert.strictEqual(c3Res.reason, "ast_bare_column_without_group_by:category");
console.log("  ✅ PASS: CASE 3 rejected (ast_bare_column_without_group_by:category)");

// CASE 4: Regression for double-quoted column candidates in schema check
// SELECT "fake_column" FROM products → valid=FALSE
console.log("\n[CASE 4: Parser Regression — double_quote_string Schema Existence]");
const c4Sql = 'SELECT "fake_column" FROM products';
const c4Res = validateAst(c4Sql, { schema: mockSchema });
console.log(`  SQL   : ${c4Sql}`);
console.log(`  Result: valid=${c4Res.valid}, reason="${c4Res.reason}"`);
assert.strictEqual(c4Res.valid, false, "CASE 4 must be rejected (fake_column not in schema)");
assert.strictEqual(c4Res.reason, "ast_column_not_in_schema:fake_column");
console.log("  ✅ PASS: CASE 4 rejected (ast_column_not_in_schema:fake_column)\n");

// CASE 5: Expression GROUP BY and Ordinal GROUP BY
console.log("[CASE 5: Expression & Ordinal GROUP BY Verification]");
const c5aSql = "SELECT strftime('%Y', order_date), COUNT(*) FROM orders GROUP BY strftime('%Y', order_date)";
const c5aRes = validateAst(c5aSql, { schema: mockSchema });
assert.strictEqual(c5aRes.valid, true, "CASE 5a: matching expression in GROUP BY must pass");

const c5bSql = "SELECT strftime('%Y', order_date), COUNT(*) FROM orders GROUP BY 1";
const c5bRes = validateAst(c5bSql, { schema: mockSchema });
assert.strictEqual(c5bRes.valid, true, "CASE 5b: ordinal GROUP BY 1 on expression must pass");

const c5cSql = "SELECT order_date, COUNT(*) FROM orders GROUP BY strftime('%Y', order_date)";
const c5cRes = validateAst(c5cSql, { schema: mockSchema });
assert.strictEqual(c5cRes.valid, false, "CASE 5c: bare column with non-matching GROUP BY expression must be rejected");
assert.strictEqual(c5cRes.reason, "ast_bare_column_without_group_by:order_date");
console.log("  ✅ PASS: CASE 5 expression & ordinal GROUP BY invariants verified\n");

// CASE 6: Subquery Schema & Derived Table Aliases
console.log("[CASE 6: Subquery Table & Derived Table Join Verification]");
const c6aSql = "SELECT * FROM (SELECT * FROM nonexistent_table)";
const c6aRes = validateAst(c6aSql, { schema: mockSchema });
assert.strictEqual(c6aRes.valid, false, "CASE 6a: table inside subquery must be validated against schema");
assert.strictEqual(c6aRes.reason, "ast_table_not_in_schema:nonexistent_table");

const c6bSql = "SELECT a.name, s.total FROM artists a JOIN (SELECT artist_id, COUNT(*) AS total FROM albums GROUP BY artist_id) s ON a.artist_id = s.artist_id";
const c6bRes = validateAst(c6bSql, { schema: mockSchema });
assert.strictEqual(c6bRes.valid, true, "CASE 6b: derived table subquery join must be recognized without false column error");
console.log("  ✅ PASS: CASE 6 subquery table & derived table join verified\n");

console.log("==================================================");
console.log("🎉 ALL STEP 2 (A2) AST GATE ASSERTIONS PASSED!    ");
console.log("==================================================");

