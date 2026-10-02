async function runTests() {
  console.log("==================================================");
  console.log("   STEP 3 VERIFICATION — ACADEMIC HTTP API        ");
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

  const BASE_URL = "http://localhost:5000/api/academic";

  // --- TEST 1: Demo Login for Student ---
  const studentLoginRes = await fetch(`${BASE_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "student", studentId: 1 })
  });
  const studentAuth = await studentLoginRes.json();
  assert(studentLoginRes.status === 200, "POST /auth/demo-login returns HTTP 200 for Student");
  assert(studentAuth.success === true && studentAuth.token, "Student JWT token generated");
  assert(studentAuth.user.role === "student", `Verified role 'student' for ${studentAuth.user.name}`);

  // --- TEST 2: Demo Login for Faculty ---
  const facultyLoginRes = await fetch(`${BASE_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "faculty", facultyId: 150 })
  });
  const facultyAuth = await facultyLoginRes.json();
  assert(facultyLoginRes.status === 200, "POST /auth/demo-login returns HTTP 200 for Faculty");
  assert(facultyAuth.user.role === "faculty", `Verified role 'faculty' for ${facultyAuth.user.name}`);

  // --- TEST 3: Demo Login for Admin ---
  const adminLoginRes = await fetch(`${BASE_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin" })
  });
  const adminAuth = await adminLoginRes.json();
  assert(adminLoginRes.status === 200, "POST /auth/demo-login returns HTTP 200 for Admin");
  assert(adminAuth.user.role === "admin", `Verified role 'admin' for ${adminAuth.user.name}`);

  // --- TEST 4: Student Dashboard Endpoint ---
  const studentDashRes = await fetch(`${BASE_URL}/student/dashboard?studentId=1`);
  const studentDash = await studentDashRes.json();
  assert(studentDashRes.status === 200, "GET /student/dashboard returns HTTP 200");
  assert(studentDash.profile.student.student_id === 1, "Dashboard payload contains student details");
  assert(studentDash.profile.courses.length > 0, `Loaded ${studentDash.profile.courses.length} courses with attendance & risk`);
  assert(studentDash.profile.notifications !== undefined, "Loaded student notification drawer items");

  // --- TEST 5: Faculty Courses Endpoint ---
  const facultyCoursesRes = await fetch(`${BASE_URL}/faculty/courses?facultyId=150`);
  const facultyCourses = await facultyCoursesRes.json();
  assert(facultyCoursesRes.status === 200, "GET /faculty/courses returns HTTP 200");
  assert(facultyCourses.courses.length > 0, `Loaded ${facultyCourses.courses.length} assigned courses`);

  // --- TEST 6: Course Roster Endpoint ---
  const rosterRes = await fetch(`${BASE_URL}/faculty/course/219/roster`);
  const rosterData = await rosterRes.json();
  assert(rosterRes.status === 200, "GET /faculty/course/219/roster returns HTTP 200");
  assert(rosterData.totalStudents > 0, `Course 219 roster contains ${rosterData.totalStudents} enrolled students`);

  // --- TEST 7: AI Voice Mark Parsing Live Endpoint ---
  const voiceRes = await fetch(`${BASE_URL}/faculty/parse-voice-marks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offeringId: 219,
      transcript: "roll forty-five, forty-two out of fifty; Sneha, fifty-five out of fifty"
    })
  });
  const voiceData = await voiceRes.json();
  assert(voiceRes.status === 200, "POST /faculty/parse-voice-marks returns HTTP 200");
  assert(voiceData.batch.totalEntries === 2, `Parsed 2 voice entries from transcript`);
  assert(voiceData.batch.entries[1].isAmbiguous === true, "Caught ambiguous student match ('Sneha')");
  assert(voiceData.batch.entries[1].hasRangeError === true, "Caught out-of-range mark (55 > 50)");

  // --- TEST 8: Submit Verified Marks Endpoint ---
  const submitRes = await fetch(`${BASE_URL}/faculty/submit-marks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facultyName: "Prof. Harish Menon",
      assessmentName: "Internal 1",
      entries: [
        {
          enrollmentId: rosterData.roster[0].enrollment_id,
          obtainedMarks: 46.0,
          maxMarks: 50
        }
      ]
    })
  });
  const submitData = await submitRes.json();
  assert(submitRes.status === 200, "POST /faculty/submit-marks returns HTTP 200");
  assert(submitData.savedCount === 1, "Confirmed 1 mark committed to database");

  // --- TEST 9: At-Risk Students for Course ---
  const atRiskRes = await fetch(`${BASE_URL}/faculty/course/219/at-risk`);
  const atRiskData = await atRiskRes.json();
  assert(atRiskRes.status === 200, "GET /faculty/course/219/at-risk returns HTTP 200");
  assert(atRiskData.totalAtRisk !== undefined, `Identified ${atRiskData.totalAtRisk} at-risk students in course 219`);

  // --- TEST 10: Admin University-Wide Heatmap ---
  const heatmapRes = await fetch(`${BASE_URL}/admin/heatmap`);
  const heatmapData = await heatmapRes.json();
  assert(heatmapRes.status === 200, "GET /admin/heatmap returns HTTP 200");
  assert(heatmapData.summary.total_students === 3000, "Heatmap summary confirms 3000 total students");
  assert(heatmapData.departments.length === 8, "Heatmap includes all 8 academic departments");

  console.log("==================================================");
  console.log(`STEP 3 RESULT: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🏆 MILESTONE 3 VERIFIED 100% GREEN — ALL APIS ONLINE");
  }
  console.log("==================================================");
  process.exit(failed);
}

runTests().catch((err) => {
  console.error("FATAL ERROR in verify_academic_api.js:", err);
  process.exit(1);
});
