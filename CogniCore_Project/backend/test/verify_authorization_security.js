import assert from "assert";

const BASE_URL = "http://localhost:5000/api/academic";

async function runAuthSecurityTests() {
  console.log("======================================================================");
  console.log("   SECURITY & OBJECT-LEVEL AUTHORIZATION (IDOR) ADVERSARIAL SUITE     ");
  console.log("======================================================================");

  let passed = 0;
  let failed = 0;

  function record(success, msg) {
    if (success) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. Unauthenticated Student Dashboard Request
  const resUnauth = await fetch(`${BASE_URL}/student/dashboard?studentId=1`);
  record(resUnauth.status === 401, `Test 1: Unauthenticated student dashboard probe rejected (Status: ${resUnauth.status}, Expected: 401)`);

  // 2. Unauthenticated Faculty Mark Submission Probe
  const resUnauthSubmit = await fetch(`${BASE_URL}/faculty/submit-marks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries: [{ enrollmentId: 1, obtainedMarks: 50 }] })
  });
  record(resUnauthSubmit.status === 401, `Test 2: Unauthenticated mark submission probe rejected (Status: ${resUnauthSubmit.status}, Expected: 401)`);

  // 3. Login as Student 1 (Vivek Reddy)
  const loginStudent1 = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "vivek.reddy1@student.edu", password: "password123", role: "student" })
  });
  const dataStudent1 = await loginStudent1.json();
  const tokenStudent1 = dataStudent1.token;

  // 4. Student 1 requests their own profile (Legitimate)
  const resOwnProfile = await fetch(`${BASE_URL}/student/dashboard?studentId=1`, {
    headers: { "Authorization": `Bearer ${tokenStudent1}` }
  });
  record(resOwnProfile.status === 200, `Test 3: Student 1 accessing own dashboard allowed (Status: ${resOwnProfile.status}, Expected: 200)`);

  // 5. Student 1 attempts IDOR probe to access Student 2's profile
  const resIdorStudent2 = await fetch(`${BASE_URL}/student/dashboard?studentId=2`, {
    headers: { "Authorization": `Bearer ${tokenStudent1}` }
  });
  record(resIdorStudent2.status === 403, `Test 4: Student 1 IDOR probe to Student 2 rejected (Status: ${resIdorStudent2.status}, Expected: 403)`);

  // 6. Student 1 attempts unauthorized mark mutation on Faculty route
  const resStudentSubmit = await fetch(`${BASE_URL}/faculty/submit-marks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenStudent1}`
    },
    body: JSON.stringify({ entries: [{ enrollmentId: 1, obtainedMarks: 50 }] })
  });
  record(resStudentSubmit.status === 403, `Test 5: Student role submitting marks rejected (Status: ${resStudentSubmit.status}, Expected: 403)`);

  // 7. Login as Faculty 1 (Prof. Karthik Menon)
  const loginFaculty = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "FAC0001", password: "password123", role: "faculty" })
  });
  const dataFaculty = await loginFaculty.json();
  const tokenFaculty = dataFaculty.token;

  // 8. Faculty accessing course roster
  const resFacultyRoster = await fetch(`${BASE_URL}/faculty/course/217/roster`, {
    headers: { "Authorization": `Bearer ${tokenFaculty}` }
  });
  record(resFacultyRoster.status === 200, `Test 6: Faculty accessing course roster allowed (Status: ${resFacultyRoster.status}, Expected: 200)`);

  // 9. Login as Admin
  const loginAdmin = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin@university.edu", password: "admin123", role: "admin" })
  });
  const dataAdmin = await loginAdmin.json();
  const tokenAdmin = dataAdmin.token;

  // 10. Admin accessing campus heatmap
  const resAdminHeatmap = await fetch(`${BASE_URL}/admin/heatmap`, {
    headers: { "Authorization": `Bearer ${tokenAdmin}` }
  });
  record(resAdminHeatmap.status === 200, `Test 7: Admin accessing campus heatmap allowed (Status: ${resAdminHeatmap.status}, Expected: 200)`);

  console.log("\n======================================================================");
  console.log(`AUTHORIZATION TEST RESULT: ${passed} passed, ${failed} failed`);
  console.log("======================================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runAuthSecurityTests().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
