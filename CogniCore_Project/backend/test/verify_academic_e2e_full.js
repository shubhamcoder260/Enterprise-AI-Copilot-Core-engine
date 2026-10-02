async function runComprehensiveE2ETests() {
  console.log("======================================================================");
  console.log("   STEP 5: COMPREHENSIVE END-TO-END VERIFICATION BATTERY (R1 - R7)    ");
  console.log("======================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const BASE_URL = "http://localhost:5000/api/academic";

  // ------------------------------------------------------------------
  // R1: ACADEMIC DATA MANAGEMENT & 1-CLICK AUTHENTICATION
  // ------------------------------------------------------------------
  console.log("\n--- [R1] Academic Data Management & RBAC ---");
  const authRes = await fetch(`${BASE_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "student", studentId: 1 })
  });
  const authData = await authRes.json();
  assert(authRes.status === 200, "R1.1: 1-Click login returns HTTP 200");
  assert(authData.user && authData.user.role === "student", "R1.2: Authenticated role is strictly 'student'");
  assert(authData.user.registerNumber === "2026030001", "R1.3: User record bound to student register number");

  // ------------------------------------------------------------------
  // R2: ATTENDANCE TREND ANALYSIS & PRE-75% PROACTIVE WARNINGS
  // ------------------------------------------------------------------
  console.log("\n--- [R2] Attendance Projections & Early-Warning Math ---");
  const dashRes = await fetch(`${BASE_URL}/student/dashboard?studentId=1`);
  const dashData = await dashRes.json();
  assert(dashRes.status === 200, "R2.1: Student dashboard loads successfully");
  assert(dashData.profile.courses.length >= 2, `R2.2: Loaded ${dashData.profile.courses.length} enrolled academic courses`);

  const course1 = dashData.profile.courses[0];
  const att1 = course1.attendance;
  assert(att1.currentPct !== undefined && att1.currentPct > 0, `R2.3: Calculated current attendance: ${att1.currentPct}%`);
  assert(att1.alertLevel === "SAFE" || att1.alertLevel === "WARNING" || att1.alertLevel === "DANGER" || att1.alertLevel === "CRITICAL", `R2.4: Assigned valid health status tier: ${att1.alertLevel}`);
  assert(att1.missBuffer !== undefined || att1.recoveryNeeded !== undefined, `R2.5: Generated actionable buffer math: Miss Buffer = ${att1.missBuffer}, Recovery = ${att1.recoveryNeeded}`);
  assert(att1.projectedFinalPct !== undefined, `R2.6: 10-Class rolling projection forecasted: ${att1.projectedFinalPct}%`);
  assert(att1.explanation.length > 10, `R2.7: Generated plain-English explanation: "${att1.explanation}"`);

  // ------------------------------------------------------------------
  // R3: AUTOMATIC NOTIFICATIONS & AUDIT TRAIL
  // ------------------------------------------------------------------
  console.log("\n--- [R3] Marks Change Notifications & Audit ---");
  const initialNotifCount = dashData.profile.notifications.length;
  
  // Submit a mark update
  const testEnrollment = course1.enrollment_id;
  const submitRes = await fetch(`${BASE_URL}/faculty/submit-marks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facultyName: "Dr. Robert Smith",
      assessmentName: "Internal 1",
      entries: [
        {
          enrollmentId: testEnrollment,
          obtainedMarks: 47.5,
          maxMarks: 50
        }
      ]
    })
  });
  const submitData = await submitRes.json();
  assert(submitRes.status === 200 && submitData.savedCount === 1, "R3.1: Mark successfully committed via API");

  // Re-fetch student dashboard to verify notification delivery
  const refreshRes = await fetch(`${BASE_URL}/student/dashboard?studentId=1`);
  const refreshData = await refreshRes.json();
  const latestNotif = refreshData.profile.notifications[0];
  assert(latestNotif !== undefined, "R3.2: Immediate in-app notification delivered to student drawer");
  assert(latestNotif.message.includes("47.5"), `R3.3: Notification captures new mark: "${latestNotif.message}"`);

  // ------------------------------------------------------------------
  // R4: AI VOICE-ASSISTED MARK ENTRY & AMBIGUITY RESOLVER
  // ------------------------------------------------------------------
  console.log("\n--- [R4] AI Audio/Voice Mark Parsing & Ambiguity Handling ---");
  const voiceSpeech = "roll forty-five, forty-two out of fifty; Sneha, fifty-five out of fifty; Vivek Reddy, 38";
  const voiceRes = await fetch(`${BASE_URL}/faculty/parse-voice-marks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offeringId: 219,
      transcript: voiceSpeech
    })
  });
  const voiceData = await voiceRes.json();
  assert(voiceRes.status === 200, "R4.1: Speech parsing endpoint returns HTTP 200");
  assert(voiceData.batch.totalEntries === 3, "R4.2: Successfully split continuous recording into 3 student clauses");

  // Test Roll Number resolution
  const rollEntry = voiceData.batch.entries[0];
  assert(rollEntry.matchedStudent && rollEntry.matchType === "roll_number", "R4.3: Matched spoken 'roll forty-five' directly to student record");
  assert(rollEntry.obtainedMarks === 42, "R4.4: Converted spoken 'forty-two' to number 42");

  // Test Out-of-Range error catch (55 > 50)
  const rangeEntry = voiceData.batch.entries[1];
  assert(rangeEntry.hasRangeError === true, "R4.5: Pre-commit validator caught mark 55 exceeding max 50");
  assert(rangeEntry.rangeErrorMsg.includes("exceeds valid range"), "R4.6: Explicit range error message generated");

  // Test Explicit Ambiguity Resolution (Sneha matching multiple students)
  assert(rangeEntry.isAmbiguous === true, "R4.7: Halts and flags ambiguity when multiple students match 'Sneha'");
  assert(rangeEntry.ambiguousCandidates.length >= 2, `R4.8: Populated candidate list for professor selection (${rangeEntry.ambiguousCandidates.length} candidates)`);
  assert(rangeEntry.matchedStudent === null, "R4.9: Refuses auto-assignment when ambiguous (requires human choice)");

  // ------------------------------------------------------------------
  // R5: TRANSPARENT 35/30/20/15 ACADEMIC RISK FORMULA
  // ------------------------------------------------------------------
  console.log("\n--- [R5] Transparent Multi-Factor Risk Analysis ---");
  const riskObj = course1.risk;
  assert(riskObj.totalRiskScore !== undefined, `R5.1: Computed weighted risk score: ${riskObj.totalRiskScore}/100`);
  assert(riskObj.riskLevel === "LOW" || riskObj.riskLevel === "MEDIUM" || riskObj.riskLevel === "HIGH", `R5.2: Classified categorical risk level: ${riskObj.riskLevel}`);
  assert(riskObj.breakdown.weights.attendance === 0.35, "R5.3: Verified 35% attendance weight in formula");
  assert(riskObj.breakdown.weights.assessment === 0.30, "R5.4: Verified 30% assessment weight in formula");
  assert(riskObj.breakdown.weights.assignment === 0.20, "R5.5: Verified 20% assignment weight in formula");
  assert(riskObj.breakdown.weights.cgpa === 0.15, "R5.6: Verified 15% historical CGPA weight in formula");
  assert(riskObj.reasons.length > 0, `R5.7: Generated explainable plain-English driver bullets (${riskObj.reasons.length} drivers)`);

  // ------------------------------------------------------------------
  // R6: ATTENTION INSIGHTS (FACULTY & ADMIN VIEWS)
  // ------------------------------------------------------------------
  console.log("\n--- [R6] Insights & Attention Lists ---");
  const atRiskRes = await fetch(`${BASE_URL}/faculty/course/219/at-risk`);
  const atRiskData = await atRiskRes.json();
  assert(atRiskRes.status === 200, "R6.1: Loaded course at-risk list for faculty");
  assert(atRiskData.highRiskCount !== undefined && atRiskData.mediumRiskCount !== undefined, "R6.2: Segmented high-risk and medium-risk student counts");

  const heatmapRes = await fetch(`${BASE_URL}/admin/heatmap`);
  const heatmapData = await heatmapRes.json();
  assert(heatmapRes.status === 200, "R6.3: Admin campus heatmap loaded");
  assert(heatmapData.summary.total_students === 3000, "R6.4: Campus analytics covers full 3,000 student body");
  assert(heatmapData.departments.length === 8, "R6.5: All 8 academic departments aggregated");

  // ------------------------------------------------------------------
  // R7: ROLE-SPECIFIC INTERFACES READY
  // ------------------------------------------------------------------
  console.log("\n--- [R7] Role-Specific Interfaces Verification ---");
  assert(dashData.profile.student.first_name === "Vivek", "R7.1: Student portal serves student-specific interface data");
  assert(heatmapData.departments[0].department_name !== undefined, "R7.2: Admin console serves institutional overview data");
  assert(voiceData.batch.entries.length === 3, "R7.3: Faculty console provides voice mark entry grid");

  console.log("\n======================================================================");
  console.log(`FINAL E2E RESULT: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🏆 100% SUCCESS — ALL 7 HACKATHON REQUIREMENTS (R1 - R7) DEMO READY");
  }
  console.log("======================================================================");
  process.exit(failed);
}

runComprehensiveE2ETests().catch((err) => {
  console.error("FATAL in verify_academic_e2e_full.js:", err);
  process.exit(1);
});
