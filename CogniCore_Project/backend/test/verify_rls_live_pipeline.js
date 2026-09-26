// ============================================================================
// STEP D4d — END-TO-END RLS & CEO-SALARY VERIFICATION BATTERY
//
// Invariants Verified:
//   1. Uniform Query Spy: Proves callCount === 0 on unauthorized probes across adapters.
//   2. Probe 1 (Devon Vance probing Victoria Stirling): 100% Zero-SQL Refusal.
//   3. Probe 2 (Devon Vance company-wide salary probe): Scoped to Devon, CEO excluded.
//   4. Probe 3 (Devon Vance self-service salary): Scoped SQL execution returning $14,000.
//   5. Probe 4 (Victoria Stirling executive query): Authorized company payroll ($85,000).
//   6. Probe 5 (Unauthenticated/Anonymous probe): Fail-closed with zero SQL execution.
//   7. Multi-Dialect Uniform Invariant: Spy callCount === 0 holds on MariaDB, SQLite, and Postgres.
// ============================================================================

import assert from "node:assert/strict";
import { mariadbAdapter } from "../src/adapters/mariadb.adapter.js";
import { postgresAdapter } from "../src/adapters/postgres.adapter.js";
import * as sqliteAdapter from "../src/config/database.js";
import { createCapabilitiesForSource } from "../src/kernel/capabilities.js";
import { executeLlmLink } from "../src/core/links/llm.link.js";
import { executeDynamicLink } from "../src/core/links/dynamic.link.js";
import { gateChainFor } from "../src/kernel/gate.selector.js";

/**
 * Creates a uniform query spy wrapping any database adapter.
 * Intercepts executeReadOnlySql and queryReadOnly.
 */
function createQuerySpy(adapter) {
  let callCount = 0;
  const queries = [];

  const spiedAdapter = {
    ...adapter,
    async queryReadOnly(...args) {
      callCount++;
      queries.push(args[0]);
      return adapter.queryReadOnly(...args);
    },
    async executeReadOnlySql(...args) {
      callCount++;
      queries.push(args[0]);
      return adapter.executeReadOnlySql(...args);
    }
  };

  return {
    adapter: spiedAdapter,
    get callCount() {
      return callCount;
    },
    get queries() {
      return queries;
    },
    reset() {
      callCount = 0;
      queries.length = 0;
    }
  };
}

