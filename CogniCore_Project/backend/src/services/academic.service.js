import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

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
 * Dynamically handles missing data (first sem freshmen, unheld tests) without silent bias.
 * Enforces statutory safety floors: Students debarred (<70%) or endangered (<75%) cannot be labeled LOW RISK.
 */
export function calculateSubjectRisk({ attendancePct = 100, internalMarks = [], classAvgMarks = 35.0, assignments = [], cgpa = null }) {
  const reasons = [];

  // Available factor tracking for dynamic re-weighting
  let availableWeight = 0;
  let weightedPenaltySum = 0;

  // 1. Factor 1: Attendance Shortfall (Base weight: 0.35)
  // Target is 80% safe zone. Sharp curve below 75% statutory line.
  let attendancePenalty = 0;
  if (attendancePct < 70.0) {
    attendancePenalty = 100; // Critical statutory debarment
    reasons.push(`Critical debarment risk: Attendance (${attendancePct.toFixed(1)}%) is below statutory 70% threshold`);
  } else if (attendancePct < 75.0) {
    attendancePenalty = Math.min(90, 60 + ((75.0 - attendancePct) / 5.0) * 30);
    reasons.push(`Non-compliant attendance (${attendancePct.toFixed(1)}%): Below 75% statutory exam eligibility limit`);
  } else if (attendancePct < 80.0) {
    attendancePenalty = Math.min(50, ((80.0 - attendancePct) / 5.0) * 40);
    reasons.push(`Advisory notice: Attendance (${attendancePct.toFixed(1)}%) is approaching 75% limit`);
  } else {
    attendancePenalty = 0;
  }
  weightedPenaltySum += attendancePenalty * 0.35;
  availableWeight += 0.35;

  // 2. Factor 2: Assessment Performance (Base weight: 0.30)
  let assessmentPenalty = 0;
  let totalObtained = 0;
  let totalMax = 0;
  for (const m of internalMarks) {
    totalObtained += m.obtained_marks || 0;
    totalMax += m.max_marks || 50;
  }

  if (internalMarks.length > 0 && totalMax > 0) {
    const studentAvgMarks = (totalObtained / totalMax) * 100;
    if (studentAvgMarks < 40.0) {
      assessmentPenalty = Math.min(100, 70 + ((40.0 - studentAvgMarks) / 40.0) * 30);
      reasons.push(`Failing internal assessment average (${studentAvgMarks.toFixed(1)}% vs 40% passing)`);
    } else if (studentAvgMarks < classAvgMarks) {
      assessmentPenalty = Math.min(60, ((classAvgMarks - studentAvgMarks) / classAvgMarks) * 60);
      reasons.push(`Internal score (${studentAvgMarks.toFixed(1)}%) is below class average (${classAvgMarks.toFixed(1)}%)`);
    } else {
      assessmentPenalty = 0;
    }
    weightedPenaltySum += assessmentPenalty * 0.30;
    availableWeight += 0.30;
  }

  // 3. Factor 3: Assignment Performance (Base weight: 0.20)
  let assignmentPenalty = 0;
  if (assignments.length > 0) {
    const missingCount = assignments.filter((a) => !a.status || a.status === "Pending" || a.status === "Late").length;
    if (missingCount > 0) {
      assignmentPenalty = Math.min(100, (missingCount / assignments.length) * 100);
      reasons.push(`${missingCount} missing or overdue assignment submission(s) out of ${assignments.length}`);
    }
    weightedPenaltySum += assignmentPenalty * 0.20;
    availableWeight += 0.20;
  }

  // 4. Factor 4: Previous Academic Performance (CGPA / 10) (Base weight: 0.15)
  let cgpaPenalty = 0;
  const numCgpa = parseFloat(cgpa);
  if (!isNaN(numCgpa) && numCgpa > 0) {
    if (numCgpa < 6.0) {
      cgpaPenalty = Math.min(100, ((6.0 - numCgpa) / 6.0) * 100 * 1.5);
      reasons.push(`Historical CGPA (${numCgpa.toFixed(2)}) indicates prior academic difficulty`);
    } else if (numCgpa < 7.0) {
      cgpaPenalty = 20;
    } else {
      cgpaPenalty = 0;
    }
    weightedPenaltySum += cgpaPenalty * 0.15;
    availableWeight += 0.15;
  }

  // Normalize across genuinely available factors (avoids unfair zero-scoring for 1st sem freshmen)
  const normalizedRiskScore = availableWeight > 0 ? (weightedPenaltySum / availableWeight) : 0;
  let totalRiskScore = Number(normalizedRiskScore.toFixed(1));

  // STATUTORY OVERRIDE: Debarment & non-compliance floors
  if (attendancePct < 70.0 && totalRiskScore < 60.0) {
    totalRiskScore = 65.0; // Debarred cannot be scored as low risk
  } else if (attendancePct < 75.0 && totalRiskScore < 35.0) {
    totalRiskScore = 38.0; // Non-compliant cannot be scored as low risk
  }

  // Risk Classification Tier
  let riskLevel = "LOW";
  if (totalRiskScore >= 50.0 || attendancePct < 70.0) {
    riskLevel = "HIGH";
  } else if (totalRiskScore >= 25.0 || attendancePct < 75.0) {
    riskLevel = "MEDIUM";
  }

  if (reasons.length === 0) {
    reasons.push("Academic indicators are consistent and healthy across all evaluated metrics.");
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
      normalizedWeight: Number(availableWeight.toFixed(2)),
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

  // Dispatch Simulated Off-Portal Outbox Notice (Email & SMS)
  const student = await db.get("SELECT email, phone, first_name FROM students WHERE student_id = ?", [enr.student_id]);
  if (student) {
    await db.run(
      `INSERT INTO simulated_outbox (student_id, recipient_email, recipient_phone, channel, subject, body, dispatch_status, created_at, delivered_at)
       VALUES (?, ?, ?, 'EMAIL', ?, ?, 'DELIVERED', ?, ?)`,
      [
        enr.student_id,
        student.email,
        student.phone || "+91-9876543210",
        `Academic Notification: ${notifTitle}`,
        `Dear ${student.first_name}, ${notifMessage}`,
        now,
        now
      ]
    );
  }

  // Record in Tamper-Evident SHA-256 Audit Log
  const lastAudit = await db.get("SELECT record_hash FROM academic_audit_log ORDER BY audit_id DESC LIMIT 1");
  const prevHash = lastAudit?.record_hash || "0000000000000000000000000000000000000000000000000000000000000000";
  const statePayload = JSON.stringify({ enrollmentId, assessmentName, obtainedMarks: numMark, maxMarks: numMax });
  const recordHash = crypto
    .createHash("sha256")
    .update(`${prevHash}|UPDATE_MARK|internal_marks|${enrollmentId}|${now}|${statePayload}`)
    .digest("hex");

  await db.run(
    `INSERT INTO academic_audit_log (action, entity_type, entity_id, performed_by, previous_state, new_state, timestamp, prev_hash, record_hash)
     VALUES ('UPDATE_MARK', 'internal_marks', ?, ?, ?, ?, ?, ?, ?)`,
    [enrollmentId, facultyName, oldMark !== null ? String(oldMark) : null, statePayload, now, prevHash, recordHash]
  );

  return {
    success: true,
    isEdit,
    oldMark,
    newMark: numMark,
    maxMarks: numMax,
    courseCode: enr.course_code,
    studentId: enr.student_id,
    notificationMessage: notifMessage,
    auditHash: recordHash
  };
}

/**
 * USP 1: Admin Debarment Forecast with Recoverability Analysis
 */
export async function getDebarmentForecast(plannedTotal = 60) {
  const db = await getAcademicDb();

  const rows = await db.all(`
    SELECT e.enrollment_id, e.student_id, e.offering_id,
           s.register_number, s.first_name, s.last_name, s.email, d.department_name,
           c.course_code, c.course_name,
           COUNT(a.attendance_id) as held_classes,
           SUM(CASE WHEN a.status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended_classes
    FROM enrollments e
    JOIN students s ON e.student_id = s.student_id
    JOIN course_offerings co ON e.offering_id = co.offering_id
    JOIN courses c ON co.course_id = c.course_id
    JOIN programs p ON s.program_id = p.program_id
    JOIN departments d ON p.department_id = d.department_id
    LEFT JOIN attendance a ON e.enrollment_id = a.enrollment_id
    GROUP BY e.enrollment_id
  `);

  let totalEnrolled = rows.length;
  let currentlyBelow75 = 0;
  let projectedBelow75 = 0;
  let recoverableCount = 0;
  let unrecoverableCount = 0;

  const departmentMap = {};
  const atRiskStudents = [];

  for (const r of rows) {
    const held = r.held_classes || 0;
    const attended = r.attended_classes || 0;
    const currentPct = held > 0 ? (attended / held) * 100 : 100;
    const remaining = Math.max(0, plannedTotal - held);

    const maxAchievablePct = ((attended + remaining) / plannedTotal) * 100;
    const projectedFinalPct = ((attended + Math.round((currentPct / 100) * remaining)) / plannedTotal) * 100;

    if (currentPct < 75.0) currentlyBelow75++;

    if (projectedFinalPct < 75.0) {
      projectedBelow75++;
      const isRecoverable = maxAchievablePct >= 75.0;
      const requiredToRecover = isRecoverable ? Math.max(0, Math.ceil(0.75 * plannedTotal - attended)) : null;

      if (isRecoverable) recoverableCount++;
      else unrecoverableCount++;

      // Dept agg
      departmentMap[r.department_name] = (departmentMap[r.department_name] || 0) + 1;

      atRiskStudents.push({
        enrollmentId: r.enrollment_id,
        studentId: r.student_id,
        registerNumber: r.register_number,
        studentName: `${r.first_name} ${r.last_name}`,
        department: r.department_name,
        courseCode: r.course_code,
        courseName: r.course_name,
        held,
        attended,
        currentPct: Number(currentPct.toFixed(1)),
        projectedFinalPct: Number(projectedFinalPct.toFixed(1)),
        maxAchievablePct: Number(maxAchievablePct.toFixed(1)),
        status: isRecoverable ? "RECOVERABLE" : "MATHEMATICALLY_DEBARRED",
        requiredConsecutiveClasses: requiredToRecover
      });
    }
  }

  atRiskStudents.sort((a, b) => a.projectedFinalPct - b.projectedFinalPct);

  return {
    plannedSemesterClasses: plannedTotal,
    totalEnrollmentsAnalyzed: totalEnrolled,
    currentlyBelow75,
    projectedBelow75,
    recoverableCount,
    unrecoverableCount,
    departmentBreakdown: departmentMap,
    atRiskStudents: atRiskStudents.slice(0, 100)
  };
}

/**
 * USP 2: Semester Backtest Engine (Zero Future Leakage Historical Replay)
 */
export async function getBacktestAnalysis() {
  const db = await getAcademicDb();

  // Get distinct dates
  const dates = await db.all("SELECT DISTINCT attendance_date FROM attendance ORDER BY attendance_date ASC");
  if (dates.length === 0) {
    return { success: false, message: "No attendance records available for backtesting." };
  }

  // 4 checkpoints: 25%, 50%, 75%, and 100% of semester
  const totalDays = dates.length;
  const cpIndices = [
    Math.floor(totalDays * 0.25),
    Math.floor(totalDays * 0.50),
    Math.floor(totalDays * 0.75),
    totalDays - 1
  ];

  const checkpoints = [
    { label: "Week 3 Checkpoint", date: dates[cpIndices[0]].attendance_date },
    { label: "Mid-Term Checkpoint (Week 6)", date: dates[cpIndices[1]].attendance_date },
    { label: "Pre-Final Advisory (Week 9)", date: dates[cpIndices[2]].attendance_date },
    { label: "Semester Closing (Current)", date: dates[cpIndices[3]].attendance_date }
  ];

  // Evaluate enrollments at each milestone with zero future leakage
  const timeline = [];
  const finalCutoffDate = checkpoints[3].date;

  // Final ground truth
  const finalResults = await db.all(`
    SELECT enrollment_id,
           COUNT(*) as held,
           SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended
    FROM attendance
    WHERE attendance_date <= ?
    GROUP BY enrollment_id
  `, [finalCutoffDate]);

  const finalDebarredIds = new Set();
  finalResults.forEach((r) => {
    if (r.held > 0 && (r.attended / r.held) < 0.75) {
      finalDebarredIds.add(r.enrollment_id);
    }
  });

  const firstWarningDateMap = new Map();

  for (let idx = 0; idx < checkpoints.length; idx++) {
    const cp = checkpoints[idx];
    const cpData = await db.all(`
      SELECT enrollment_id,
             COUNT(*) as held,
             SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended
      FROM attendance
      WHERE attendance_date <= ?
      GROUP BY enrollment_id
    `, [cp.date]);

    let warnedAtCheckpoint = 0;
    for (const row of cpData) {
      if (row.held === 0) continue;
      const pct = (row.attended / row.held) * 100;
      // Projection with remaining classes up to 60
      const remaining = Math.max(0, 60 - row.held);
      const proj = ((row.attended + Math.round((pct / 100) * remaining)) / 60) * 100;

      if (pct < 75.0 || proj < 75.0) {
        warnedAtCheckpoint++;
        if (!firstWarningDateMap.has(row.enrollment_id)) {
          firstWarningDateMap.set(row.enrollment_id, cp.date);
        }
      }
    }

    timeline.push({
      checkpoint: cp.label,
      date: cp.date,
      evaluatedCount: cpData.length,
      warnedCount: warnedAtCheckpoint,
      pctOfCohortWarned: Number(((warnedAtCheckpoint / cpData.length) * 100).toFixed(1))
    });
  }

  // Compute sensitivity and lead time
  let warnedEarlyCount = 0;
  let totalLeadDays = 0;
  const finalEpoch = new Date(finalCutoffDate).getTime();

  for (const enrId of finalDebarredIds) {
    if (firstWarningDateMap.has(enrId)) {
      warnedEarlyCount++;
      const firstWarnEpoch = new Date(firstWarningDateMap.get(enrId)).getTime();
      const leadDays = Math.max(1, Math.round((finalEpoch - firstWarnEpoch) / (1000 * 60 * 60 * 24)));
      totalLeadDays += leadDays;
    }
  }

  const sensitivity = finalDebarredIds.size > 0
    ? ((warnedEarlyCount / finalDebarredIds.size) * 100).toFixed(1)
    : "100.0";
  const avgLeadTime = warnedEarlyCount > 0 ? (totalLeadDays / warnedEarlyCount).toFixed(1) : "0.0";

  return {
    totalEnrollments: finalResults.length,
    finalDebarredCount: finalDebarredIds.size,
    warnedInAdvanceCount: warnedEarlyCount,
    warningSensitivityPct: Number(sensitivity),
    averageLeadTimeDays: Number(avgLeadTime),
    timeline
  };
}

/**
 * USP 3: Cryptographic SHA-256 Ledger Verification
 */
export async function verifyAcademicAuditLog() {
  const db = await getAcademicDb();
  const records = await db.all("SELECT * FROM academic_audit_log ORDER BY audit_id ASC");

  if (records.length === 0) {
    return { verified: true, totalRecords: 0, message: "Ledger is empty. Zero records." };
  }

  let expectedPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.prev_hash !== expectedPrevHash) {
      return {
        verified: false,
        error: `Hash chain broken at Record ID ${rec.audit_id}. Expected prev_hash '${expectedPrevHash}', found '${rec.prev_hash}'.`,
        tamperedRow: rec
      };
    }

    const recomputedHash = crypto
      .createHash("sha256")
      .update(`${rec.prev_hash}|${rec.action}|${rec.entity_type}|${rec.entity_id}|${rec.timestamp}|${rec.new_state}`)
      .digest("hex");

    if (recomputedHash !== rec.record_hash) {
      return {
        verified: false,
        error: `Data tampering detected at Record ID ${rec.audit_id}. Hash mismatch: ledger has '${rec.record_hash}', computed '${recomputedHash}'.`,
        tamperedRow: rec
      };
    }

    expectedPrevHash = rec.record_hash;
  }

  return {
    verified: true,
    totalRecords: records.length,
    genesisHash: records[0].prev_hash,
    headHash: records[records.length - 1].record_hash,
    lastAuditTimestamp: records[records.length - 1].timestamp,
    message: `Cryptographic audit integrity verified: all ${records.length} records form an unbroken, tamper-evident SHA-256 hash chain.`
  };
}

