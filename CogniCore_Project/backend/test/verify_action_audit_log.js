// ============================================================================
// VERIFICATION: ACTION AUDIT LOG (PHASE D5 EXIT CRITERION 5)
// Confirms:
//   1. Append-only property (prohibited update/delete).
//   2. Cryptographic SHA-256 hash-chain forward linkage.
//   3. Tamper detection on simulated mutation.
//   4. Immutability of returned entries.
// ============================================================================

import assert from "node:assert/strict";
import { ActionAuditLog } from "../src/store/action.audit.log.js";

async function verifyActionAuditLog() {
  console.log("==================================================");
  console.log("   STEP D5 — VERIFY ACTION AUDIT LOG INTEGRITY    ");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // Use isolated memory instance
  const log = new ActionAuditLog({ autoPersist: false });

  // TEST 1: Append-only invariants (no update/delete/truncate)
  test("Append-only property: update/delete/truncate access throws errors", () => {
    assert.throws(() => {
      const _ = log.update;
    }, /append-only: update\(\) is prohibited/i);

    assert.throws(() => {
      const _ = log.delete;
    }, /append-only: delete\(\) is prohibited/i);

    assert.throws(() => {
      const _ = log.truncate;
    }, /append-only: truncate\(\) is prohibited/i);
  });

  // TEST 2: Appending records creates valid sequence and hash chain
  test("Hash-chain generation: sequential entries chain SHA-256 contentHash", () => {
    const e1 = log.appendEntry({
      actionId: "act-001",
      phase: "PROPOSAL",
      identity: { userId: "devon.vance", employeeId: "EMP-002", roles: ["Employee"] },
      templateId: "UPDATE_OWN_CONTACT",
      targetTable: "tabEmployee",
      parameters: { employeeId: "EMP-002", cellNumber: "555-0102" },
      dryRun: true
    });

    const e2 = log.appendEntry({
      actionId: "act-001",
      phase: "APPROVAL",
      identity: { userId: "devon.vance", employeeId: "EMP-002", roles: ["Employee"] },
      templateId: "UPDATE_OWN_CONTACT",
      targetTable: "tabEmployee",
      dryRun: false
    });

    const e3 = log.appendEntry({
      actionId: "act-001",
      phase: "EXECUTION",
      identity: { userId: "devon.vance", employeeId: "EMP-002", roles: ["Employee"] },
      templateId: "UPDATE_OWN_CONTACT",
      targetTable: "tabEmployee",
      executionResult: { status: "SUCCESS", rowsAffected: 1, durationMs: 14 }
    });

    assert.strictEqual(e1.sequence, 0);
    assert.strictEqual(e2.sequence, 1);
    assert.strictEqual(e3.sequence, 2);

    assert.strictEqual(e2.previousHash, e1.contentHash);
    assert.strictEqual(e3.previousHash, e2.contentHash);

    const check = log.verifyIntegrity();
    assert.ok(check.valid, `Integrity check failed: ${check.error}`);
    assert.strictEqual(check.verifiedCount, 3);
  });

  // TEST 3: Returned entries are frozen (cannot be mutated by caller)
  test("Immutability: entries returned by getEntries are frozen", () => {
    const entries = log.getEntries();
    assert.ok(entries.length === 3);
    assert.ok(Object.isFrozen(entries[0]));

    assert.throws(() => {
      entries[0].phase = "TAMPERED";
    }, /Cannot assign to read only property|read only/i);
  });

  // TEST 4: Tamper detection if underlying store is modified
  test("Tamper detection: deliberate corruption of hash chain fails verifyIntegrity()", () => {
    // Deliberately tamper with internal array in test harness
    const fakeLog = new ActionAuditLog({ autoPersist: false });
    fakeLog.appendEntry({ actionId: "tx-1", phase: "PROPOSAL" });
    fakeLog.appendEntry({ actionId: "tx-2", phase: "PROPOSAL" });

    // Directly corrupt entry 0
    fakeLog._entries[0] = { ...fakeLog._entries[0], phase: "CORRUPTED" };

    const check = fakeLog.verifyIntegrity();
    assert.strictEqual(check.valid, false, "Integrity check must fail when record content is altered");
    assert.ok(/Tamper detected at sequence 0/i.test(check.error));
  });

  console.log("==================================================");
  console.log(`ACTION AUDIT LOG RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log("🏆 ALL ACTION AUDIT LOG INTEGRITY TESTS GREEN");
    console.log("==================================================");
  } else {
    console.error(`💥 ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

verifyActionAuditLog().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
