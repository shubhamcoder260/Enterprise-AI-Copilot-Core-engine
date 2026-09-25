import assert from 'assert';
import {
  acquireQueryLease,
  releaseQueryLease,
  getActiveLeaseCount,
  switchTo,
  getActiveSource,
  resetOrchestratorState
} from '../src/kernel/switch.orchestrator.js';

console.log("==================================================");
console.log("   VERIFYING SWITCH ORCHESTRATOR & LEASE LIFECYCLE ");
console.log("==================================================");

async function testOrchestrator() {
  resetOrchestratorState();

  // Test 1: Single lease acquire and release
  console.log("\n[Test 1] Single lease acquire and release...");
  const lease1 = await acquireQueryLease();
  assert.strictEqual(getActiveLeaseCount(), 1, "Lease count must be 1");
  lease1.release();
  assert.strictEqual(getActiveLeaseCount(), 0, "Lease count must be 0 after release");
  console.log("  ✅ Single lease lifecycle passed");

  // Test 2: Concurrent leases
  console.log("\n[Test 2] Multiple concurrent leases...");
  const l1 = await acquireQueryLease();
  const l2 = await acquireQueryLease();
  const l3 = await acquireQueryLease();
  assert.strictEqual(getActiveLeaseCount(), 3, "Lease count must be 3");
  l1.release();
  l2.release();
  l3.release();
  assert.strictEqual(getActiveLeaseCount(), 0, "Lease count must be 0 after all released");
  console.log("  ✅ Concurrent leases passed");

  // Test 3: Case SO-05 - Simulated error releases lease cleanly (no deadlock)
  console.log("\n[Test 3] Case SO-05 - Simulated throw in try/finally releases lease...");
  try {
    const errorLease = await acquireQueryLease();
    try {
      assert.strictEqual(getActiveLeaseCount(), 1, "Lease must be active");
      throw new Error("Simulated query execution explosion");
    } finally {
      errorLease.release();
    }
  } catch (err) {
    assert.strictEqual(err.message, "Simulated query execution explosion");
  }
  assert.strictEqual(getActiveLeaseCount(), 0, "Case SO-05: Lease count must be 0 after throw in finally");
  console.log("  ✅ Case SO-05: Error throw releases lease cleanly without deadlock");

  // Test 4: Switch waiting for lease to drain
  console.log("\n[Test 4] Switch coordinates with active lease...");
  const inFlightLease = await acquireQueryLease();
  let switchCompleted = false;

  const switchPromise = switchTo({ id: "mariadb_source", kind: "mariadb", dialect: "mariadb" }).then(() => {
    switchCompleted = true;
  });

  // Switch should be waiting because inFlightLease is held
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(switchCompleted, false, "Switch must wait for in-flight lease to drain");

  // Releasing lease should unblock switch
  inFlightLease.release();
  await switchPromise;
  assert.strictEqual(switchCompleted, true, "Switch completes after lease released");
  assert.strictEqual(getActiveSource().dialect, "mariadb", "Active source must be updated to mariadb");
  console.log("  ✅ Switch drain coordination passed");

  resetOrchestratorState();
  console.log("\n==================================================");
  console.log("🏆 ALL SWITCH ORCHESTRATOR TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

testOrchestrator().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
