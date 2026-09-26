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

  // 4a. Table Ownership Verification (Finding 1 Rigor)
  console.log("\n[4a] Verifying Table Ownership in PostgreSQL (pg_tables)...");
  const ownershipRows = await postgresAdapter.queryReadOnly(
    "SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("  Table Owners:", ownershipRows.map(r => `${r.tablename} -> ${r.tableowner}`).join(", "));
  for (const row of ownershipRows) {
    assert.notStrictEqual(row.tableowner, "cognicore_ro", `Table ${row.tablename} must NOT be owned by cognicore_ro`);
  }
  console.log("  ✅ Zero tables owned by cognicore_ro — ownership bypass impossible");

  // 4b. Primary Defense: Server-Level Privilege Enforcement (SQLSTATE 42501)
  console.log("\n[4b] Testing PRIMARY Defense: Server-Level Privilege Enforcement (SQLSTATE 42501)...");
  console.log("     Connecting explicitly WITHOUT session read-only (default_transaction_read_only = off)...");
  
  const { Client } = await import('pg');
  const rawClient = new Client({
    host: pgSource.host,
    port: pgSource.port,
    user: pgSource.user,
    password: pgSource.password,
    database: pgSource.database
    // Note: NO options: "-c default_transaction_read_only=on"
  });

  await rawClient.connect();
  await rawClient.query("SET default_transaction_read_only = off");
  
  const roCheck = await rawClient.query("SHOW default_transaction_read_only");
  console.log(`     Session default_transaction_read_only is: ${roCheck.rows[0]?.default_transaction_read_only}`);
  assert.strictEqual(roCheck.rows[0]?.default_transaction_read_only, "off", "Session must be in read-write mode to isolate privilege check");

  let primaryBlocked = false;
  let primaryCode = null;
  let primaryMessage = "";

  try {
    await rawClient.query(
      'INSERT INTO "customers" ("name", "email", "city") VALUES ($1, $2, $3)',
      ['Privilege Probe', 'probe@test.com', 'Nowhere']
    );
  } catch (err) {
    primaryBlocked = true;
    primaryCode = err.code;
    primaryMessage = err.message;
  } finally {
    await rawClient.end();
  }

  console.log(`     Write blocked:       ${primaryBlocked}`);
  console.log(`     Postgres error code: ${primaryCode}`);
  console.log(`     Postgres message:    ${primaryMessage}`);

  assert.strictEqual(primaryBlocked, true, "Physical write must be blocked by database server privilege check");
  assert.strictEqual(primaryCode, "42501", "Server must return SQLSTATE 42501 (insufficient_privilege)");
  assert(primaryMessage.toLowerCase().includes("permission denied for table"), "Error message must state 'permission denied for table'");
  console.log("  ✅ PRIMARY SERVER PRIVILEGE ENFORCEMENT VERIFIED (SQLSTATE 42501)");

  // 4c. Secondary Defense-in-Depth: Session Read-Only Enforcement (SQLSTATE 25006)
  console.log("\n[4c] Testing SECONDARY Defense: Session Read-Only Defense-in-Depth (SQLSTATE 25006)...");
  let secondaryBlocked = false;
  let secondaryCode = null;
  let secondaryMessage = "";

  try {
    // Attempt physical INSERT on server via adapter with session read-only active
    await postgresAdapter.queryReadOnly(
      'INSERT INTO "customers" ("name", "email", "city") VALUES (?, ?, ?)',
      ['Unauthorized Write', 'fail@test.com', 'Nowhere']
    );
  } catch (err) {
    secondaryBlocked = true;
    secondaryCode = err.code;
    secondaryMessage = err.message;
  }

  console.log(`     Write blocked:       ${secondaryBlocked}`);
  console.log(`     Postgres error code: ${secondaryCode}`);
  console.log(`     Postgres message:    ${secondaryMessage}`);

  assert.strictEqual(secondaryBlocked, true, "Physical write must be blocked by session read-only check");
  assert.strictEqual(secondaryCode, "25006", "Session read-only check must return SQLSTATE 25006 (read_only_sql_transaction)");
  assert(secondaryMessage.toLowerCase().includes("read-only transaction"), "Error message must indicate read-only transaction");
  console.log("  ✅ SECONDARY DEFENSE-IN-DEPTH VERIFIED (SQLSTATE 25006)");

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
