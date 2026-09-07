export function detectIntent(query, organization) {
  const q = query.toLowerCase();

  // ==========================================
  // HOSPITAL PATIENT ANALYTICS
  // ==========================================
  const hospitalDepts = ["cardiology", "neurology", "oncology", "pediatrics", "radiology", "orthopedics"];
  const mentionsDept = hospitalDepts.some((dept) => q.includes(dept));
  const mentionsVisit = q.includes("visit") || q.includes("admission") || q.includes("admitted");
  const mentionsPatient = q.includes("patient");
  const isHospitalContext = organization === "hospital" || q.includes("hospital");

  if (
    (mentionsDept && (mentionsVisit || mentionsPatient || isHospitalContext)) ||
    (isHospitalContext && (mentionsVisit || (mentionsPatient && mentionsVisit))) ||
    (mentionsPatient && mentionsVisit)
  ) {
    return "hospital_patient_analytics";
  }

  // ==========================================
  // FOREIGN STUDENT FIXED CAPABILITY
  // ==========================================
  if (
    (q.includes("foreign") || q.includes("international") || q.includes("outside") || q.includes("domestic country") || q.includes("home country")) &&
    (q.includes("student") || q.includes("enrolled") || q.includes("admission") || q.includes("enrollment"))
  ) {
    return "education_foreign_students";
  }

  // ==========================================
  // CGPA FIXED CAPABILITY
  // ==========================================
  const hasCgpaKeyword = q.includes("cgpa") || q.includes("grade point") || /\bgpa\b/.test(q);
  const isEducationScoreQuery =
    (organization === "education" || organization === "college" || q.includes("student")) &&
    /\b\d+(?:\.\d+)?\s*(?:\+|or\s*(?:higher|above|lower|below|more|less)|and\s*(?:higher|above|lower|below|more|less))\b/i.test(q);

  if (hasCgpaKeyword || isEducationScoreQuery) {
    return "education_cgpa_analytics";
  }

  // ==========================================
  // ALL OTHER QUERIES GO TO DYNAMIC ENGINE
  // ==========================================
  return "unknown";
}