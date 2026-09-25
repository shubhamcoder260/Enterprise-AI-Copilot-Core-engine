import assert from 'assert';
import pkg from 'node-sql-parser';
const { Parser } = pkg;
import { DIALECTS, getDialect, deepFreeze } from '../src/adapters/dialects/index.js';

console.log("==================================================");
console.log("       STEP 3 — VERIFYING DIALECT ENGINE          ");
console.log("==================================================");

// 1. Check Dialects presence
console.log("\n[1] Checking dialect registry definitions...");
assert(DIALECTS.sqlite, "sqlite dialect must exist");
assert(DIALECTS.mariadb, "mariadb dialect must exist");
assert(DIALECTS.postgres, "postgres dialect must exist");
console.log("  ✅ All 3 dialects present in registry");

// 2. Immutability via deepFreeze
console.log("\n[2] Checking deepFreeze immutability...");
assert(Object.isFrozen(DIALECTS), "DIALECTS root must be frozen");
assert(Object.isFrozen(DIALECTS.mariadb), "DIALECTS.mariadb must be frozen");
assert.throws(() => {
  DIALECTS.mariadb.newProperty = "illegal";
}, /Cannot add property|TypeError/, "Adding property must throw TypeError");
console.log("  ✅ deepFreeze immutability confirmed");

// 3. Lookup helper case-insensitivity & null fallback
console.log("\n[3] Checking getDialect helper...");
assert.strictEqual(getDialect("MARIADB").dialect, "mariadb");
assert.strictEqual(getDialect("Sqlite").dialect, "sqlite");
assert.strictEqual(getDialect("nonexistent_dialect"), null);
assert.strictEqual(getDialect(null), null);
console.log("  ✅ getDialect case-insensitivity and null fallback verified");

// 4. Quoting and Dialect Specifics
console.log("\n[4] Checking quoting behavior...");
assert.strictEqual(DIALECTS.sqlite.quote("my_table"), '"my_table"');
assert.strictEqual(DIALECTS.mariadb.quote("tabSales Invoice"), '`tabSales Invoice`');
assert.strictEqual(DIALECTS.mariadb.collateNOCASE, false);
assert.strictEqual(DIALECTS.sqlite.collateNOCASE, true);
console.log("  ✅ Quoting rules & collation invariants verified");

// 5. node-sql-parser smoke test in MariaDB mode
console.log("\n[5] node-sql-parser MariaDB grammar smoke test...");
const parser = new Parser();
const ast = parser.astify("SELECT `name`, `grand_total` FROM `tabSales Invoice` WHERE `docstatus` = 1", {
  database: "mariadb"
});
assert.strictEqual(ast.type, "select");
assert.strictEqual(ast.from[0].table, "tabSales Invoice");
console.log("  ✅ MariaDB backtick grammar round-tripped cleanly through AST parser");

console.log("\n==================================================");
console.log("🏆 ALL DIALECT ENGINE TESTS PASSED CLEANLY!");
console.log("==================================================");
