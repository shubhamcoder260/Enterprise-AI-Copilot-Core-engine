// ============================================================================
// VERIFICATION: ACTION GATEWAY LIFECYCLE (PHASE D5 EXIT CRITERION 4)
// Exercises the complete proposal / approval state machine:
//   1. Propose -> dry-run check (preview generated, no pending state persisted)
//   2. Separation of duties: requester cannot approve own non-eligible proposal
//   3. Unauthorized approver role rejected
//   4. Authorized approval & execution transitions PENDING -> APPROVED -> EXECUTED
//   5. Self-approval eligible action allows requester approval
//   6. Rejection transitions PENDING -> REJECTED with reason recorded
//   7. Expired action cannot be approved
// ============================================================================

import assert from "node:assert/strict";
import { ActionGateway } from "../src/security/action.gateway.js";

async function verifyActionGatewayLifecycle() {
  console.log("==================================================");
  console.log("   STEP D5 — VERIFY ACTION GATEWAY LIFECYCLE      ");
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

  const gateway = new ActionGateway();

  // Mock write adapter for lifecycle verification without mutating live DB in unit tests
  // We will test live DB execution in verify_live_action_demo.js
  const devonIdentity = {
    userId: "devon.vance",
    employeeId: "EMP-002",
    roles: ["Employee"]
  };

  const salesUserIdentity = {
    userId: "sales.rep1",
    roles: ["Sales User"]
  };

  const salesManagerIdentity = {
    userId: "sales.mgr1",
    roles: ["Sales Manager"]
  };

  // TEST 1: Dry-Run Mode
  await test("Dry-Run Mode: returns preview SQL, does NOT store PENDING action", async () => {
    const res = await gateway.proposeAction({
      templateId: "CREATE_CUSTOMER",
      targetTable: "tabCustomer",
      params: {
        customerName: "Acme DryRun Inc",
        customerType: "Company",
        customerGroup: "Commercial",
        territory: "All Territories"
      },
      requesterIdentity: salesUserIdentity,
      dryRun: true,
      dialect: "mariadb"
    });

    assert.strictEqual(res.status, "DRY_RUN");
    assert.ok(res.preview.sql.includes("INSERT INTO `tabCustomer`"));
    assert.strictEqual(res.preview.params[0], "Acme DryRun Inc");

    const stored = gateway.getAction(res.actionId);
    assert.strictEqual(stored, null, "Dry run actions must not be persisted in pending actions map");
  });

  // TEST 2: Actual Proposal -> PENDING
  let pendingOrderActionId = null;
  await test("Proposal: non-dryRun stores action in PENDING state with expiration", async () => {
    const res = await gateway.proposeAction({
      templateId: "UPDATE_ORDER_STATUS",
      targetTable: "tabSales Order",
      params: {
        orderId: "SO-2026-0001",
        status: "Completed"
      },
      requesterIdentity: salesUserIdentity,
      dryRun: false,
      dialect: "mariadb"
    });

    assert.strictEqual(res.status, "PENDING");
    assert.strictEqual(res.selfApproveEligible, false);
    assert.ok(res.expiresAt);

    pendingOrderActionId = res.actionId;
    const stored = gateway.getAction(pendingOrderActionId);
    assert.ok(stored);
    assert.strictEqual(stored.status, "PENDING");
  });

  // TEST 3: Separation of Duties (Self-approval blocked when not eligible)
  await test("Separation of Duties: requester cannot approve own non-eligible proposal", async () => {
    await assert.rejects(
      async () => {
        await gateway.approveAction({
          actionId: pendingOrderActionId,
          approverIdentity: salesUserIdentity, // Same user as requester
          executeImmediately: false
        });
      },
      (err) => {
        return err.code === "SEPARATION_OF_DUTIES_VIOLATION";
      }
    );
  });

  // TEST 4: Unauthorized Approver Role Blocked
  await test("Role Authorization: approver lacking required role is rejected", async () => {
    await assert.rejects(
      async () => {
        await gateway.approveAction({
          actionId: pendingOrderActionId,
          approverIdentity: devonIdentity, // Employee role, not Sales Manager
          executeImmediately: false
        });
      },
      (err) => {
        return err.code === "APPROVAL_UNAUTHORIZED";
      }
    );
  });

  // TEST 5: Authorized Approval (executeImmediately: false)
  await test("Authorized Approval: Sales Manager approves PENDING -> APPROVED", async () => {
    const res = await gateway.approveAction({
      actionId: pendingOrderActionId,
      approverIdentity: salesManagerIdentity,
      executeImmediately: false
    });

    assert.strictEqual(res.status, "APPROVED");
    const stored = gateway.getAction(pendingOrderActionId);
    assert.strictEqual(stored.status, "APPROVED");
    assert.strictEqual(stored.approverIdentity.userId, "sales.mgr1");
  });

  // TEST 6: Self-Approve Eligible Actions (e.g. employee updating own contact)
  await test("Self-Approval Eligibility: employee can self-approve UPDATE_OWN_CONTACT", async () => {
    const propRes = await gateway.proposeAction({
      templateId: "UPDATE_OWN_CONTACT",
      targetTable: "tabEmployee",
      params: {
        employeeId: "EMP-002",
        cellNumber: "+1-555-0102",
        personalEmail: "devon@corp.test"
      },
      requesterIdentity: devonIdentity,
      dryRun: false,
      dialect: "mariadb"
    });

    assert.strictEqual(propRes.selfApproveEligible, true);

    // Devon approves their own action without separation of duties violation
    const appRes = await gateway.approveAction({
      actionId: propRes.actionId,
      approverIdentity: devonIdentity,
      executeImmediately: false
    });

    assert.strictEqual(appRes.status, "APPROVED");
  });

  // TEST 7: Action Rejection
  await test("Rejection: rejectAction transitions PENDING -> REJECTED with audit reason", async () => {
    const propRes = await gateway.proposeAction({
      templateId: "UPDATE_ORDER_STATUS",
      targetTable: "tabSales Order",
      params: {
        orderId: "SO-2026-9999",
        status: "Cancelled"
      },
      requesterIdentity: salesUserIdentity,
      dryRun: false,
      dialect: "mariadb"
    });

    const rejRes = gateway.rejectAction({
      actionId: propRes.actionId,
      rejecterIdentity: salesManagerIdentity,
      reason: "Customer requested order hold, do not cancel yet"
    });

    assert.strictEqual(rejRes.status, "REJECTED");
    assert.strictEqual(rejRes.reason, "Customer requested order hold, do not cancel yet");

    const stored = gateway.getAction(propRes.actionId);
    assert.strictEqual(stored.status, "REJECTED");

    // Attempting to approve rejected action throws
    await assert.rejects(
      async () => {
        await gateway.approveAction({
          actionId: propRes.actionId,
          approverIdentity: salesManagerIdentity
        });
      },
      /Cannot approve action with status 'REJECTED'/
    );
  });

  // TEST 8: Expiration Handling
  await test("TTL Expiration: action past TTL cannot be approved", async () => {
    const quickGateway = new ActionGateway({ ttlMs: 15 }); // 15ms TTL
    const propRes = await quickGateway.proposeAction({
      templateId: "UPDATE_OWN_CONTACT",
      targetTable: "tabEmployee",
      params: {
        employeeId: "EMP-002",
        cellNumber: "+1-555-0102",
        personalEmail: "devon@corp.test"
      },
      requesterIdentity: devonIdentity,
      dryRun: false,
      dialect: "mariadb"
    });

    // Wait 30ms for action to expire
    await new Promise((r) => setTimeout(r, 30));

    await assert.rejects(
      async () => {
        await quickGateway.approveAction({
          actionId: propRes.actionId,
          approverIdentity: devonIdentity
        });
      },
      /has expired/
    );
  });

  console.log("==================================================");
  console.log(`ACTION GATEWAY RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log("🏆 ALL ACTION GATEWAY LIFECYCLE TESTS GREEN");
    console.log("==================================================");
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

verifyActionGatewayLifecycle().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