/**
 * USP 4: Simulated Outbox Dispatch Retrieval
 */
export async function getSimulatedOutbox(studentId = null, limit = 50) {
  const db = await getAcademicDb();
  if (studentId) {
    return db.all(
      "SELECT * FROM simulated_outbox WHERE student_id = ? ORDER BY outbox_id DESC LIMIT ?",
      [studentId, limit]
    );
  }
  return db.all(
    "SELECT * FROM simulated_outbox ORDER BY outbox_id DESC LIMIT ?",
    [limit]
  );
}

/**
 * USP 5: Interactive Recovery What-If Calculator
 */
export function simulateStudentRecovery({ attended, held, futureAttended, futureHeld, plannedTotal = 60 }) {
  const numAttended = Number(attended) || 0;
  const numHeld = Number(held) || 0;
  const numFutureAttended = Number(futureAttended) || 0;
  const numFutureHeld = Number(futureHeld) || 0;

  const totalHeldAfter = numHeld + numFutureHeld;
  const totalAttendedAfter = numAttended + numFutureAttended;

  const resultingPct = totalHeldAfter > 0 ? (totalAttendedAfter / totalHeldAfter) * 100 : 100;
  const remainingInSemester = Math.max(0, plannedTotal - totalHeldAfter);

  const futurePace = numFutureHeld > 0 ? numFutureAttended / numFutureHeld : resultingPct / 100;
  const projectedSemesterEnd = ((totalAttendedAfter + Math.round(futurePace * remainingInSemester)) / plannedTotal) * 100;

  const neededConsecutiveToReach75 = Math.max(0, Math.ceil(0.75 * totalHeldAfter - numAttended));

  return {
    currentPct: Number((numHeld > 0 ? (numAttended / numHeld) * 100 : 100).toFixed(2)),
    resultingPct: Number(resultingPct.toFixed(2)),
    isEligibleAfterPlan: resultingPct >= 75.0,
    projectedSemesterEnd: Number(projectedSemesterEnd.toFixed(2)),
    neededConsecutiveToReach75,
    isAbove75: resultingPct >= 75.0
  };
}
