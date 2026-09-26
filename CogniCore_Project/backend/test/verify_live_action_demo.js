// ============================================================================
// VERIFICATION: LIVE ACTION GATEWAY DEMO (PHASE D5 EXIT CRITERION 6)
// Executes a live, end-to-end write cycle against the live MariaDB ERPNext database:
//   1. Query BEFORE state for Devon Vance (EMP-002) using read-only adapter
//   2. Run proposal with dryRun: true -> confirms SQL preview, asserts ZERO DB change
//   3. Run proposal with dryRun: false -> PENDING action created
//   4. Approve action -> transitions PENDING -> APPROVED -> EXECUTED
//   5. Query AFTER state -> proves row updated in live database
//   6. Cross-employee probe (EMP-002 updating CEO EMP-001) -> blocked by RLS write gate
//   7. Audit trail integrity verified -> SHA-256 hash chain intact
// ============================================================================

import assert from "node:assert/strict";
import { actionGateway } from "../src/security/action.gateway.js";
import { actionAuditLog } from "../src/store/action.audit.log.js";
import { createMariaDbAdapter } from "../src/adapters/mariadb.adapter.js";

async function runLiveActionDemo() {
  console.log("==================================================");
  console.log("   STEP D5 — VERIFY LIVE ACTION GATEWAY DEMO      ");
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
    }
  }

  // Use read-only adapter to inspect DB state before and after
  const roAdapter = createMariaDbAdapter();
  await roAdapter.connect({
    credentialRef: "env:erpnext"
  });

  const devonIdentity = {
    userId: "devon.vance",
    employeeId: "EMP-002",
    roles: ["Employee"]
  };

  const newCell = `+1-555-${Math.floor(1000 + Math.random() * 9000)}`;
  const newEmail = `devon.vance.${Date.now()}@enterprise.corp`;

  // STEP 1: Query initial state
  let beforeRow = null;
  await test("Baseline: query initial employee record using read-only adapter", async () => {
    const rows = await roAdapter.queryReadOnly(
      "SELECT name, employee_name, cell_number, personal_email FROM `tabEmployee` WHERE name = ?",
      ["EMP-002"]
    );
    assert.strictEqual(rows.length, 1);
    beforeRow = rows[0];
    console.log(`   Initial State: [${beforeRow.name}] ${beforeRow.employee_name} | cell: ${beforeRow.cell_number} | email: ${beforeRow.personal_email}`);
  });

  // STEP 2: Dry Run Mode
  await test("Dry Run: proposeAction with dryRun: true generates preview without DB mutation", async () => {
    const dryRes = await actionGateway.proposeAction({
      templateId: "UPDATE_OWN_CONTACT",
      targetTable: "tabEmployee",
      params: {
        employeeId: "EMP-002",
        cellNumber: newCell,
        personalEmail: newEmail
      },
      requesterIdentity: devonIdentity,
      dryRun: true,
      dialect: "mariadb"
    });

    assert.strictEqual(dryRes.status, "DRY_RUN");
    assert.ok(dryRes.preview.sql.includes("UPDATE `tabEmployee`"));
    assert.strictEqual(dryRes.preview.params[0], newCell);

    // Verify DB was NOT touched
    const checkRows = await roAdapter.queryReadOnly(
      "SELECT cell_number, personal_email FROM `tabEmployee` WHERE name = ?",
      ["EMP-002"]
    );
    assert.strictEqual(checkRows[0].cell_number, beforeRow.cell_number);
    assert.strictEqual(checkRows[0].personal_email, beforeRow.personal_email);
    console.log("   Dry run verified: Zero row modifications occurred in database.");
  });

  // STEP 3: Actual Proposal (dryRun: false)
  let proposal = null;
  await test("Proposal: proposeAction with dryRun: false creates PENDING action", async () => {
    proposal = await actionGateway.proposeAction({
      templateId: "UPDATE_OWN_CONTACT",
      targetTable: "tabEmployee",
      params: {
        employeeId: "EMP-002",
        cellNumber: newCell,
        personalEmail: newEmail
      },
      requesterIdentity: devonIdentity,
      dryRun: false,
      dialect: "mariadb"
    });

    assert.strictEqual(proposal.status, "PENDING");
    assert.strictEqual(proposal.selfApproveEligible, true);
    console.log(`   Action Created: ID = ${proposal.actionId} (Status: PENDING)`);
  });

  // STEP 4: Approval & Execution
  let execResult = null;
  await test("Approval & Execution: self-approval triggers live write via cognicore_write", async () => {
    execResult = await actionGateway.approveAction({
      actionId: proposal.actionId,
      approverIdentity: devonIdentity,
      executeImmediately: true
    });

    assert.strictEqual(execResult.status, "EXECUTED");
    assert.strictEqual(execResult.affectedRows, 1);
    assert.ok(execResult.auditEntryId);
    console.log(`   Execution Succeeded: affectedRows = ${execResult.affectedRows}, duration = ${execResult.durationMs}ms`);
  });

  // STEP 5: Verification of DB Update
  await test("Row Verification: read-only adapter confirms row values updated in live database", async () => {
    const afterRows = await roAdapter.queryReadOnly(
      "SELECT name, employee_name, cell_number, personal_email FROM `tabEmployee` WHERE name = ?",
      ["EMP-002"]
    );

    assert.strictEqual(afterRows.length, 1);
    const afterRow = afterRows[0];
    assert.strictEqual(afterRow.cell_number, newCell);
    assert.strictEqual(afterRow.personal_email, newEmail);
    console.log(`   Updated State: [${afterRow.name}] ${afterRow.employee_name} | cell: ${afterRow.cell_number} | email: ${afterRow.personal_email}`);
  });

  // STEP 6: RLS Write Protection (Devon attempting to update CEO Victoria Stirling)
  await test("RLS Write Guard: Devon Vance (EMP-002) attempting to update CEO (EMP-001) blocked", async () => {
    await assert.rejects(
      async () => {
        await actionGateway.proposeAction({
          templateId: "UPDATE_OWN_CONTACT",
          targetTable: "tabEmployee",
          params: {
            employeeId: "EMP-001",
            cellNumber: "+1-555-9999",
            personalEmail: "hacked@ceo.test"
          },
          requesterIdentity: devonIdentity,
          dryRun: false,
          dialect: "mariadb"
        });
      },
      (err) => {
        return err.code === "rls_write_forbidden:cross_employee_write";
      }
    );
    console.log("   Cross-employee write attempt successfully refused by RLS write policy.");
  });

  // STEP 7: Audit Log Cryptographic Integrity
  await test("Audit Trail: verify SHA-256 forward hash-chain integrity across all actions", () => {
    const integrity = actionAuditLog.verifyIntegrity();
    assert.ok(integrity.valid, `Audit log integrity failed: ${integrity.error}`);
    assert.ok(integrity.verifiedCount >= 4, "Expected at least 4 audit records in chain");
    console.log(`   Audit Log Intact: ${integrity.verifiedCount} cryptographic entries verified cleanly.`);
  });

  await roAdapter.close();
  const writeAdapter = (await import("../src/adapters/write/index.js")).getWriteAdapter("mariadb");
  await writeAdapter.close();

  console.log("==================================================");
  console.log(`LIVE ACTION DEMO RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log("🏆 ALL LIVE ACTION GATEWAY DEMO TESTS GREEN");
    console.log("==================================================");
    process.exit(0);
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

runLiveActionDemo().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
