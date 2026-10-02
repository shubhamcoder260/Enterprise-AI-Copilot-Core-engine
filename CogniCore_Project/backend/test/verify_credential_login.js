import assert from "assert";

async function run() {
  console.log("Testing Credential-Based Authentication for Student, Faculty, and Admin...");

  // 1. Student by email
  const resStudentEmail = await fetch("http://localhost:5000/api/academic/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "vivek.reddy1@student.edu", password: "password123", role: "student" })
  });
  const dataStudentEmail = await resStudentEmail.json();
  assert.strictEqual(resStudentEmail.status, 200, "Student email login should return 200");
  assert.strictEqual(dataStudentEmail.user.role, "student", "Role should be student");
  assert.strictEqual(dataStudentEmail.user.name, "Vivek Reddy", "User name should be Vivek Reddy");
  console.log("✅ Student login by email passed:", dataStudentEmail.user.name);

  // 2. Student by register number
  const resStudentRoll = await fetch("http://localhost:5000/api/academic/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "2026030001", password: "password123", role: "student" })
  });
  const dataStudentRoll = await resStudentRoll.json();
  assert.strictEqual(resStudentRoll.status, 200, "Student register number login should return 200");
  assert.strictEqual(dataStudentRoll.user.registerNumber, "2026030001");
  console.log("✅ Student login by register number passed:", dataStudentRoll.user.registerNumber);

  // 3. Faculty by employee ID
  const resFacultyCode = await fetch("http://localhost:5000/api/academic/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "FAC0001", password: "faculty_pass", role: "faculty" })
  });
  const dataFacultyCode = await resFacultyCode.json();
  assert.strictEqual(resFacultyCode.status, 200, "Faculty code login should return 200");
  assert.strictEqual(dataFacultyCode.user.role, "faculty", "Role should be faculty");
  assert.strictEqual(dataFacultyCode.user.employeeNumber, "FAC0001");
  console.log("✅ Faculty login by employee code passed:", dataFacultyCode.user.name);

  // 4. Admin login
  const resAdmin = await fetch("http://localhost:5000/api/academic/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin@university.edu", password: "admin123", role: "admin" })
  });
  const dataAdmin = await resAdmin.json();
  assert.strictEqual(resAdmin.status, 200, "Admin login should return 200");
  assert.strictEqual(dataAdmin.user.role, "admin", "Role should be admin");
  console.log("✅ Admin login passed:", dataAdmin.user.name);

  // 5. Invalid credentials rejection
  const resInvalid = await fetch("http://localhost:5000/api/academic/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "nonexistent_person_999@univ.edu", password: "pass", role: "student" })
  });
  assert.strictEqual(resInvalid.status, 404, "Unknown identifier should return 404");
  console.log("✅ Unknown identifier rejection passed (HTTP 404)");

  console.log("\n🏆 ALL 5 CREDENTIAL AUTHENTICATION CHECKS PASSED!");
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
