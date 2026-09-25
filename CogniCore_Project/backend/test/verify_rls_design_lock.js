// ============================================================
// PHASE D2: RLS DESIGN-LOCK VERIFICATION BATTERY
// Verifies CEO-salary restriction spec, predicate injection, and role isolation
// Spec Document: docs/RLS_DESIGN_SPEC.md
// ============================================================

import assert from 'assert';
import { evaluateRlsPolicy, injectRlsPredicate, RLS_VERDICT } from '../src/security/rls.policy.js';
import { mariadbAdapter } from '../src/adapters/mariadb.adapter.js';

console.log("==================================================");
console.log("   PHASE D2 — RLS DESIGN-LOCK & CEO-SALARY TEST   ");
console.log("==================================================");

async function runRlsTests() {
  await mariadbAdapter.connect();

  try {
    // ----------------------------------------------------
    // TEST 1: Unauthenticated request -> Fail-closed
    // ----------------------------------------------------
    console.log("\n[1] Testing unauthenticated access rejection...");
    const unauthRes = evaluateRlsPolicy({
      tableName: 'tabSalary Slip',
      identity: null
    });
    assert.strictEqual(unauthRes.verdict, RLS_VERDICT.REJECT_UNAUTHENTICATED);
    assert.strictEqual(unauthRes.error, 'rls_unauthenticated:missing_identity_context');
    console.log("  ✅ Unauthenticated request rejected fail-closed");

    // ----------------------------------------------------
    // TEST 2: Direct CEO-Salary Probe by Standard Employee -> Fail-closed
    // ----------------------------------------------------
    console.log("\n[2] Testing Direct CEO-Salary Probe by Employee (Devon Vance, EMP-002)...");
    const devonIdentity = {
      userId: 'usr_devon_02',
      employeeId: 'EMP-002',
      roles: ['Employee'],
      company: 'CogniCore Enterprise'
    };

    const ceoProbe = evaluateRlsPolicy({
      tableName: 'tabSalary Slip',
      identity: devonIdentity,
      queryIntent: {
        targetEmployeeId: 'EMP-001',
        targetEmployeeName: 'Victoria Stirling'
      }
    });

    console.log(`  Verdict: ${ceoProbe.verdict}`);
    console.log(`  Error:   ${ceoProbe.error}`);
    console.log(`  Reason:  ${ceoProbe.reason}`);
    assert.strictEqual(ceoProbe.verdict, RLS_VERDICT.REJECT_FORBIDDEN);
    assert.strictEqual(ceoProbe.error, 'rls_forbidden:unauthorized_salary_access');
    assert.strictEqual(ceoProbe.injectedPredicate, null);
    console.log("  ✅ CEO-salary direct probe rejected fail-closed with zero SQL execution");

    // ----------------------------------------------------
    // TEST 3: Self-Service Salary Query -> Injects Predicate
    // ----------------------------------------------------
    console.log("\n[3] Testing Self-Service Salary Query by Devon Vance (EMP-002)...");
    const selfRes = evaluateRlsPolicy({
      tableName: 'tabSalary Slip',
      identity: devonIdentity,
      queryIntent: {}
    });

    console.log(`  Verdict: ${selfRes.verdict}`);
    console.log(`  Predicate: ${selfRes.injectedPredicate}`);
    assert.strictEqual(selfRes.verdict, RLS_VERDICT.INJECT_PREDICATE);
    assert.strictEqual(selfRes.injectedPredicate, "`employee` = 'EMP-002' AND `docstatus` = 1");

    // Test SQL transformation
    const baseSql = "SELECT gross_pay, net_pay FROM `tabSalary Slip` WHERE `start_date` = '2024-11-01'";
    const transformedSql = injectRlsPredicate(baseSql, selfRes.injectedPredicate);
    console.log(`  Original SQL:    ${baseSql}`);
    console.log(`  Transformed SQL: ${transformedSql}`);
    assert(transformedSql.includes("`employee` = 'EMP-002'"), "Transformed SQL must include employee filter");

    // Execute against MariaDB ground-truth:
    const scopedRows = await mariadbAdapter.executeReadOnlySql(transformedSql);
    assert.strictEqual(scopedRows.length, 1, "Must return exactly 1 record for Devon");
    assert.strictEqual(Number(scopedRows[0].gross_pay), 14000.00, "Must return Devon's gross salary ($14,000.00)");
    console.log(`  ✅ Self-service query scoped to Devon's salary ($14,000.00) — CEO salary excluded!`);

    // ----------------------------------------------------
    // TEST 4: Executive / HR Manager Query -> Full Authorization
    // ----------------------------------------------------
    console.log("\n[4] Testing Executive / HR Manager Access (Victoria Stirling, EMP-001)...");
    const execIdentity = {
      userId: 'usr_victoria_01',
      employeeId: 'EMP-001',
      roles: ['Executive', 'HR Manager'],
      company: 'CogniCore Enterprise'
    };

    const execRes = evaluateRlsPolicy({
      tableName: 'tabSalary Slip',
      identity: execIdentity,
      queryIntent: {
        targetEmployeeName: 'Company Payroll'
      }
    });

    assert.strictEqual(execRes.verdict, RLS_VERDICT.ALLOW);
    console.log(`  Verdict: ${execRes.verdict}`);

    const execSql = "SELECT SUM(gross_pay) AS total_payroll FROM `tabSalary Slip` WHERE `docstatus` = 1 AND `start_date` = '2024-11-01'";
    const execRows = await mariadbAdapter.executeReadOnlySql(execSql);
    assert.strictEqual(Number(execRows[0].total_payroll), 85000.00);
    console.log(`  ✅ Executive query authorized: full payroll visible ($85,000.00)`);

    // ----------------------------------------------------
    // TEST 5: Predicate Injection Clause Robustness
    // ----------------------------------------------------
    console.log("\n[5] Testing predicate injection across different SQL shapes...");
    const sqlWithoutWhere = "SELECT * FROM `tabCustomer` ORDER BY name LIMIT 10";
    const injectedNoWhere = injectRlsPredicate(sqlWithoutWhere, "`disabled` = 0");
    console.log(`  No-WHERE injection: ${injectedNoWhere}`);
    assert(injectedNoWhere.includes("WHERE `disabled` = 0 ORDER BY"), "Must inject WHERE before ORDER BY");

    const sqlWithGroupBy = "SELECT customer, SUM(grand_total) FROM `tabSales Invoice` GROUP BY customer";
    const injectedGroupBy = injectRlsPredicate(sqlWithGroupBy, "`docstatus` = 1");
    console.log(`  GROUP BY injection: ${injectedGroupBy}`);
    assert(injectedGroupBy.includes("WHERE `docstatus` = 1 GROUP BY"), "Must inject WHERE before GROUP BY");
    console.log("  ✅ SQL predicate injector handles WHERE, ORDER BY, and GROUP BY correctly");

  } finally {
    await mariadbAdapter.close();
  }

  console.log("\n==================================================");
  console.log("🏆 ALL RLS DESIGN-LOCK TESTS PASSED (100% GREEN)!");
  console.log("==================================================");
}

runRlsTests().catch(err => {
  console.error("❌ RLS verification failed:", err);
  process.exit(1);
});