async function runRlsLivePipelineTests() {
  console.log("==================================================");
  console.log("   STEP D4d — END-TO-END RLS & CEO-SALARY BATTERY ");
  console.log("==================================================");

  await mariadbAdapter.connect();

  const erpSource = {
    id: "erpnext_prod",
    kind: "mariadb",
    dialect: "mariadb",
    database: "_4e5d6a7b8c9d0e1f"
  };

  const devonIdentity = {
    userId: "usr_devon_02",
    employeeId: "EMP-002",
    roles: ["Employee"],
    company: "CogniCore Enterprise"
  };

  const victoriaIdentity = {
    userId: "usr_victoria_01",
    employeeId: "EMP-001",
    roles: ["Executive", "HR Manager"],
    company: "CogniCore Enterprise"
  };

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
      console.error(err.stack);
    }
  }

  // ----------------------------------------------------
  // PROBE 1: Employee Probing CEO Salary (Zero-SQL Refusal)
  // ----------------------------------------------------
  await test("PROBE 1: Devon Vance probing Victoria Stirling's salary -> 0 SQL executed", async () => {
    const spy = createQuerySpy(mariadbAdapter);
    const caps = createCapabilitiesForSource(erpSource, spy.adapter);

    const activeChain = gateChainFor(caps.source);
    const sql = "SELECT employee, employee_name, gross_pay, net_pay FROM `tabSalary Slip` WHERE `employee` = 'EMP-001'";

    let rlsBlocked = false;
    let refusalReason = null;

    for (const gate of activeChain) {
      if (gate.type === "validate") {
        const v = await gate.run(sql, {
          identity: devonIdentity,
          queryIntent: { targetEmployeeId: "EMP-001", targetEmployeeName: "Victoria Stirling" }
        });
        if (!v.valid && (v.reason?.startsWith("ast_rls_") || v.reason?.startsWith("rls_"))) {
          rlsBlocked = true;
          refusalReason = v.reason;
          break;
        }
      } else if (gate.type === "execute") {
        await gate.run(sql, { capabilities: caps });
      }
    }

    assert.strictEqual(rlsBlocked, true, "Probe must be blocked by RLS gate");
    assert.strictEqual(spy.callCount, 0, "INVARIANT VIOLATION: Physical SQL was executed for forbidden CEO probe!");
    assert.strictEqual(refusalReason, "rls_forbidden:unauthorized_salary_access");
    console.log(`   🛡️ Zero-SQL Refusal Verified (spy.callCount = ${spy.callCount})`);
  });

  // ----------------------------------------------------
  // PROBE 2: Employee Company-Wide Salary Probe (Excludes CEO)
  // ----------------------------------------------------
  await test("PROBE 2: Devon Vance company-wide salary probe -> Scoped strictly to Devon", async () => {
    const spy = createQuerySpy(mariadbAdapter);
    const caps = createCapabilitiesForSource(erpSource, spy.adapter);

    const activeChain = gateChainFor(caps.source);
    const baseSql = "SELECT employee, gross_pay, net_pay FROM `tabSalary Slip` WHERE `start_date` = '2024-11-01'";

    let executedSql = null;
    let rows = null;

    for (const gate of activeChain) {
      if (gate.type === "validate") {
        const v = await gate.run(baseSql, {
          identity: devonIdentity,
          queryIntent: {}
        });
        assert.strictEqual(v.valid, true, "Self query must pass validation");
        executedSql = v.sql;
      } else if (gate.type === "execute") {
        rows = await gate.run(executedSql, { capabilities: caps });
      }
    }

    assert.strictEqual(spy.callCount, 1, "Must execute exactly 1 scoped query");
    assert.ok(executedSql.includes("`employee` = 'EMP-002'"), "Executed SQL must have employee = 'EMP-002' injected");
    assert.strictEqual(rows.length, 1, "Must return exactly 1 row");
    assert.strictEqual(rows[0].employee, "EMP-002");
    assert.strictEqual(Number(rows[0].gross_pay), 14000.00);
    console.log(`   🛡️ Company-wide probe securely scoped: Devon sees only own salary ($14,000.00), CEO excluded`);
  });

  // ----------------------------------------------------
  // PROBE 3: Employee Self-Service Salary Query ($14,000.00)
  // ----------------------------------------------------
  await test("PROBE 3: Devon Vance self-service salary query -> Returns $14,000.00", async () => {
    const spy = createQuerySpy(mariadbAdapter);
    const caps = createCapabilitiesForSource(erpSource, spy.adapter);

    const activeChain = gateChainFor(caps.source);
    const selfSql = "SELECT gross_pay, net_pay FROM `tabSalary Slip` WHERE `start_date` = '2024-11-01'";

    let executedSql = null;
    let rows = null;

    for (const gate of activeChain) {
      if (gate.type === "validate") {
        const v = await gate.run(selfSql, { identity: devonIdentity });
        executedSql = v.sql;
      } else if (gate.type === "execute") {
        rows = await gate.run(executedSql, { capabilities: caps });
      }
    }

    assert.strictEqual(spy.callCount, 1);
    assert.strictEqual(Number(rows[0].gross_pay), 14000.00);
    assert.strictEqual(Number(rows[0].net_pay), 11000.00);
    console.log(`   🛡️ Self-service salary returned: Gross $14,000.00, Net $11,000.00`);
  });

  // ----------------------------------------------------
  // PROBE 4: Executive Authorized Total Payroll Query ($85,000.00)
  // ----------------------------------------------------
  await test("PROBE 4: Victoria Stirling executive total payroll query -> Returns $85,000.00", async () => {
    const spy = createQuerySpy(mariadbAdapter);
    const caps = createCapabilitiesForSource(erpSource, spy.adapter);

    const activeChain = gateChainFor(caps.source);
    const execSql = "SELECT SUM(gross_pay) AS total_payroll FROM `tabSalary Slip` WHERE `docstatus` = 1 AND `start_date` = '2024-11-01'";

    let executedSql = null;
    let rows = null;

    for (const gate of activeChain) {
      if (gate.type === "validate") {
        const v = await gate.run(execSql, { identity: victoriaIdentity });
        assert.strictEqual(v.valid, true);
        executedSql = v.sql;
      } else if (gate.type === "execute") {
        rows = await gate.run(executedSql, { capabilities: caps });
      }
    }

    assert.strictEqual(spy.callCount, 1);
    assert.strictEqual(Number(rows[0].total_payroll), 85000.00);
    console.log(`   🛡️ Executive full payroll access authorized: Total = $85,000.00`);
  });

  // ----------------------------------------------------
  // PROBE 5: Anonymous Unauthenticated Request -> Zero SQL
  // ----------------------------------------------------
  await test("PROBE 5: Anonymous probe on tabSalary Slip -> Refused fail-closed with 0 SQL", async () => {
    const spy = createQuerySpy(mariadbAdapter);
    const caps = createCapabilitiesForSource(erpSource, spy.adapter);

    const activeChain = gateChainFor(caps.source);
    const sql = "SELECT * FROM `tabSalary Slip` LIMIT 5";

    let rlsBlocked = false;
    let refusalReason = null;

    for (const gate of activeChain) {
      if (gate.type === "validate") {
        const v = await gate.run(sql, { identity: null });
        if (!v.valid && (v.reason?.startsWith("ast_rls_") || v.reason?.startsWith("rls_"))) {
          rlsBlocked = true;
          refusalReason = v.reason;
          break;
        }
      } else if (gate.type === "execute") {
        await gate.run(sql, { capabilities: caps });
      }
    }

    assert.strictEqual(rlsBlocked, true, "Anonymous request must be blocked");
    assert.strictEqual(spy.callCount, 0, "INVARIANT VIOLATION: Physical SQL was executed for anonymous probe!");
    assert.strictEqual(refusalReason, "rls_unauthenticated:missing_identity_context");
    console.log(`   🛡️ Anonymous request rejected fail-closed (spy.callCount = ${spy.callCount})`);
  });

  // ----------------------------------------------------
  // PROBE 6: Multi-Dialect Uniform Invariant (SQLite & Postgres)
  // ----------------------------------------------------
  await test("PROBE 6: Uniform Query Spy invariant holds across SQLite & Postgres", async () => {
    // 6a. SQLite
    const sqliteSpy = createQuerySpy(sqliteAdapter);
    const sqliteSource = { id: "sqlite_default", dialect: "sqlite", kind: "sqlite" };
    const sqliteCaps = createCapabilitiesForSource(sqliteSource, sqliteSpy.adapter);
    const sqliteChain = gateChainFor(sqliteCaps.source);

    const probeSql = 'SELECT * FROM "tabSalary Slip" WHERE "employee" = \'EMP-001\'';
    let sqliteBlocked = false;

    for (const gate of sqliteChain) {
      if (gate.type === "validate") {
        const v = await gate.run(probeSql, {
          identity: devonIdentity,
          queryIntent: { targetEmployeeId: "EMP-001" }
        });
        if (!v.valid && (v.reason?.startsWith("ast_rls_") || v.reason?.startsWith("rls_"))) {
          sqliteBlocked = true;
          break;
        }
      } else if (gate.type === "execute") {
        await gate.run(probeSql, { capabilities: sqliteCaps });
      }
    }

    assert.strictEqual(sqliteBlocked, true, "SQLite chain must enforce RLS");
    assert.strictEqual(sqliteSpy.callCount, 0, "SQLite spy callCount must be 0");
    console.log("   🛡️ SQLite uniform spy invariant verified: callCount === 0");

    // 6b. Postgres
    const pgSpy = createQuerySpy(postgresAdapter);
    const pgSource = { id: "pg_prod", dialect: "postgres", kind: "postgres", database: "cognicore_dev" };
    const pgCaps = createCapabilitiesForSource(pgSource, pgSpy.adapter);
    const pgChain = gateChainFor(pgCaps.source);

    let pgBlocked = false;
    for (const gate of pgChain) {
      if (gate.type === "validate") {
        const v = await gate.run(probeSql, {
          identity: devonIdentity,
          queryIntent: { targetEmployeeId: "EMP-001" }
        });
        if (!v.valid && (v.reason?.startsWith("ast_rls_") || v.reason?.startsWith("rls_"))) {
          pgBlocked = true;
          break;
        }
      } else if (gate.type === "execute") {
        await gate.run(probeSql, { capabilities: pgCaps });
      }
    }

    assert.strictEqual(pgBlocked, true, "Postgres chain must enforce RLS");
    assert.strictEqual(pgSpy.callCount, 0, "Postgres spy callCount must be 0");
    console.log("   🛡️ Postgres uniform spy invariant verified: callCount === 0");
  });

  console.log("==================================================");
  console.log(`RLS LIVE PIPELINE RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log("🏆 ALL RLS LIVE PIPELINE & CEO-SALARY TESTS GREEN (100%)");
    console.log("==================================================");
    process.exit(0);
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

runRlsLivePipelineTests().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
