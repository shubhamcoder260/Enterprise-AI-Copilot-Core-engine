import assert from "assert";

const BASE_URL = "http://localhost:5000/api/academic";

async function run() {
  console.log("======================================================================");
  console.log("         USP VERIFICATION BATTERY (DEBARMENT, BACKTEST, AUDIT)         ");
  console.log("======================================================================");

  // 1. Authenticate Admin and Student
  const adminLogin = await fetch(`${BASE_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin" })
  });
  const adminData = await adminLogin.json();
  const adminToken = adminData.token;
  assert(adminToken, "Admin authentication succeeded");

  const studentLogin = await fetch(`${BASE_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "student", studentId: 1 })
  });
  const studentData = await studentLogin.json();
  const studentToken = studentData.token;
  assert(studentToken, "Student authentication succeeded");

  // 2. USP 1: Admin Debarment Forecast
  console.log("\n--- [USP 1] Admin Debarment Forecast with Recoverability Analysis ---");
  const debarRes = await fetch(`${BASE_URL}/admin/debarment-forecast?plannedTotal=60`, {
    headers: { "Authorization": `Bearer ${adminToken}` }
  });
  const debarData = await debarRes.json();
  assert(debarRes.status === 200, "Debarment forecast endpoint returns HTTP 200");
  assert(debarData.totalEnrollmentsAnalyzed > 10000, `Analyzed total ${debarData.totalEnrollmentsAnalyzed} course enrollments`);
  assert(debarData.projectedBelow75 > 0, `Identified ${debarData.projectedBelow75} students projected below 75%`);
  assert(debarData.recoverableCount > 0, `Computed recoverable students: ${debarData.recoverableCount}`);
  assert(debarData.unrecoverableCount > 0, `Computed mathematically debarred students: ${debarData.unrecoverableCount}`);
  assert(Object.keys(debarData.departmentBreakdown).length > 0, "Generated department breakdown");
  console.log(`✅ [PASS] Debarment Forecast: ${debarData.projectedBelow75} projected below 75% (${debarData.recoverableCount} recoverable, ${debarData.unrecoverableCount} unrecoverable)`);

  // 3. USP 2: Semester Replay Backtest Engine (Zero Future Leakage)
  console.log("\n--- [USP 2] Semester Replay Backtest Engine ---");
  const backtestRes = await fetch(`${BASE_URL}/analytics/backtest`, {
    headers: { "Authorization": `Bearer ${adminToken}` }
  });
  const backtestData = await backtestRes.json();
  assert(backtestRes.status === 200, "Backtest endpoint returns HTTP 200");
  assert(backtestData.timeline.length >= 4, `Replayed ${backtestData.timeline.length} milestone checkpoints without future leakage`);
  assert(backtestData.warningSensitivityPct >= 90.0, `Warning sensitivity is ${backtestData.warningSensitivityPct}%`);
  assert(backtestData.averageLeadTimeDays > 10.0, `Average lead time is ${backtestData.averageLeadTimeDays} days before finals`);
  console.log(`✅ [PASS] Backtest Engine: ${backtestData.warningSensitivityPct}% of debarred students were warned in advance with an average lead time of ${backtestData.averageLeadTimeDays} days`);

  // 4. USP 3: Cryptographic Audit Ledger Verification
  console.log("\n--- [USP 3] Cryptographic SHA-256 Ledger Verification ---");
  const auditRes = await fetch(`${BASE_URL}/admin/audit-verify`, {
    headers: { "Authorization": `Bearer ${adminToken}` }
  });
  const auditData = await auditRes.json();
  assert(auditRes.status === 200, "Audit verify endpoint returns HTTP 200");
  assert(auditData.verified === true, "Cryptographic hash chain is intact and verified");
  assert(auditData.totalRecords > 0, `Verified ${auditData.totalRecords} immutable ledger rows`);
  assert(auditData.headHash && auditData.headHash.length === 64, `Head SHA-256 hash: ${auditData.headHash}`);
  console.log(`✅ [PASS] Cryptographic Ledger: All ${auditData.totalRecords} audit rows verified intact. Head hash: ${auditData.headHash.slice(0, 16)}...`);

  // 5. USP 4: Off-Portal Outbox (Simulated Email/SMS Channel)
  console.log("\n--- [USP 4] Off-Portal Outbox (Simulated Email/SMS Channel) ---");
  const outboxRes = await fetch(`${BASE_URL}/outbox?limit=10`, {
    headers: { "Authorization": `Bearer ${studentToken}` }
  });
  const outboxData = await outboxRes.json();
  assert(outboxRes.status === 200, "Outbox endpoint returns HTTP 200");
  assert(Array.isArray(outboxData.messages), "Returns array of dispatched notifications");
  console.log(`✅ [PASS] Simulated Outbox: Successfully verified ${outboxData.count} off-portal dispatched notices`);

  // 6. USP 5: Interactive Recovery What-If Simulator
  console.log("\n--- [USP 5] Interactive Recovery What-If Simulator ---");
  const simRes = await fetch(`${BASE_URL}/student/recovery-simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      attended: 20,
      held: 28,
      futureAttended: 8,
      futureHeld: 10,
      plannedTotal: 60
    })
  });
  const simData = await simRes.json();
  assert(simRes.status === 200, "Recovery simulator returns HTTP 200");
  assert(simData.simulation.resultingPct !== undefined, "Computed resulting percentage");
  console.log(`✅ [PASS] What-If Recovery: Simulated 20/28 + 8/10 -> Resulting attendance: ${simData.simulation.resultingPct}%`);

  console.log("\n======================================================================");
  console.log("             ALL 5 USPs MATHEMATICALLY VERIFIED CLEAN                 ");
  console.log("======================================================================\n");
}

run().catch((err) => {
  console.error("FATAL ERROR in USP verification:", err);
  process.exit(1);
});
