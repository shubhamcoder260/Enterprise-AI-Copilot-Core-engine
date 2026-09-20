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
      { name: "product_id", type: "INTEGER", pk: true },
      { name: "name", type: "TEXT" },
      { name: "category", type: "TEXT" },
      { name: "price", type: "REAL" }
    ]
  },
  artists: {
    columns: [
      { name: "artist_id", type: "INTEGER", pk: true },
      { name: "name", type: "TEXT" },
      { name: "country", type: "TEXT" }
    ]
  },
  suppliers: {
    columns: [
      { name: "supplier_id", type: "INTEGER", pk: true },
      { name: "name", type: "TEXT" }
    ]
  },
  orders: {
    columns: [
      { name: "order_id", type: "INTEGER", pk: true },
      { name: "order_date", type: "TEXT" },
      { name: "total_amount", type: "REAL" }
    ]
  },
  albums: {
    columns: [
      { name: "album_id", type: "INTEGER", pk: true },
      { name: "artist_id", type: "INTEGER" },
      { name: "title", type: "TEXT" }
    ]
  },
  assignments: {
    columns: [
      { name: "emp_id", type: "INTEGER", pk: true },
      { name: "project_id", type: "INTEGER", pk: true },
      { name: "role_on_project", type: "TEXT" },
      { name: "hours_allocated", type: "INTEGER" }
    ]
  },
  playlist_track: {
    columns: [
      { name: "PlaylistId", type: "INTEGER", pk: true },
      { name: "TrackId", type: "INTEGER", pk: true }
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
assert(o16Ms < 10, `O16 violation: AST gate took ${o16Ms}ms (threshold: 10ms)`);
console.log("✅ PASS: O16 load_extension rejected structurally in < 10ms");

// 3. Function Whitelist Check
console.log("\n--- 3. Function Whitelist Check ---");
const allowedQueries = [
  "SELECT COUNT(*) FROM products",
  "SELECT SUM(price) FROM products",
  "SELECT AVG(price) FROM products",
  "SELECT MIN(price) FROM products",
  "SELECT MAX(price) FROM products",
  "SELECT ROUND(price, 2) FROM products",
  "SELECT LOWER(name) FROM products",
  "SELECT UPPER(name) FROM products"
];
for (const q of allowedQueries) {
  const r = validateAst(q, { schema: mockSchema });
  assert.strictEqual(r.valid, true, `Query "${q}" should be valid, got: ${r.reason}`);
}
console.log("✅ PASS: All whitelisted functions (COUNT, SUM, AVG, MIN, MAX, ROUND, LOWER, UPPER) pass.");

const disallowedQueries = [
  { q: "SELECT hex(name) FROM products", fn: "hex" },
  { q: "SELECT randomblob(16) FROM products", fn: "randomblob" },
  { q: "SELECT char(65) FROM products", fn: "char" }
];
for (const { q, fn } of disallowedQueries) {
  const r = validateAst(q, { schema: mockSchema });
  assert.strictEqual(r.valid, false, `Query "${q}" should be rejected`);
  assert.strictEqual(r.reason, `ast_disallowed_function:${fn}`);
}
console.log("✅ PASS: Disallowed functions (hex, randomblob, char) strictly rejected.");

// 4. Schema Existence Check (Tables and Columns)
console.log("\n--- 4. Schema Existence Check ---");
const ghostTableRes = validateAst("SELECT * FROM ghost_table", { schema: mockSchema });
assert.strictEqual(ghostTableRes.valid, false);
assert.strictEqual(ghostTableRes.reason, "ast_table_not_in_schema:ghost_table");
console.log("✅ PASS: Non-existent table 'ghost_table' rejected: " + ghostTableRes.reason);

const ghostColRes = validateAst("SELECT fake_column FROM products", { schema: mockSchema });
assert.strictEqual(ghostColRes.valid, false);
assert.strictEqual(ghostColRes.reason, "ast_column_not_in_schema:fake_column");
console.log("✅ PASS: Non-existent column 'fake_column' rejected: " + ghostColRes.reason);

// 5. Strict-Mode Bare-Column / Aggregate / GROUP-BY Matrix (6 Cases)
console.log("\n--- 5. Strict-Mode Bare-Column / Aggregate / GROUP-BY Matrix (6 Cases) ---");

// CASE 1: SELECT name, COUNT(*) FROM artists GROUP BY artist_id
// → now valid=TRUE (artist_id is PK; name FD-determined).
// PK-FD class — correct semantics (ONLY_FULL_GROUP_BY).
// Flip decided 2026-09-21 after live finding: this shape is the LLM's natural
// top-N idiom and pre-strict executed correctly.
console.log("\n[CASE 1: PK-FD Class — artist_id is PK, name is FD-determined]");
const c1Sql = "SELECT name, COUNT(*) FROM artists GROUP BY artist_id";
const c1Res = validateAst(c1Sql, { schema: mockSchema });
console.log(`  SQL   : ${c1Sql}`);
console.log(`  Result: valid=${c1Res.valid}, reason="${c1Res.reason || "none"}"`);
assert.strictEqual(c1Res.valid, true, "CASE 1 must pass under PK-FD (ONLY_FULL_GROUP_BY) semantics");
console.log("  ✅ PASS: CASE 1 accepted (PK-FD: artist_id is PK of artists)");

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

// NEW CASE 5: The TRUE silent-wrong class
// SELECT name, COUNT(*) FROM artists GROUP BY country → valid=FALSE
console.log("[CASE 5: Non-Key Grouping — country is not PK, name not grouped]");
const c5Sql = "SELECT name, COUNT(*) FROM artists GROUP BY country";
const c5Res = validateAst(c5Sql, { schema: mockSchema });
console.log(`  SQL   : ${c5Sql}`);
console.log(`  Result: valid=${c5Res.valid}, reason="${c5Res.reason}"`);
assert.strictEqual(c5Res.valid, false, "CASE 5 must be rejected (country is not PK)");
assert.strictEqual(c5Res.reason, "ast_bare_column_without_group_by:name");
console.log("  ✅ PASS: CASE 5 rejected (country is not PK, name not grouped)\n");

// NEW CASE 6: Qualified FD, P3.2 Turn 1's exact shape
// SELECT artists.name, COUNT(*) FROM artists GROUP BY artists.artist_id → valid=TRUE
console.log("[CASE 6: Qualified PK-FD — artists.name with GROUP BY artists.artist_id]");
const c6Sql = "SELECT artists.name, COUNT(*) FROM artists GROUP BY artists.artist_id";
const c6Res = validateAst(c6Sql, { schema: mockSchema });
console.log(`  SQL   : ${c6Sql}`);
console.log(`  Result: valid=${c6Res.valid}, reason="${c6Res.reason || "none"}"`);
assert.strictEqual(c6Res.valid, true, "CASE 6 must pass (qualified PK-FD)");
console.log("  ✅ PASS: CASE 6 accepted (qualified PK-FD)\n");

// Expression & Subquery Edge Cases
console.log("[CASE 7: Expression & Ordinal GROUP BY Verification]");
const c7aSql = "SELECT strftime('%Y', order_date), COUNT(*) FROM orders GROUP BY strftime('%Y', order_date)";
const c7aRes = validateAst(c7aSql, { schema: mockSchema });
assert.strictEqual(c7aRes.valid, true, "CASE 7a: matching expression in GROUP BY must pass");

const c7bSql = "SELECT strftime('%Y', order_date), COUNT(*) FROM orders GROUP BY 1";
const c7bRes = validateAst(c7bSql, { schema: mockSchema });
assert.strictEqual(c7bRes.valid, true, "CASE 7b: ordinal GROUP BY 1 on expression must pass");

const c7cSql = "SELECT order_date, COUNT(*) FROM orders GROUP BY strftime('%Y', order_date)";
const c7cRes = validateAst(c7cSql, { schema: mockSchema });
assert.strictEqual(c7cRes.valid, false, "CASE 7c: bare column with non-matching GROUP BY expression must be rejected");
assert.strictEqual(c7cRes.reason, "ast_bare_column_without_group_by:order_date");
console.log("  ✅ PASS: CASE 7 expression & ordinal GROUP BY invariants verified\n");

console.log("[CASE 8: Subquery Table & Derived Table Join Verification]");
const c8aSql = "SELECT * FROM (SELECT * FROM nonexistent_table)";
const c8aRes = validateAst(c8aSql, { schema: mockSchema });
assert.strictEqual(c8aRes.valid, false, "CASE 8a: table inside subquery must be validated against schema");
assert.strictEqual(c8aRes.reason, "ast_table_not_in_schema:nonexistent_table");

const c8bSql = "SELECT a.name, s.total FROM artists a JOIN (SELECT artist_id, COUNT(*) AS total FROM albums GROUP BY artist_id) s ON a.artist_id = s.artist_id";
const c8bRes = validateAst(c8bSql, { schema: mockSchema });
assert.strictEqual(c8bRes.valid, true, "CASE 8b: derived table subquery join must be recognized without false column error");
console.log("  ✅ PASS: CASE 8 subquery table & derived table join verified\n");

console.log("[CASE 9: Composite Primary Key Functional Dependency Verification]");
// 9a: Grouping on only one column of a composite key must REJECT bare non-key column
const c9aSql = "SELECT role_on_project, SUM(hours_allocated) FROM assignments GROUP BY emp_id";
const c9aRes = validateAst(c9aSql, { schema: mockSchema });
console.log(`  SQL (partial PK) : ${c9aSql}`);
console.log(`  Result           : valid=${c9aRes.valid}, reason="${c9aRes.reason}"`);
assert.strictEqual(c9aRes.valid, false, "CASE 9a: partial composite PK grouping must be rejected");
assert.strictEqual(c9aRes.reason, "ast_bare_column_without_group_by:role_on_project");
console.log("  ✅ PASS: CASE 9a rejected (partial composite PK grouping lacks functional dependency)");

// 9b: Grouping on ALL columns of a composite key must ACCEPT bare non-key column
const c9bSql = "SELECT role_on_project, SUM(hours_allocated) FROM assignments GROUP BY emp_id, project_id";
const c9bRes = validateAst(c9bSql, { schema: mockSchema });
console.log(`  SQL (full PK)    : ${c9bSql}`);
console.log(`  Result           : valid=${c9bRes.valid}, reason="${c9bRes.reason || "none"}"`);
assert.strictEqual(c9bRes.valid, true, "CASE 9b: full composite PK grouping must be accepted under PK-FD");
console.log("  ✅ PASS: CASE 9b accepted (full composite PK [emp_id, project_id] in GROUP BY)");

// 9c: chinook-style all-PK junction table: grouping on only one PK column while projecting the other must REJECT
const c9cSql = "SELECT TrackId, COUNT(*) FROM playlist_track GROUP BY PlaylistId";
const c9cRes = validateAst(c9cSql, { schema: mockSchema });
console.log(`  SQL (playlist_track partial PK): ${c9cSql}`);
console.log(`  Result                         : valid=${c9cRes.valid}, reason="${c9cRes.reason}"`);
assert.strictEqual(c9cRes.valid, false, "CASE 9c: grouping on PlaylistId alone must reject bare TrackId");
assert.strictEqual(c9cRes.reason, "ast_bare_column_without_group_by:TrackId");
console.log("  ✅ PASS: CASE 9c rejected (TrackId is not in GROUP BY and only half of composite PK is grouped)");

// 9d: chinook-style all-PK junction table: grouping on BOTH PK columns must ACCEPT
const c9dSql = "SELECT TrackId, COUNT(*) FROM playlist_track GROUP BY PlaylistId, TrackId";
const c9dRes = validateAst(c9dSql, { schema: mockSchema });
console.log(`  SQL (playlist_track full PK)   : ${c9dSql}`);
console.log(`  Result                         : valid=${c9dRes.valid}, reason="${c9dRes.reason || "none"}"`);
assert.strictEqual(c9dRes.valid, true, "CASE 9d: grouping on full composite PK [PlaylistId, TrackId] must be accepted");
console.log("  ✅ PASS: CASE 9d accepted (full composite PK [PlaylistId, TrackId] in GROUP BY)\n");

console.log("==================================================");
console.log("🎉 ALL STEP 2 (A2) AST GATE ASSERTIONS PASSED!    ");
console.log("==================================================");
