import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate student_erp.db
function getDatabasePath() {
  if (process.env.STUDENT_ERP_DB_PATH && fs.existsSync(process.env.STUDENT_ERP_DB_PATH)) {
    return process.env.STUDENT_ERP_DB_PATH;
  }
  const candidatePaths = [
    path.resolve(__dirname, "../../../../database_test/student_erp.db"),
    path.resolve(__dirname, "../../data/student_erp.db"),
    path.resolve(process.cwd(), "Cognicore/database_test/student_erp.db"),
    path.resolve(process.cwd(), "student_erp.db")
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return candidatePaths[0];
}

let dbInstance = null;

export async function getAcademicDb() {
  if (dbInstance) return dbInstance;
  const dbPath = getDatabasePath();
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  // Enable foreign keys
  await dbInstance.run("PRAGMA foreign_keys = ON;");
  return dbInstance;
}

/**
 * R2: Attendance Trend Analysis & Early-Warning Calculations
 */
export function calculateAttendanceMetrics(attended, held, recentRecords = [], plannedTotalClasses = 60) {
  const currentPct = held > 0 ? (attended / held) * 100 : 100;
  const roundedPct = Number(currentPct.toFixed(2));

  // Trajectory over recent classes (last 10 classes)
  const last10 = recentRecords.slice(0, 10);
  const recentHeld = last10.length;
  const recentAttended = last10.filter((r) => r.status === "Present" || r.status === "Late").length;
  const recentRate = recentHeld > 0 ? recentAttended / recentHeld : currentPct / 100;

  // Project final percentage to semester end
  const remainingClasses = Math.max(0, plannedTotalClasses - held);
  const projectedAttended = attended + recentRate * remainingClasses;
  const projectedFinalPct = Number(((projectedAttended / plannedTotalClasses) * 100).toFixed(2));

  // Actionable Numbers:
  // 1. Buffer: How many classes can be missed while staying >= 75%
  // Formula: floor((attended - 0.75 * held) / 0.75)
  let missBuffer = 0;
  if (roundedPct >= 75.0) {
    missBuffer = Math.max(0, Math.floor((attended - 0.75 * held) / 0.75));
  }

  // 2. Recovery: Consecutive classes to attend to recover to 75%
  // Formula: ceil((0.75 * held - attended) / (1 - 0.75))
  let recoveryNeeded = 0;
  if (roundedPct < 75.0) {
    recoveryNeeded = Math.max(0, Math.ceil((0.75 * held - attended) / 0.25));
  }

  // Alert Level determination:
  // SAFE: >= 80% (and projected >= 75%)
  // WARNING: 75% to 79.99%, OR currently >= 75% but projected < 75% (early warning)
  // DANGER: 70% to 74.99%
  // CRITICAL: < 70%
  let alertLevel = "SAFE";
  let proactiveWarning = false;

  if (roundedPct < 70.0) {
    alertLevel = "CRITICAL";
  } else if (roundedPct < 75.0) {
    alertLevel = "DANGER";
  } else if (roundedPct < 80.0) {
    alertLevel = "WARNING";
  } else if (projectedFinalPct < 75.0) {
    alertLevel = "WARNING";
    proactiveWarning = true;
  }

  // Plain-English Explanation
  let explanation = "";
  if (alertLevel === "SAFE") {
    explanation = `Your attendance is in the SAFE zone (${roundedPct}%). You can miss up to ${missBuffer} more class(es) while staying above 75%.`;
  } else if (alertLevel === "WARNING") {
    if (proactiveWarning) {
      explanation = `Proactive Warning: Although current attendance is ${roundedPct}%, your recent velocity (${(recentRate * 100).toFixed(0)}%) projects a drop to ${projectedFinalPct}% below the 75% exam threshold. You can miss at most ${missBuffer} more class(es).`;
    } else {
      explanation = `At your current rate (${roundedPct}%), you are trending near the threshold. You can miss ${missBuffer} more class(es) before dropping below 75%.`;
    }
  } else if (alertLevel === "DANGER") {
    explanation = `DANGER: Your attendance has fallen to ${roundedPct}%. You must attend ${recoveryNeeded} consecutive class(es) without absence to restore eligibility.`;
  } else {
    explanation = `CRITICAL: Your attendance is ${roundedPct}% (below 70%). Immediate faculty intervention required. You need ${recoveryNeeded} consecutive classes to reach 75%.`;
  }

  return {
    held,
    attended,
    currentPct: roundedPct,
    projectedFinalPct,
    recentRate: Number((recentRate * 100).toFixed(1)),
    missBuffer,
    recoveryNeeded,
    alertLevel,
    proactiveWarning,
    explanation
  };
}

/**
 * R5: Multi-Factor Academic Risk Analysis (35 / 30 / 20 / 15)
 */
export function calculateSubjectRisk({ attendancePct, internalMarks = [], classAvgMarks = 35.0, assignments = [], cgpa = 7.0 }) {
  // Factor 1: Attendance Shortfall (35% weight)
  // Target is 80%. Shortfall below 80 is penalized.
  let attendancePenalty = 0;
  if (attendancePct < 80.0) {
    attendancePenalty = Math.min(100, Math.max(0, ((80.0 - attendancePct) / 80.0) * 100 * 2.5));
  }
  const attendanceScore = attendancePenalty * 0.35;

  // Factor 2: Assessment Performance relative to pass mark (40%) and class average (30% weight)
  let assessmentPenalty = 0;
  let totalObtained = 0;
  let totalMax = 0;
  for (const m of internalMarks) {
    totalObtained += m.obtained_marks || 0;
    totalMax += m.max_marks || 50;
  }
  const studentAvgMarks = totalMax > 0 ? (totalObtained / totalMax) * 100 : 70;
  if (studentAvgMarks < 40.0) {
    // Failing
    assessmentPenalty = 90;
  } else if (studentAvgMarks < classAvgMarks) {
    // Below class average
    assessmentPenalty = Math.min(80, ((classAvgMarks - studentAvgMarks) / classAvgMarks) * 100);
  } else {
    assessmentPenalty = 10;
  }
  const assessmentScore = assessmentPenalty * 0.30;

  // Factor 3: Assignment Performance (missing or late work) (20% weight)
  let assignmentPenalty = 0;
  const missingCount = assignments.filter((a) => !a.status || a.status === "Pending" || a.status === "Late").length;
  if (assignments.length > 0) {
    assignmentPenalty = Math.min(100, (missingCount / assignments.length) * 100);
  }
  const assignmentScore = assignmentPenalty * 0.20;

  // Factor 4: Previous Academic Performance (CGPA on scale of 10) (15% weight)
  let cgpaPenalty = 0;
  if (cgpa < 6.0) {
    cgpaPenalty = Math.min(100, ((6.0 - cgpa) / 6.0) * 100 * 1.5);
  } else if (cgpa < 7.0) {
    cgpaPenalty = 25;
  } else {
    cgpaPenalty = 0;
  }
  const cgpaScore = cgpaPenalty * 0.15;

  // Total Weighted Risk Score (0 to 100)
  const totalRiskScore = Number((attendanceScore + assessmentScore + assignmentScore + cgpaScore).toFixed(1));

  let riskLevel = "LOW";
  if (totalRiskScore >= 50.0) {
    riskLevel = "HIGH";
  } else if (totalRiskScore >= 25.0) {
    riskLevel = "MEDIUM";
  }

  // Plain-English Driver Reasons
  const reasons = [];
  if (attendancePct < 75.0) {
    reasons.push(`Attendance is at ${attendancePct}% (${attendancePct < 70 ? "Critical" : "Danger"})`);
  } else if (attendancePct < 80.0) {
    reasons.push(`Attendance is trending near threshold at ${attendancePct}%`);
  }

  if (studentAvgMarks < 40.0) {
    reasons.push(`Failing internal assessments (average ${studentAvgMarks.toFixed(1)}% vs class avg ${classAvgMarks.toFixed(1)}%)`);
  } else if (studentAvgMarks < classAvgMarks) {
    reasons.push(`Internal marks (${studentAvgMarks.toFixed(1)}%) below class average (${classAvgMarks.toFixed(1)}%)`);
  }

  if (missingCount > 0) {
    reasons.push(`${missingCount} missing or overdue assignment submission(s)`);
  }

  if (cgpa < 6.0) {
    reasons.push(`Historical CGPA (${cgpa}) indicates prior academic difficulty`);
  }

  if (reasons.length === 0) {
    reasons.push("Academic indicators are consistent and healthy across all four metrics.");
  }

  return {
    totalRiskScore,
    riskLevel,
    reasons,
    breakdown: {
      attendancePenalty: Number(attendancePenalty.toFixed(1)),
      assessmentPenalty: Number(assessmentPenalty.toFixed(1)),
      assignmentPenalty: Number(assignmentPenalty.toFixed(1)),
      cgpaPenalty: Number(cgpaPenalty.toFixed(1)),
      weights: { attendance: 0.35, assessment: 0.30, assignment: 0.20, cgpa: 0.15 }
    }
  };
}

/**
 * Fetch Full Academic Profile for a Student
 */
export async function getStudentAcademicProfile(studentId) {
  const db = await getAcademicDb();

  // 1. Fetch Student Details
  const student = await db.get(
    `SELECT s.*, p.program_name, d.department_name 
     FROM students s
     LEFT JOIN programs p ON s.program_id = p.program_id
     LEFT JOIN departments d ON p.department_id = d.department_id
     WHERE s.student_id = ?`,
    [studentId]
  );

  if (!student) return null;

  // 2. Fetch Enrolled Courses with Attendance
  const enrollments = await db.all(
    `SELECT e.enrollment_id, e.offering_id, c.course_id, c.course_code, c.course_name, c.credits,
            f.first_name as faculty_first, f.last_name as faculty_last
     FROM enrollments e
     JOIN course_offerings co ON e.offering_id = co.offering_id
     JOIN courses c ON co.course_id = c.course_id
     LEFT JOIN faculty f ON co.faculty_id = f.faculty_id
     WHERE e.student_id = ?`,
    [studentId]
  );

  const coursesData = [];
  for (const enr of enrollments) {
    // Attendance count
    const attStats = await db.get(
      `SELECT 
         COUNT(*) as held,
         SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended
       FROM attendance
       WHERE enrollment_id = ?`,
      [enr.enrollment_id]
    );

    const recentAttendance = await db.all(
      `SELECT attendance_date, status 
       FROM attendance 
       WHERE enrollment_id = ? 
       ORDER BY attendance_date DESC 
       LIMIT 10`,
      [enr.enrollment_id]
    );

    const held = attStats ? attStats.held || 0 : 0;
    const attended = attStats ? attStats.attended || 0 : 0;
    const attMetrics = calculateAttendanceMetrics(attended, held, recentAttendance);

    // Internal Marks
    const marks = await db.all(
      `SELECT mark_id, assessment_name, max_marks, obtained_marks 
       FROM internal_marks 
       WHERE enrollment_id = ?`,
      [enr.enrollment_id]
    );

    // Assignments
    const assignments = await db.all(
      `SELECT sub.submission_id, a.title, sub.marks, sub.status 
       FROM assignment_submissions sub
       JOIN assignments a ON sub.assignment_id = a.assignment_id
       WHERE sub.student_id = ? AND a.offering_id = ?`,
      [studentId, enr.offering_id]
    );

    // Compute subject risk
    const risk = calculateSubjectRisk({
      attendancePct: attMetrics.currentPct,
      internalMarks: marks,
      classAvgMarks: 35.0,
      assignments,
      cgpa: student.cgpa || 7.0
    });

    coursesData.push({
      ...enr,
      facultyName: enr.faculty_first ? `Prof. ${enr.faculty_first} ${enr.faculty_last}` : "Faculty Assigned",
      attendance: attMetrics,
      marks,
      assignments,
      risk
    });
  }

  // 3. Fetch In-App Notifications
  const notifications = await db.all(
    `SELECT notification_id, title, message, notification_type, created_at, is_read 
     FROM notifications 
     WHERE student_id = ? 
     ORDER BY notification_id DESC 
     LIMIT 20`,
    [studentId]
  );

  return {
    student,
    courses: coursesData,
    notifications
  };
}

/**
 * R3: Save or Edit Mark with Instant Audit & Student Notification
 */
export async function saveOrUpdateMark({ enrollmentId, assessmentName, obtainedMarks, maxMarks = 50, facultyName = "Faculty" }) {
  const db = await getAcademicDb();

  // Validate range
  const numMark = Number(obtainedMarks);
  const numMax = Number(maxMarks);
  if (isNaN(numMark) || numMark < 0 || numMark > numMax) {
    throw new Error(`Invalid mark: ${obtainedMarks}. Must be between 0 and ${maxMarks}.`);
  }

  // Fetch enrollment context (student and course)
  const enr = await db.get(
    `SELECT e.enrollment_id, e.student_id, c.course_code, c.course_name 
     FROM enrollments e
     JOIN course_offerings co ON e.offering_id = co.offering_id
     JOIN courses c ON co.course_id = c.course_id
     WHERE e.enrollment_id = ?`,
    [enrollmentId]
  );

  if (!enr) {
    throw new Error(`Enrollment ID ${enrollmentId} not found.`);
  }

  // Check if mark already exists
  const existing = await db.get(
    `SELECT mark_id, obtained_marks, max_marks 
     FROM internal_marks 
     WHERE enrollment_id = ? AND assessment_name = ?`,
    [enrollmentId, assessmentName]
  );

  let isEdit = false;
  let oldMark = null;

  if (existing) {
    isEdit = true;
    oldMark = existing.obtained_marks;
    await db.run(
      `UPDATE internal_marks 
       SET obtained_marks = ?, max_marks = ? 
       WHERE mark_id = ?`,
      [numMark, numMax, existing.mark_id]
    );
  } else {
    await db.run(
      `INSERT INTO internal_marks (enrollment_id, assessment_name, max_marks, obtained_marks)
       VALUES (?, ?, ?, ?)`,
      [enrollmentId, assessmentName, numMax, numMark]
    );
  }

  // Dispatch In-App Notification to Student (R3)
  const notifTitle = isEdit ? `Mark Updated: ${enr.course_code}` : `New Mark Posted: ${enr.course_code}`;
  const notifMessage = isEdit
    ? `Your mark for ${assessmentName} in ${enr.course_name} was edited by ${facultyName} to ${numMark}/${numMax} (Previous: ${oldMark}/${numMax}).`
    : `Your mark for ${assessmentName} in ${enr.course_name} has been published: ${numMark}/${numMax}.`;

  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO notifications (student_id, title, message, notification_type, created_at, is_read)
     VALUES (?, ?, ?, 'academic_mark', ?, 0)`,
    [enr.student_id, notifTitle, notifMessage, now]
  );

  return {
    success: true,
    isEdit,
    oldMark,
    newMark: numMark,
    maxMarks: numMax,
    courseCode: enr.course_code,
    studentId: enr.student_id,
    notificationMessage: notifMessage
  };
}
