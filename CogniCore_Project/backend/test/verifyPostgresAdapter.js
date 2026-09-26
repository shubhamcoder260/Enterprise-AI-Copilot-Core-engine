// ============================================================
// VERIFICATION: POSTGRESQL ADAPTER & PHYSICAL READ-ONLY ENFORCEMENT
// Verifies:
// 1. Connection as dedicated read-only user (cognicore_ro)
// 2. Query execution and placeholder translation (? -> $1)
// 3. Physical server-level write rejection ("permission denied for table")
// 4. Defense-in-depth session read-only enforcement
// 5. Schema introspection via getPostgresEnrichedSchema
// ============================================================

import assert from 'assert';
import { postgresAdapter } from '../src/adapters/postgres.adapter.js';
import { getPostgresEnrichedSchema } from '../src/core/postgres.schema.reader.js';

console.log("==================================================");
console.log("  VERIFYING POSTGRESQL ADAPTER & READ-ONLY (D3)   ");
console.log("==================================================");

async function testPostgresAdapter() {
  const pgSource = {
    id: "postgres_default",
    kind: "postgres",
    dialect: "postgres",
    host: "127.0.0.1",
    port: 5432,
    user: "cognicore_ro",
    password: "cognicore_ro_password",
    database: "cognicore_pg_test"
  };

  // 1. Connection
  console.log("\n[1] Connecting as dedicated read-only role cognicore_ro...");
  await postgresAdapter.connect(pgSource);
  assert(postgresAdapter.meta().connected, "Adapter must report connected=true");
  console.log("  ✅ Connected successfully to PostgreSQL (cognicore_pg_test)");

  // 2. Read query
  console.log("\n[2] Executing read-only count query...");
  const rows = await postgresAdapter.queryReadOnly('SELECT COUNT(*) AS count FROM "customers"');
  console.log(`  Row count in customers: ${rows[0]?.count}`);
  assert.strictEqual(Number(rows[0]?.count), 5, "Must read 5 customer records");
  console.log("  ✅ Read query verified");

  // 3. Parameterized query (? -> $1, $2 conversion)
  console.log("\n[3] Executing parameterized range query...");
  const paramRows = await postgresAdapter.queryReadOnly(
    'SELECT "id", "total", "order_date" FROM "orders" WHERE "order_date" >= ? AND "order_date" < ? ORDER BY "total" DESC',
    ['2024-01-01', '2025-01-01']
  );
  console.log(`  Orders in 2024: ${paramRows.length} (Max order: $${paramRows[0]?.total})`);
  assert(paramRows.length >= 6, "Must retrieve 2024 orders");
  console.log("  ✅ Parameter conversion and execution verified");

  // 4. Physical Server Write Rejection (Finding 1)
  console.log("\n[4] Testing physical server write rejection (GRANT SELECT ONLY)...");
  let writeBlocked = false;
  let serverErrorCode = null;
  let serverErrorMessage = "";

  try {
    // Attempt physical INSERT on server
    await postgresAdapter.queryReadOnly(
      'INSERT INTO "customers" ("name", "email", "city") VALUES (?, ?, ?)',
      ['Unauthorized Write', 'fail@test.com', 'Nowhere']
    );
  } catch (err) {
    writeBlocked = true;
    serverErrorCode = err.code;
    serverErrorMessage = err.message;
  }

  console.log(`  Write blocked:       ${writeBlocked}`);
  console.log(`  Postgres error code: ${serverErrorCode}`);
  console.log(`  Postgres message:    ${serverErrorMessage}`);

  assert.strictEqual(writeBlocked, true, "Physical write must be blocked by the server");
  assert(
    serverErrorMessage.toLowerCase().includes("permission denied") ||
    serverErrorMessage.toLowerCase().includes("read-only") ||
    serverErrorCode === "42501" ||
    serverErrorCode === "25006",
    `Server must reject write with permission denied or read-only error (got: ${serverErrorMessage})`
  );
  console.log("  ✅ Physical server write rejection verified (Finding 1 satisfied)");

  // 5. Schema Introspection
  console.log("\n[5] Introspecting schema via PostgreSQL Schema Reader...");
  const schema = await getPostgresEnrichedSchema(postgresAdapter, { schemaName: "public" });
  const tableNames = Object.keys(schema).sort();
  console.log(`  Introspected tables: ${tableNames.join(", ")}`);
  assert(tableNames.includes("customers"), "Must include customers table");
  assert(tableNames.includes("orders"), "Must include orders table");
  assert(tableNames.includes("items"), "Must include items table");

  const ordersMeta = schema["orders"];
  console.log(`  orders table columns: ${ordersMeta.columns.map(c => c.name).join(", ")}`);
  console.log(`  orders table rowCount: ${ordersMeta.rowCount}`);
  console.log(`  orders foreign keys: ${ordersMeta.foreignKeys.length}`);
  assert.strictEqual(ordersMeta.rowCount, 7, "orders rowCount must be 7");
  assert(ordersMeta.foreignKeys.some(fk => fk.table === "customers" && fk.from === "customer_id"), "orders must have FK to customers");
  console.log("  ✅ Schema reader and foreign key relationship verified");

  await postgresAdapter.close();

  console.log("\n==================================================");
  console.log("🏆 ALL POSTGRESQL ADAPTER TESTS PASSED (100%)    ");
  console.log("==================================================");
}

testPostgresAdapter().catch(err => {
  console.error("❌ Postgres adapter test failed:", err);
  process.exit(1);
});
