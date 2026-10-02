import { getAcademicDb } from "../src/services/academic.service.js";

// Simple Gaussian random generator (Box-Muller)
function randomGaussian(mean = 0, stdev = 1) {
  const u1 = Math.random() || 1e-7;
  const u2 = Math.random() || 1e-7;
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdev + mean;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Compute Pearson correlation between two arrays
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n === 0) return 0;
  const avgX = x.reduce((a, b) => a + b, 0) / n;
  const avgY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - avgX;
    const dy = y[i] - avgY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

import crypto from "crypto";

// Compute SHA-256 hash for tamper-evident ledger
function computeHash(prevHash, action, entityType, entityId, timestamp, newState) {
  return crypto
    .createHash("sha256")
    .update(`${prevHash}|${action}|${entityType}|${entityId}|${timestamp}|${newState}`)
    .digest("hex");
}

async function run() {
  console.log("Connecting to database using getAcademicDb()...");
  const db = await getAcademicDb();

  await db.run("PRAGMA foreign_keys = OFF;");

  // 1. Create simulated_outbox and academic_audit_log tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS simulated_outbox (
      outbox_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      recipient_email TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      channel TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      dispatch_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS academic_audit_log (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      performed_by TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      timestamp TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      record_hash TEXT NOT NULL
    );
  `);

  console.log("Ensured simulated_outbox and academic_audit_log tables exist.");

  // 2. Fetch all offerings and enrollments
  const offerings = await db.all("SELECT offering_id, course_id, semester_id, faculty_id, section FROM course_offerings");
  const students = await db.all("SELECT student_id, register_number, first_name, last_name, email, phone, cgpa, current_semester FROM students");
  const studentMap = new Map();
  students.forEach((s) => studentMap.set(s.student_id, s));

  // Configure 6 Gold Demo Personas into known students:
  // Student 1: Vivek Reddy -> Persona 1: Approaching Debarment (Attendance ~78.5%, Miss Buffer 1, crossing below 75% soon)
  // Student 2: Nisha Das -> Persona 2: Critical Debarment (Attendance ~71.4%, strictly <75%, Recovery needed: 4)
  // Student 3: Pooja Pillai -> Persona 3: Attendance vs Marks Divergence (Attendance 92.8%, Marks failing <35%)
  // Student 4 & Student 5: Name Ambiguity Pair (Both enrolled in Course 217 with first name 'Sneha')
  // Student 6: Kavya Bose -> Persona 5: Strong student now slipping (CGPA 8.8, recent drop to 40%)
  // Student 7: Priya Reddy -> Persona 6: Clearly Safe model student (Attendance 96.4%, Marks 48/50)

  // Update Student 4 and Student 5 names for ambiguity test
  await db.run("UPDATE students SET first_name = 'Sneha', last_name = 'Patel' WHERE student_id = 4");
  await db.run("UPDATE students SET first_name = 'Sneha', last_name = 'Rao' WHERE student_id = 5");
  await db.run("UPDATE students SET cgpa = 8.85 WHERE student_id = 6");
  await db.run("UPDATE students SET cgpa = 9.20 WHERE student_id = 7");

  // Ensure Students 1, 2, 3, 4, 5, 6, 7 are enrolled in Offering 217
  for (const sId of [1, 2, 3, 4, 5, 6, 7]) {
    const existing = await db.get("SELECT enrollment_id FROM enrollments WHERE student_id = ? AND offering_id = 217", [sId]);
    if (!existing) {
      await db.run(
        "INSERT INTO enrollments (student_id, offering_id, enrollment_date, status) VALUES (?, 217, '2026-07-20', 'Enrolled')",
        [sId]
      );
    }
  }

  // 3. Clear existing attendance, internal_marks, simulated_outbox, and audit_log
  console.log("Truncating historical attendance, marks, outbox, and audit tables for realistic regeneration...");
  await db.run("DELETE FROM attendance;");
  await db.run("DELETE FROM internal_marks;");
  await db.run("DELETE FROM simulated_outbox;");
  await db.run("DELETE FROM academic_audit_log;");

  // Reset sqlite autoincrement sequences
  await db.run("DELETE FROM sqlite_sequence WHERE name IN ('attendance', 'internal_marks', 'simulated_outbox', 'academic_audit_log');");

  // 4. Generate Academic Timetable Dates (Mondays, Wednesdays, Fridays from July 20, 2026 to October 2, 2026)
  const semesterStartDate = new Date("2026-07-20T00:00:00Z");
  const semesterEndDate = new Date("2026-10-02T00:00:00Z");
  const mwfDates = [];

  const curr = new Date(semesterStartDate);
  while (curr <= semesterEndDate) {
    const day = curr.getUTCDay();
    // Monday = 1, Wednesday = 3, Friday = 5
    if (day === 1 || day === 3 || day === 5) {
      mwfDates.push(curr.toISOString().slice(0, 10));
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  console.log(`Generated ${mwfDates.length} strictly weekday class dates (MWF: ${mwfDates[0]} to ${mwfDates[mwfDates.length - 1]}). Zero weekend classes.`);

  // 5. Precompute Student Latent Diligence Factors
  const studentDiligence = new Map();
  for (const s of students) {
    let diligence;
    if (s.student_id === 1) {
      diligence = 0.785; // Persona 1: Approaching debarment
    } else if (s.student_id === 2) {
      diligence = 0.68; // Persona 2: Critical debarment
    } else if (s.student_id === 3) {
      diligence = 0.93; // Persona 3: High attender but failing marks
    } else if (s.student_id === 4 || s.student_id === 5) {
      diligence = 0.85; // Persona 4: Sneha pair
    } else if (s.student_id === 6) {
      diligence = 0.78; // Persona 5: Strong student slipping
    } else if (s.student_id === 7) {
      diligence = 0.96; // Persona 6: Model safe student
    } else {
      // General population distribution:
      // ~72% safe diligence [0.78, 0.98]
      // ~14% borderline diligence [0.72, 0.77]
      // ~14% at risk [0.45, 0.71]
      const roll = Math.random();
      if (roll < 0.14) {
        diligence = clamp(randomGaussian(0.62, 0.08), 0.35, 0.71);
      } else if (roll < 0.28) {
        diligence = clamp(randomGaussian(0.74, 0.02), 0.71, 0.77);
      } else {
        diligence = clamp(randomGaussian(0.86, 0.06), 0.78, 0.98);
      }
    }
    studentDiligence.set(s.student_id, diligence);
  }

  // 6. Fetch all enrollments for batch generation
  const allEnrollments = await db.all("SELECT enrollment_id, student_id, offering_id FROM enrollments");
  console.log(`Processing attendance and marks for ${allEnrollments.length} student-course enrollments...`);

  // Prepare batch insert arrays
  const attendanceRows = [];
  const marksRows = [];
  const outboxRows = [];
  const auditRows = [];

  let auditPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";
  let auditId = 1;

  // Track overall stats for Pearson correlation
  const studentTotalAttended = [];
  const studentAvgMarks = [];

  // Group enrollments by offering for speed
  const offeringEnrollmentMap = new Map();
  for (const enr of allEnrollments) {
    if (!offeringEnrollmentMap.has(enr.offering_id)) {
      offeringEnrollmentMap.set(enr.offering_id, []);
    }
    offeringEnrollmentMap.get(enr.offering_id).push(enr);
  }

  // Iterate over each course offering
  for (const [offeringId, enrList] of offeringEnrollmentMap.entries()) {
    // Determine number of classes held to date for this offering (28 to 32)
    const heldDates = mwfDates.slice(0, 28 + (offeringId % 5));
    const heldCount = heldDates.length;

    // Course difficulty factor
    const courseDifficulty = 0.92 + (offeringId % 7) * 0.02;

    for (const enr of enrList) {
      const sId = enr.student_id;
      const diligence = studentDiligence.get(sId) || 0.80;

      let attendedCount = 0;
      let statusSequence = [];

      // SPECIAL PERSONA HANDLING
      if (sId === 1 && offeringId === 217) {
        // Persona 1: Vivek Reddy (Held: 28, Attended: 22 = 78.57%)
        // Miss buffer: floor(22/0.75 - 28) = 1
        // Last 10 classes: 6 attended (downward trajectory)
        const first18 = Array(18).fill("Present").map((v, i) => (i < 16 ? "Present" : "Absent")); // 16 attended
        const last10 = ["Present", "Present", "Absent", "Present", "Absent", "Present", "Absent", "Present", "Absent", "Present"]; // 6 attended
        statusSequence = [...first18, ...last10];
      } else if (sId === 2 && offeringId === 217) {
        // Persona 2: Nisha Das (Held: 28, Attended: 20 = 71.43%)
        // Recovery needed: ceil((0.75*28 - 20)/0.25) = 4 classes
        statusSequence = Array(28).fill("Present").map((v, i) => (i % 7 === 0 || i % 7 === 1 ? "Absent" : "Present"));
        // Ensure exactly 20 attended
        let pCount = statusSequence.filter((s) => s === "Present").length;
        for (let i = 0; i < statusSequence.length && pCount > 20; i++) {
          if (statusSequence[i] === "Present") {
            statusSequence[i] = "Absent";
            pCount--;
          }
        }
      } else if (sId === 3 && offeringId === 217) {
        // Persona 3: Pooja Pillai (Held: 28, Attended: 26 = 92.86%)
        statusSequence = Array(28).fill("Present");
        statusSequence[5] = "Absent";
        statusSequence[19] = "Absent";
      } else if (sId === 6 && offeringId === 217) {
        // Persona 5: Kavya Bose (Strong student slipping, 18/18 attended initially, then 4/10)
        const first18 = Array(18).fill("Present");
        const last10 = ["Present", "Absent", "Absent", "Present", "Absent", "Present", "Absent", "Absent", "Present", "Absent"]; // 4/10
        statusSequence = [...first18, ...last10];
      } else if (sId === 7 && offeringId === 217) {
        // Persona 6: Priya Reddy (Model safe, 27/28 attended = 96.43%)
        statusSequence = Array(28).fill("Present");
        statusSequence[12] = "Absent";
      } else {
        // Standard student attendance simulation
        const pAtt = clamp(diligence + randomGaussian(0, 0.04), 0.20, 0.99);
        for (let d = 0; d < heldCount; d++) {
          const isPresent = Math.random() < pAtt;
          if (isPresent) {
            statusSequence.push(Math.random() < 0.08 ? "Late" : "Present");
          } else {
            statusSequence.push("Absent");
          }
        }
      }

      // Record attendance rows
      for (let d = 0; d < heldCount; d++) {
        const status = statusSequence[d] || (Math.random() < diligence ? "Present" : "Absent");
        if (status === "Present" || status === "Late") attendedCount++;
        attendanceRows.push({
          enrollment_id: enr.enrollment_id,
          attendance_date: heldDates[d],
          status
        });
      }

      const attPct = (attendedCount / heldCount) * 100;

      // INTERNAL MARKS SIMULATION (CORRELATED TO DILIGENCE)
      let m1, m2;
      if (sId === 3 && offeringId === 217) {
        // Persona 3: Divergence - Failing marks despite high attendance
        m1 = 14.0;
        m2 = 16.5;
      } else if (sId === 1 && offeringId === 217) {
        // Persona 1: Vivek Reddy
        m1 = 37.5;
        m2 = 36.0;
      } else if (sId === 2 && offeringId === 217) {
        // Persona 2: Nisha Das
        m1 = 26.0;
        m2 = 25.5;
      } else if (sId === 6 && offeringId === 217) {
        // Persona 5: Kavya Bose (was 44.0, dropped to 22.0)
        m1 = 44.0;
        m2 = 22.0;
      } else if (sId === 7 && offeringId === 217) {
        // Persona 6: Priya Reddy
        m1 = 48.0;
        m2 = 47.5;
      } else {
        // General student marks: tightly coupled to diligence with slight Gaussian noise
        const markRatio1 = clamp(diligence * courseDifficulty + randomGaussian(0, 0.05), 0.25, 0.98);
        const markRatio2 = clamp(diligence * courseDifficulty + randomGaussian(0, 0.05), 0.25, 0.98);
        m1 = Math.round(markRatio1 * 50 * 10) / 10;
        m2 = Math.round(markRatio2 * 50 * 10) / 10;
      }

      marksRows.push({ enrollment_id: enr.enrollment_id, assessment_name: "Internal 1", max_marks: 50, obtained_marks: m1 });
      marksRows.push({ enrollment_id: enr.enrollment_id, assessment_name: "Internal 2", max_marks: 50, obtained_marks: m2 });

      // Record for Pearson correlation calculation
      studentTotalAttended.push(attPct);
      studentAvgMarks.push(((m1 + m2) / 100) * 100);

      // AUDIT & OFF-PORTAL ALERTS GENERATION
      // If student is below 75% or approaching 75%, create off-portal SMS/Email in simulated_outbox
      const studentObj = studentMap.get(sId);
      if (attPct < 75.0 && studentObj) {
        outboxRows.push({
          student_id: sId,
          recipient_email: studentObj.email,
          recipient_phone: studentObj.phone || "+91-9876543210",
          channel: "SMS",
          subject: "URGENT: Academic Debarment Warning",
          body: `Notice for ${studentObj.first_name}: Your attendance in course offering ${offeringId} is ${attPct.toFixed(1)}%, which is below the mandatory 75% requirement. You must attend the next 4 classes consecutively to regain eligibility.`,
          dispatch_status: "DELIVERED",
          created_at: "2026-09-28T09:30:00Z",
          delivered_at: "2026-09-28T09:30:02Z"
        });
      } else if (attPct >= 75.0 && attPct <= 79.0 && studentObj) {
        outboxRows.push({
          student_id: sId,
          recipient_email: studentObj.email,
          recipient_phone: studentObj.phone || "+91-9876543210",
          channel: "EMAIL",
          subject: "Academic Advisory: Approaching Debarment Threshold",
          body: `Dear ${studentObj.first_name}, your current attendance in offering ${offeringId} is ${attPct.toFixed(1)}%. You can miss at most 1 more class before falling into the statutory debarment zone. Please monitor your schedule.`,
          dispatch_status: "DELIVERED",
          created_at: "2026-09-29T14:15:00Z",
          delivered_at: "2026-09-29T14:15:01Z"
        });
      }

      // Add audit log record for first 100 entries to seed tamper-evident ledger
      if (auditId <= 200) {
        const ts = "2026-09-25T11:00:00Z";
        const stateStr = JSON.stringify({ enrollmentId: enr.enrollment_id, assessment: "Internal 1", mark: m1, max: 50 });
        const recHash = computeHash(auditPrevHash, "SUBMIT_MARK", "internal_marks", enr.enrollment_id, ts, stateStr);
        auditRows.push({
          action: "SUBMIT_MARK",
          entity_type: "internal_marks",
          entity_id: enr.enrollment_id,
          performed_by: "Prof. Faculty Assigned",
          previous_state: null,
          new_state: stateStr,
          timestamp: ts,
          prev_hash: auditPrevHash,
          record_hash: recHash
        });
        auditPrevHash = recHash;
        auditId++;
      }
    }
  }

  // 7. Perform Fast Bulk Inserts in Database
  console.log(`Writing ${attendanceRows.length} attendance rows to SQLite...`);
  await db.run("BEGIN TRANSACTION");
  const attStmt = await db.prepare("INSERT INTO attendance (enrollment_id, attendance_date, status) VALUES (?, ?, ?)");
  for (const row of attendanceRows) {
    await attStmt.run(row.enrollment_id, row.attendance_date, row.status);
  }
  await attStmt.finalize();
  await db.run("COMMIT");

  console.log(`Writing ${marksRows.length} internal mark rows to SQLite...`);
  await db.run("BEGIN TRANSACTION");
  const marksStmt = await db.prepare("INSERT INTO internal_marks (enrollment_id, assessment_name, max_marks, obtained_marks) VALUES (?, ?, ?, ?)");
  for (const row of marksRows) {
    await marksStmt.run(row.enrollment_id, row.assessment_name, row.max_marks, row.obtained_marks);
  }
  await marksStmt.finalize();
  await db.run("COMMIT");

  console.log(`Writing ${outboxRows.length} simulated outbox alerts to SQLite...`);
  await db.run("BEGIN TRANSACTION");
  const outboxStmt = await db.prepare(
    "INSERT INTO simulated_outbox (student_id, recipient_email, recipient_phone, channel, subject, body, dispatch_status, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const row of outboxRows) {
    await outboxStmt.run(row.student_id, row.recipient_email, row.recipient_phone, row.channel, row.subject, row.body, row.dispatch_status, row.created_at, row.delivered_at);
  }
  await outboxStmt.finalize();
  await db.run("COMMIT");

  console.log(`Writing ${auditRows.length} tamper-evident audit records to SQLite...`);
  await db.run("BEGIN TRANSACTION");
  const auditStmt = await db.prepare(
    "INSERT INTO academic_audit_log (action, entity_type, entity_id, performed_by, previous_state, new_state, timestamp, prev_hash, record_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const row of auditRows) {
    await auditStmt.run(row.action, row.entity_type, row.entity_id, row.performed_by, row.previous_state, row.new_state, row.timestamp, row.prev_hash, row.record_hash);
  }
  await auditStmt.finalize();
  await db.run("COMMIT");

  await db.run("PRAGMA foreign_keys = ON;");

  // 8. Statistical Quality Verification
  const r = pearsonCorrelation(studentTotalAttended, studentAvgMarks);
  const atRiskCount = studentTotalAttended.filter((pct) => pct < 75.0).length;
  const atRiskPct = ((atRiskCount / studentTotalAttended.length) * 100).toFixed(2);

  console.log("\n======================================================================");
  console.log("            DATA REALISM & STATISTICAL AUDIT REPORT                    ");
  console.log("======================================================================");
  console.log(`Total Attendance Records Generated: ${attendanceRows.length}`);
  console.log(`Total Assessment Marks Generated:  ${marksRows.length}`);
  console.log(`Pearson Correlation (Attendance vs Marks): r = ${r.toFixed(4)} (Expected: ~0.50 to 0.65)`);
  console.log(`Students Under 75% Statutory Limit: ${atRiskCount} / ${studentTotalAttended.length} (${atRiskPct}%)`);
  console.log(`Zero Weekend Classes Verified: Strictly Monday, Wednesday, Friday`);
  console.log(`Simulated Outbox Alerts Created: ${outboxRows.length}`);
  console.log(`Tamper-Evident SHA-256 Audit Records: ${auditRows.length}`);
  console.log("======================================================================\n");
}

run().catch((err) => {
  console.error("FATAL ERROR in seeding:", err);
  process.exit(1);
});
