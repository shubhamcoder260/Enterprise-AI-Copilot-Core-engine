export function detectIntent(query, organization) {
  const q = query.toLowerCase();

  // ==========================================
  // HOSPITAL FIXED CAPABILITY
  // ==========================================
  if (
    organization === "hospital" &&
    q.includes("cardiology") &&
    (q.includes("september 2026") || q.includes("2026-09"))
  ) {
    return "hospital_patient_analytics";
  }

  // ==========================================
  // FOREIGN STUDENT FIXED CAPABILITY
  // ==========================================
  if (
    (q.includes("foreign") || q.includes("international")) &&
    q.includes("2026")
  ) {
    return "education_foreign_students";
  }

  // ==========================================
  // ALL CGPA QUERIES AND OTHER QUERIES
  // GO TO DYNAMIC QUERY ENGINE
  // ==========================================
  return "unknown";
}