import jwt from "jsonwebtoken";
import {
  getAcademicDb,
  getStudentAcademicProfile,
  calculateAttendanceMetrics,
  calculateSubjectRisk,
  saveOrUpdateMark
} from "../services/academic.service.js";
import { parseVoiceMarksBatch } from "../services/voice.mark.service.js";

const JWT_SECRET = process.env.COGNICORE_JWT_SECRET || "cognicore_dev_jwt_secret_2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

/**
 * 1-Click Quick Demo Login for Hackathon Presentation
 */
export async function demoLogin(req, res) {
  try {
    const { role = "student", studentId = 1, facultyId = 150 } = req.body || {};
    const db = await getAcademicDb();

    let userPayload = null;

    if (role === "student") {
      const student = await db.get(
        `SELECT student_id, register_number, first_name, last_name, email, current_semester 
         FROM students WHERE student_id = ?`,
        [studentId]
      );
      if (!student) {
        return res.status(404).json({ success: false, error: "Student not found" });
      }
      userPayload = {
        id: student.student_id,
        registerNumber: student.register_number,
        name: `${student.first_name} ${student.last_name}`,
        email: student.email,
        role: "student",
        semester: student.current_semester
      };
    } else if (role === "faculty") {
      const faculty = await db.get(
        `SELECT faculty_id, employee_number, first_name, last_name, email, designation 
         FROM faculty WHERE faculty_id = ?`,
        [facultyId]
      );
      if (!faculty) {
        return res.status(404).json({ success: false, error: "Faculty not found" });
      }
      userPayload = {
        id: faculty.faculty_id,
        employeeNumber: faculty.employee_number,
        name: `Prof. ${faculty.first_name} ${faculty.last_name}`,
        email: faculty.email,
        role: "faculty",
        designation: faculty.designation
      };
    } else {
      // Admin role
      userPayload = {
        id: "admin-1",
        name: "Dean of Academic Affairs",
        email: "dean.academics@university.edu",
        role: "admin"
      };
    }

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Student Dashboard (R2, R5, R7)
 */
export async function getStudentDashboard(req, res) {
  try {
    const studentId = req.query.studentId || (req.user && req.user.role === "student" ? req.user.id : 1);
    const profile = await getStudentAcademicProfile(Number(studentId));

    if (!profile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    return res.status(200).json({
      success: true,
      profile
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Faculty Courses List (R7)
 */
export async function getFacultyCourses(req, res) {
  try {
    const facultyId = req.query.facultyId || (req.user && req.user.role === "faculty" ? req.user.id : 150);
    const db = await getAcademicDb();

    const courses = await db.all(
      `SELECT co.offering_id, co.course_id, c.course_code, c.course_name, c.credits,
              co.section, s.academic_year, s.semester_number,
              COUNT(e.enrollment_id) as enrolled_count
       FROM course_offerings co
       JOIN courses c ON co.course_id = c.course_id
       LEFT JOIN semesters s ON co.semester_id = s.semester_id
       LEFT JOIN enrollments e ON co.offering_id = e.offering_id
       WHERE co.faculty_id = ?
       GROUP BY co.offering_id
       ORDER BY enrolled_count DESC`,
      [facultyId]
    );

    return res.status(200).json({
      success: true,
      facultyId: Number(facultyId),
      courses
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Course Roster for Mark Entry (R4)
 */
export async function getCourseRoster(req, res) {
  try {
    const { offeringId } = req.params;
    const assessmentName = req.query.assessmentName || "Internal 1";
    const db = await getAcademicDb();

    const roster = await db.all(
      `SELECT e.enrollment_id, s.student_id, s.register_number, s.first_name, s.last_name, s.email,
              im.obtained_marks as current_mark, im.max_marks
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       LEFT JOIN internal_marks im ON e.enrollment_id = im.enrollment_id AND im.assessment_name = ?
       WHERE e.offering_id = ?
       ORDER BY s.register_number ASC`,
      [assessmentName, offeringId]
    );

    return res.status(200).json({
      success: true,
      offeringId: Number(offeringId),
      assessmentName,
      totalStudents: roster.length,
      roster
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * AI Voice Mark Parser Endpoint (R4)
 */
export async function parseVoiceMarks(req, res) {
  try {
    const { transcript, offeringId, defaultMaxMarks = 50, assessmentName = "Internal 1" } = req.body || {};

    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ success: false, error: "Missing speech transcript string" });
    }
    if (!offeringId) {
      return res.status(400).json({ success: false, error: "Missing offeringId" });
    }

    const db = await getAcademicDb();
    const roster = await db.all(
      `SELECT e.enrollment_id, s.student_id, s.register_number, s.first_name, s.last_name,
              im.obtained_marks as current_mark, im.max_marks
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       LEFT JOIN internal_marks im ON e.enrollment_id = im.enrollment_id AND im.assessment_name = ?
       WHERE e.offering_id = ?`,
      [assessmentName, offeringId]
    );

    const parsedBatch = parseVoiceMarksBatch(transcript, roster, Number(defaultMaxMarks));

    return res.status(200).json({
      success: true,
      offeringId: Number(offeringId),
      assessmentName,
      batch: parsedBatch
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Submit / Confirm Verified Marks (R3, R4)
 */
export async function submitMarks(req, res) {
  try {
    const { entries = [], facultyName = "Faculty", assessmentName = "Internal 1" } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, error: "Entries must be a non-empty array" });
    }

    const results = [];
    for (const entry of entries) {
      const { enrollmentId, obtainedMarks, maxMarks = 50 } = entry;
      if (!enrollmentId || obtainedMarks === null || obtainedMarks === undefined) {
        continue;
      }

      const saveRes = await saveOrUpdateMark({
        enrollmentId,
        assessmentName: entry.assessmentName || assessmentName,
        obtainedMarks,
        maxMarks,
        facultyName
      });
      results.push(saveRes);
    }

    return res.status(200).json({
      success: true,
      savedCount: results.length,
      results
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * At-Risk Students for a Specific Course (R5, R6)
 */
export async function getCourseAtRisk(req, res) {
  try {
    const { offeringId } = req.params;
    const db = await getAcademicDb();

    const enrollments = await db.all(
      `SELECT e.enrollment_id, s.student_id, s.register_number, s.first_name, s.last_name, s.cgpa
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       WHERE e.offering_id = ?`,
      [offeringId]
    );

    const atRiskList = [];

    for (const enr of enrollments) {
      const attStats = await db.get(
        `SELECT COUNT(*) as held,
                SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended
         FROM attendance WHERE enrollment_id = ?`,
        [enr.enrollment_id]
      );
      const held = attStats ? attStats.held || 0 : 0;
      const attended = attStats ? attStats.attended || 0 : 0;

      const recentAtt = await db.all(
        `SELECT attendance_date, status FROM attendance WHERE enrollment_id = ? ORDER BY attendance_date DESC LIMIT 10`,
        [enr.enrollment_id]
      );
      const attMetrics = calculateAttendanceMetrics(attended, held, recentAtt);

      const marks = await db.all(
        `SELECT assessment_name, max_marks, obtained_marks FROM internal_marks WHERE enrollment_id = ?`,
        [enr.enrollment_id]
      );

      const assignments = await db.all(
        `SELECT sub.status FROM assignment_submissions sub
         JOIN assignments a ON sub.assignment_id = a.assignment_id
         WHERE sub.student_id = ? AND a.offering_id = ?`,
        [enr.student_id, offeringId]
      );

      const risk = calculateSubjectRisk({
        attendancePct: attMetrics.currentPct,
        internalMarks: marks,
        classAvgMarks: 35.0,
        assignments,
        cgpa: enr.cgpa || 7.0
      });

      if (risk.riskLevel === "HIGH" || risk.riskLevel === "MEDIUM") {
        atRiskList.push({
          studentId: enr.student_id,
          enrollmentId: enr.enrollment_id,
          registerNumber: enr.register_number,
          name: `${enr.first_name} ${enr.last_name}`,
          attendance: attMetrics,
          risk
        });
      }
    }

    // Sort descending by risk score
    atRiskList.sort((a, b) => b.risk.totalRiskScore - a.risk.totalRiskScore);

    return res.status(200).json({
      success: true,
      offeringId: Number(offeringId),
      totalAtRisk: atRiskList.length,
      highRiskCount: atRiskList.filter((s) => s.risk.riskLevel === "HIGH").length,
      mediumRiskCount: atRiskList.filter((s) => s.risk.riskLevel === "MEDIUM").length,
      students: atRiskList
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Admin University-Wide Heatmap & Summary (R6, R7)
 */
export async function getAdminHeatmap(req, res) {
  try {
    const db = await getAcademicDb();

    // Summary counters
    const totals = await db.get(
      `SELECT 
         (SELECT COUNT(*) FROM students) as total_students,
         (SELECT COUNT(*) FROM courses) as total_courses,
         (SELECT COUNT(*) FROM faculty) as total_faculty,
         (SELECT COUNT(*) FROM departments) as total_departments`
    );

    // Department-level metrics
    const deptStats = await db.all(
      `SELECT d.department_id, d.department_code, d.department_name,
              COUNT(DISTINCT s.student_id) as student_count,
              ROUND(AVG(s.cgpa), 2) as avg_cgpa
       FROM departments d
       JOIN programs p ON d.department_id = p.department_id
       JOIN students s ON p.program_id = s.program_id
       GROUP BY d.department_id
       ORDER BY student_count DESC`
    );

    return res.status(200).json({
      success: true,
      summary: totals,
      departments: deptStats
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
