import {
  calculateAttendanceMetrics,
  calculateSubjectRisk,
  getStudentAcademicProfile,
  saveOrUpdateMark,
  getAcademicDb
} from "../src/services/academic.service.js";

async function runTests() {
  console.log("==================================================");
  console.log("   STEP 1 VERIFICATION — ACADEMIC SERVICE CORE    ");
  console.log("==================================================");

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

  // --- TEST 1: R2 Attendance Safe Tier & Buffer ---
  // Attended: 48, Held: 50 -> 96%
  const safeMetrics = calculateAttendanceMetrics(48, 50);
  assert(safeMetrics.alertLevel === "SAFE", "Identifies >= 80% as SAFE alert level");
  assert(safeMetrics.currentPct === 96.0, "Computes exact 96.0% attendance");
  // 48 - 0.75*50 = 48 - 37.5 = 10.5 / 0.75 = 14 classes can be missed
  assert(safeMetrics.missBuffer === 14, `Calculates exact miss buffer (expected 14, got ${safeMetrics.missBuffer})`);

  // --- TEST 2: R2 Attendance Warning Tier & Pre-75% Early Alert ---
  // Attended: 39, Held: 50 -> 78% (trending close to 75%)
  const warningMetrics = calculateAttendanceMetrics(39, 50);
  assert(warningMetrics.alertLevel === "WARNING", "Identifies 78% as WARNING alert level");
  // 39 - 0.75*50 = 39 - 37.5 = 1.5 / 0.75 = 2 classes can be missed
  assert(warningMetrics.missBuffer === 2, `Calculates exact miss buffer (expected 2, got ${warningMetrics.missBuffer})`);
  assert(warningMetrics.explanation.includes("75%"), "Generates plain-English warning message mentioning 75%");

  // --- TEST 3: R2 Attendance Danger Tier & Recovery Target ---
  // Attended: 36, Held: 50 -> 72% (Danger tier, below 75%)
  const dangerMetrics = calculateAttendanceMetrics(36, 50);
  assert(dangerMetrics.alertLevel === "DANGER", "Identifies 72% as DANGER alert level");
  // 0.75*50 - 36 = 37.5 - 36 = 1.5 / 0.25 = 6 consecutive classes to recover
  assert(dangerMetrics.recoveryNeeded === 6, `Calculates exact consecutive recovery target (expected 6, got ${dangerMetrics.recoveryNeeded})`);

  // --- TEST 4: R2 Critical Tier (<70%) ---
  const critMetrics = calculateAttendanceMetrics(30, 50);
  assert(critMetrics.alertLevel === "CRITICAL", "Identifies 60% as CRITICAL alert level");

  // --- TEST 5: R5 Multi-Factor Academic Risk Formula (35/30/20/15) ---
  // Case A: High Risk Student (72% attendance, failing marks 18/50, 2 missing assignments, 5.2 CGPA)
  const highRisk = calculateSubjectRisk({
    attendancePct: 72.0,
    internalMarks: [{ obtained_marks: 18, max_marks: 50 }],
    classAvgMarks: 35.0,
    assignments: [{ status: "Pending" }, { status: "Pending" }],
    cgpa: 5.2
  });
  assert(highRisk.riskLevel === "HIGH", `Classifies high risk correctly (Level: ${highRisk.riskLevel}, Score: ${highRisk.totalRiskScore})`);
  assert(highRisk.reasons.length >= 3, `Generates plain-English reasons (${highRisk.reasons.length} driver reasons identified)`);

  // Case B: Low Risk Student (90% attendance, good marks 42/50, all submitted, 8.5 CGPA)
  const lowRisk = calculateSubjectRisk({
    attendancePct: 90.0,
    internalMarks: [{ obtained_marks: 42, max_marks: 50 }],
    classAvgMarks: 35.0,
    assignments: [{ status: "Submitted" }, { status: "Submitted" }],
    cgpa: 8.5
  });
  assert(lowRisk.riskLevel === "LOW", `Classifies low risk correctly (Level: ${lowRisk.riskLevel}, Score: ${lowRisk.totalRiskScore})`);

  // --- TEST 6: Real Database Query against student_erp.db ---
  const profile = await getStudentAcademicProfile(1);
  assert(profile !== null, "Loads academic profile for student 1 from student_erp.db");
  assert(profile.student.student_id === 1, `Verified student record: ${profile.student.first_name} ${profile.student.last_name}`);
  assert(profile.courses.length > 0, `Loaded ${profile.courses.length} enrolled courses with attendance and risk calculations`);
  assert(profile.courses[0].attendance.alertLevel !== undefined, "Enrolled course has complete attendance metrics");
  assert(profile.courses[0].risk.totalRiskScore !== undefined, "Enrolled course has transparent risk score");

  // --- TEST 7: R3 Marks Mutation, Audit & In-App Notification Dispatch ---
  const testEnrollmentId = profile.courses[0].enrollment_id;
  const saveResult = await saveOrUpdateMark({
    enrollmentId: testEnrollmentId,
    assessmentName: "Internal 1",
    obtainedMarks: 44.5,
    maxMarks: 50,
    facultyName: "Dr. Robert Smith"
  });
  assert(saveResult.success === true, "Successfully saved mark via saveOrUpdateMark");
  assert(saveResult.newMark === 44.5, "New mark verified as 44.5");

  // Verify in-app notification was inserted for student 1
  const db = await getAcademicDb();
  const latestNotif = await db.get(
    `SELECT * FROM notifications WHERE student_id = 1 ORDER BY notification_id DESC LIMIT 1`
  );
  assert(latestNotif !== null, "Verified notification record exists in notifications table");
  assert(latestNotif.message.includes("44.5"), `Notification message confirms mark update: "${latestNotif.message}"`);

  console.log("==================================================");
  console.log(`STEP 1 RESULT: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🏆 MILESTONE 1 VERIFIED 100% GREEN");
  }
  console.log("==================================================");
  process.exit(failed);
}

runTests().catch((err) => {
  console.error("FATAL ERROR in verify_academic_service.js:", err);
  process.exit(1);
});
