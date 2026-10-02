// ============================================================================
// VERIFICATION SUITE 4: DBA SCRIPT GENERATOR & PRIVILEGE VERIFICATION
// Verifies:
//   1. Generated script contains placeholder password (NEVER real password)
//   2. Input validation blocks identifier injection
//   3. When executed on live MariaDB, produces user with STRICTLY SELECT privilege (SHOW GRANTS verified)
//   4. When executed on live Postgres, produces role with STRICTLY SELECT privilege (information_schema verified)
// ============================================================================

import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import pkg from "pg";
const { Client: PgClient } = pkg;

import {
  generateDbaScript,
  PLACEHOLDER_PASSWORD
} from "../src/services/grant.script.generator.js";

async function run() {
  console.log("==================================================");
  console.log("   TEST SUITE 4 — DBA SCRIPT GENERATOR VERIFY     ");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // 1. Script structure and placeholder enforcement
  await test("Script generator returns placeholder password and never exposes secrets", async () => {
    const res = generateDbaScript({
      kind: "mariadb",
      databaseName: "corp_db",
      readOnlyUsername: "analyst_ro"
    });

    assert.ok(res.script.includes(PLACEHOLDER_PASSWORD));
    assert.ok(res.script.includes("GRANT SELECT ON `corp_db`.* TO 'analyst_ro'@'%'"));
    assert.ok(!res.script.includes("password123"));
  });

  // 2. Identifier injection rejection
  await test("Rejects malicious identifier injection attempts fail-closed", async () => {
    assert.throws(
      () => generateDbaScript({ kind: "mariadb", databaseName: "db; DROP TABLE users; --", readOnlyUsername: "ro" }),
      /Invalid databaseName/i
    );
    assert.throws(
      () => generateDbaScript({ kind: "postgres", databaseName: "valid_db", readOnlyUsername: "ro' OR '1'='1" }),
      /Invalid readOnlyUsername/i
    );
  });

  // 3. Live MariaDB Execution & SHOW GRANTS Verification
  await test("Live MariaDB: executed script yields strictly SELECT privileges via SHOW GRANTS", async () => {
    const testUser = `ro_dba_maria_${Date.now() % 10000}`;
    const testPass = "DbaPass_2026_Secure!";
    const dbName = "_210a92d8bfbfc131";

    const generated = generateDbaScript({
      kind: "mariadb",
      databaseName: dbName,
      readOnlyUsername: testUser
    });

    // Customer DBA replaces placeholder with their secret password
    const executableScript = generated.script.replace(PLACEHOLDER_PASSWORD, testPass);

    const adminConn = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3307,
      user: "root",
      password: "admin"
    });

    try {
      // Strip comment lines before splitting on semicolon
      const cleanScript = executableScript.replace(/^--.*$/gm, "").trim();
      const statements = cleanScript
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const sql of statements) {
        await adminConn.query(sql);
      }

      // Live verification of privilege set using SHOW GRANTS
      const [grantsRows] = await adminConn.query(`SHOW GRANTS FOR '${testUser}'@'%'`);
      const grants = grantsRows.map(r => Object.values(r)[0]);

      console.log(`  Live MariaDB Grants:`, grants);

      // Must have GRANT SELECT ON `_210a92d8bfbfc131`.*
      const hasSelect = grants.some(g => g.includes("SELECT") && g.includes(dbName));
      assert.ok(hasSelect, "Grants must contain SELECT on target database");

      // Must NOT have INSERT, UPDATE, DELETE, DROP, ALTER, GRANT OPTION
      const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "ALL PRIVILEGES", "WITH GRANT OPTION"];
      for (const f of forbidden) {
        const hasForbidden = grants.some(g => g.includes(f));
        assert.ok(!hasForbidden, `User must NOT have forbidden privilege: ${f}`);
      }
    } finally {
      await adminConn.query(`DROP USER IF EXISTS '${testUser}'@'%'`).catch(() => {});
      await adminConn.end();
    }
  });

  // 4. Live PostgreSQL Execution & Table Privilege Verification
  await test("Live PostgreSQL: executed script yields strictly SELECT privileges", async () => {
    const testUser = `ro_dba_pg_${Date.now() % 10000}`;
    const testPass = "DbaPgPass_2026_Secure!";
    const dbName = "cognicore_pg_test";

    const generated = generateDbaScript({
      kind: "postgres",
      databaseName: dbName,
      readOnlyUsername: testUser
    });

    const executableScript = generated.script.replace(PLACEHOLDER_PASSWORD, testPass);

    const adminClient = new PgClient({
      host: "127.0.0.1",
      port: 5432,
      user: "postgres",
      password: "postgres_admin_secret",
      database: dbName
    });

    try {
      await adminClient.connect();

      // Strip comment lines before splitting statements on semicolon
      const cleanScript = executableScript.replace(/^--.*$/gm, "").trim();
      const rawStatements = cleanScript
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const sql of rawStatements) {
        await adminClient.query(sql);
      }

      // Query PostgreSQL information_schema to verify exact granted privileges
      const privRes = await adminClient.query(
        `SELECT privilege_type, table_name 
         FROM information_schema.role_table_grants 
         WHERE grantee = $1 AND table_schema = 'public'`,
        [testUser]
      );

      console.log(`  Live Postgres Privileges granted:`, privRes.rows.map(r => r.privilege_type));

      for (const row of privRes.rows) {
        assert.strictEqual(row.privilege_type, "SELECT", "Every table privilege must be strictly SELECT");
      }
    } finally {
      await adminClient.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${testUser}"`).catch(() => {});
      await adminClient.query(`DROP ROLE IF EXISTS "${testUser}"`).catch(() => {});
      await adminClient.end();
    }
  });

  console.log(`\nDBA SCRIPT GENERATOR SUITE: ${passed}/${total} passed.`);
  assert.strictEqual(passed, total, "All grant script tests must pass");
}

run().catch((err) => {
  console.error("FATAL in verify_grant_script_generator.js:", err);
  process.exit(1);
});
