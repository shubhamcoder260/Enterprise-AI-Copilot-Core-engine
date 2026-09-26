// ============================================================
// FAST INTENT MULTI-DIALECT BATTERY (RE-PIN #5 VERIFICATION)
// Verifies multi-dialect quoting, ratio/percentage, time-windows,
// and explicit docstatus = 1 injection for MariaDB (Item 3).
// ============================================================

import assert from 'assert';
import { tryRoute, compile } from '../src/core/fastIntent.js';

console.log("==================================================");
console.log("   FAST INTENT MULTI-DIALECT (RE-PIN #5) TESTS    ");
console.log("==================================================");

// Multi-Dialect Schemas
const erpMariaSchema = {
  tables: [
    {
      name: "tabSales Invoice",
      columns: [
        { name: "name", type: "VARCHAR", pk: true },
        { name: "customer", type: "VARCHAR" },
        { name: "posting_date", type: "DATE" },
        { name: "grand_total", type: "DECIMAL" },
        { name: "docstatus", type: "INT" }
      ]
    },
    {
      name: "tabCustomer",
      columns: [
        { name: "name", type: "VARCHAR", pk: true },
        { name: "customer_name", type: "VARCHAR" },
        { name: "disabled", type: "INT" }
      ]
    }
  ]
};

const pgSchema = {
  tables: [
    {
      name: "orders",
      columns: [
        { name: "order_id", type: "INTEGER", pk: true },
        { name: "customer_id", type: "INTEGER" },
        { name: "order_date", type: "DATE" },
        { name: "total_amount", type: "NUMERIC" }
      ]
    }
  ]
};

const mockDistinct = {
  "tabSales Invoice": [
    { column: "customer", value: "Acme Corp" }
  ],
  "tabCustomer": [
    { column: "customer_name", value: "Acme Corp" }
  ],
  orders: [
    { column: "customer_id", value: "101" }
  ]
};

const mariaDeps = {
  getSchema: () => erpMariaSchema,
  getDistinct: (table) => mockDistinct[table] || [],
  isLongFormat: () => false,
  dialect: "mariadb"
};

const pgDeps = {
  getSchema: () => pgSchema,
  getDistinct: (table) => mockDistinct[table] || [],
  isLongFormat: () => false,
  dialect: "postgres"
};

// ----------------------------------------------------
// TEST 1: MariaDB docstatus = 1 injection & backtick quoting (Item 3)
// ----------------------------------------------------
console.log("\n[1] Verifying MariaDB docstatus = 1 automatic injection & backtick quoting...");
const q1 = "total sales invoice in 2024";
const res1 = tryRoute(q1, mariaDeps, "mariadb");

assert(res1, "tryRoute must match total sales invoice in 2024");
console.log("  Generated SQL:    ", res1.sql);
console.log("  Generated Params: ", JSON.stringify(res1.params));

// Assert backtick quoting
assert(res1.sql.includes("`tabSales Invoice`"), "Must quote table with backticks in MariaDB mode");
assert(res1.sql.includes("`posting_date` >="), "Must quote date column with backticks");

// Explicit assertion on docstatus = 1 presence (Item 3 review requirement)
assert(res1.sql.includes("`docstatus` = ?"), "Generated SQL must explicitly include `docstatus` = ? predicate");
assert(res1.params.includes(1), "Params must include 1 for docstatus filter");

// Assert date range bounds
assert(res1.params.includes("2024-01-01"), "Params must include 2024-01-01");
assert(res1.params.includes("2025-01-01"), "Params must include 2025-01-01");
console.log("  ✅ MariaDB docstatus = 1 auto-injection and temporal range verified");

// ----------------------------------------------------
// TEST 2: MariaDB Ratio / Percentage calculation
// ----------------------------------------------------
console.log("\n[2] Verifying MariaDB ratio / percentage calculation...");
const tableMaria = erpMariaSchema.tables[0];
const filtersMaria = [
  { column: "customer", op: "=", value: "Acme Corp" },
  { column: "docstatus", op: "=", value: 1 }
];
const actPercentage = { type: "percentage" };
const compileResMaria = compile(actPercentage, tableMaria, filtersMaria, "mariadb");

console.log("  Compiled Percentage SQL: ", compileResMaria.sql);
assert(compileResMaria.sql.startsWith("SELECT ROUND((SELECT COUNT(*) FROM `tabSales Invoice` WHERE `customer` = ? AND `docstatus` = ?) * 100.0 / COUNT(*), 2) AS result FROM `tabSales Invoice`"),
  "Percentage SQL must format correctly with MariaDB backticks and docstatus filter");
assert.strictEqual(compileResMaria.params[0], "Acme Corp");
assert.strictEqual(compileResMaria.params[1], 1);
console.log("  ✅ MariaDB ratio/percentage compilation verified");

// ----------------------------------------------------
// TEST 3: PostgreSQL Quoting & Time-Window
// ----------------------------------------------------
console.log("\n[3] Verifying PostgreSQL quoting and time-window filtering...");
const q3 = "count orders in 2024";
const res3 = tryRoute(q3, pgDeps, "postgres");

assert(res3, "tryRoute must match count orders in 2024 on postgres");
console.log("  Postgres SQL:    ", res3.sql);
console.log("  Postgres Params: ", JSON.stringify(res3.params));

assert(res3.sql.includes("\"orders\""), "Must quote table with double quotes in Postgres");
assert(res3.sql.includes("\"order_date\" >="), "Must quote date column with double quotes in Postgres");
assert(res3.params.includes("2024-01-01"), "Postgres params must include 2024-01-01");
assert(res3.params.includes("2025-01-01"), "Postgres params must include 2025-01-01");
console.log("  ✅ PostgreSQL quoting and time-window verified");

// ----------------------------------------------------
// TEST 4: PostgreSQL Percentage Query
// ----------------------------------------------------
console.log("\n[4] Verifying PostgreSQL ratio / percentage calculation...");
const tablePg = pgSchema.tables[0];
const filtersPg = [{ column: "customer_id", op: "=", value: 101 }];
const compileResPg = compile(actPercentage, tablePg, filtersPg, "postgres");

console.log("  Postgres Percentage SQL: ", compileResPg.sql);
assert(compileResPg.sql.includes("\"orders\""), "Postgres percentage query must use double quotes");
assert.strictEqual(compileResPg.params[0], 101);
console.log("  ✅ PostgreSQL ratio/percentage compilation verified");

console.log("\n==================================================");
console.log("🏆 ALL FAST INTENT MULTI-DIALECT TESTS PASSED!");
console.log("==================================================");
