// ============================================================
// UNIVERSITY REALM GENERATOR — 3 sizes, 3 flavors
// U1_stateuniv.db   SMALL  verbose, GPA floats, advisor self-ref
// U2_metrouniv.db   MEDIUM verbose-hybrid, deeper hierarchies
// U3_institute.db   LARGE  abbreviated, grade codes, coded depts, YYYYMMDD
// Deterministic. Run: node database/gen_university.js
// ============================================================
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(__dirname, "..", "test", "fixtures", "realms", "university");
mkdirSync(OUT_DIR, { recursive: true });

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const esc = (s) => String(s).replace(/'/g, "''");

const FIRST = ["Aarav","Maya","Kiran","Tariq","Ingrid","Raj","Zara","Omar","Lena","Viktor","Priya","Hana","Diego","Nadia","Felix","Aiko","Samir","Greta","Rohan","Yuki"];
const LAST = ["Patel","Khan","Weber","Silva","Okafor","Rossi","Kim","Haddad","Novak","Tanaka","Sharma","Lopez","Ahmed","Berger","Costa","Devi","Iyer","Jain","Kapoor","Menon"];
const GRADE_POINTS = { "A+": 4.0, "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7, "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0.0 };
const GRADE_CODES = Object.keys(GRADE_POINTS);

function generateUniversity(opts) {
  const { name, seed, students: nStudents, courses: nCourses, legacy } = opts;
  const rng = mulberry32(seed);
  const suffix = legacy ? "institute" : name === "U1" ? "stateuniv" : "metrouniv";
  const dbPath = path.join(OUT_DIR, `${name}_${suffix}.db`);
  rmSync(dbPath, { force: true });

  const L = [];
  L.push("PRAGMA journal_mode=DELETE;");
  L.push("BEGIN TRANSACTION;");

  // departments (coded in legacy flavor)
  const departments = [];
  const nDepts = 8;
  for (let d = 0; d < nDepts; d++) {
    departments.push({
      id: d + 1,
      name: legacy ? `DEP_${String(d + 1).padStart(2, "0")}` : ["Computer Science","Electrical Engineering","Mechanical Engineering","Civil Engineering","Mathematics","Physics","Chemistry","Management"][d],
      budget: int(rng, 500000, 5000000),
    });
  }

  // instructors WITH advisor self-reference
  const instructors = [];
  const nInstructors = Math.max(20, Math.floor(nStudents / 40));
  for (let i = 0; i < nInstructors; i++) {
    instructors.push({
      id: i + 1,
      name: legacy ? `${pick(rng, LAST)}, ${pick(rng, FIRST)}` : `Prof. ${pick(rng, FIRST)} ${pick(rng, LAST)}`,
      deptId: int(rng, 1, nDepts),
      salary: int(rng, 40000, 180000),
      experience: int(rng, 1, 35),
      // advisor self-ref filled after all created (every 3rd instructor is also an advisor)
    });
  }
  // every 3rd instructor gets an advisor (another senior instructor)
  instructors.forEach((ins, i) => {
    ins.advisorId = i % 3 === 0 ? instructors[(i + 5) % nInstructors].id === ins.id ? null : instructors[(i + 5) % nInstructors].id : null;
  });

  // students
  const students = [];
  for (let i = 0; i < nStudents; i++) {
    const fn = pick(rng, FIRST), ln = pick(rng, LAST);
    students.push({
      id: i + 1,
      name: legacy ? `${ln}, ${fn}` : `${fn} ${ln}`,
      deptId: int(rng, 1, nDepts),
      year: int(rng, 1, 4),
      // ~12% of students have NO advisor (anti-join potential)
      advisorId: rng() < 0.88 ? instructors[int(rng, 0, nInstructors - 1)].id : null,
      // GPA assigned for U1/U2; U3 derives from grade codes
      gpa: legacy ? null : Math.round((rng() * 4) * 100) / 100,
    });
  }

  // courses
  const courses = [];
  for (let c = 0; c < nCourses; c++) {
    courses.push({
      id: c + 1,
      code: legacy ? `CRS${String(c + 1).padStart(3, "0")}` : `${["CS","EE","ME","CE","MA","PH","CH","MG"][courses.length % 8]}${300 + c}`,
      name: legacy ? `Course Module ${c + 1}` : pick(rng, ["Databases","Operating Systems","Data Structures","Machine Learning","Thermodynamics","Structural Analysis","Quantum Physics","Organizational Behavior","Compiler Design","Signal Processing","Fluid Mechanics","Discrete Mathematics"]),
      deptId: int(rng, 1, nDepts),
      instructorId: pick(rng, instructors).id,
      credits: int(rng, 2, 5),
      capacity: int(rng, 30, 120),
    });
  }

  // enrollments (fact table — the big one for large DBs)
  const enrollments = [];
  let eid = 0;
  for (const s of students) {
    const n = int(rng, 3, 7);
    const chosen = new Set();
    for (let k = 0; k < n; k++) {
      const cid = pick(rng, courses).id;
      if (chosen.has(cid)) continue;
      chosen.add(cid);
      eid++;
      enrollments.push({
        id: eid, studentId: s.id, courseId: cid,
        grade: legacy ? pick(rng, GRADE_CODES) : null,
        gpa: legacy ? null : Math.round((rng() * 4) * 100) / 100,
        semester: legacy ? `${int(rng, 2023, 2025)}${int(rng, 1, 2)}` : `${pick(rng, ["Fall", "Spring"])} ${int(rng, 2023, 2025)}`,
      });
    }
  }

  // ═══ emit SQL ═══
  if (!legacy) {
    const deptT = "departments", stuT = "students", insT = "instructors", crsT = "courses", enrT = "enrollments";
    L.push(`CREATE TABLE ${deptT} (dept_id INTEGER PRIMARY KEY, name TEXT NOT NULL, budget INTEGER);`);
    departments.forEach(d => L.push(`INSERT INTO ${deptT} VALUES (${d.id}, '${d.name}', ${d.budget});`));
    L.push(`CREATE TABLE ${insT} (instructor_id INTEGER PRIMARY KEY, name TEXT NOT NULL, dept_id INTEGER REFERENCES ${deptT}(dept_id), salary INTEGER, experience_yrs INTEGER, advisor_id INTEGER REFERENCES ${insT}(instructor_id));`);
    instructors.forEach(i => L.push(`INSERT INTO ${insT} VALUES (${i.id}, '${esc(i.name)}', ${i.deptId}, ${i.salary}, ${i.experience}, ${i.advisorId || "NULL"});`));
    L.push(`CREATE TABLE ${stuT} (student_id INTEGER PRIMARY KEY, name TEXT NOT NULL, dept_id INTEGER REFERENCES ${deptT}(dept_id), year INTEGER, advisor_id INTEGER REFERENCES ${insT}(instructor_id), gpa REAL);`);
    students.forEach(s => L.push(`INSERT INTO ${stuT} VALUES (${s.id}, '${esc(s.name)}', ${s.deptId}, ${s.year}, ${s.advisorId || "NULL"}, ${s.gpa});`));
    L.push(`CREATE TABLE ${crsT} (course_id INTEGER PRIMARY KEY, course_code TEXT, course_name TEXT, dept_id INTEGER REFERENCES ${deptT}(dept_id), instructor_id INTEGER REFERENCES ${insT}(instructor_id), credits INTEGER, capacity INTEGER);`);
    courses.forEach(c => L.push(`INSERT INTO ${crsT} VALUES (${c.id}, '${c.code}', '${c.name}', ${c.deptId}, ${c.instructorId}, ${c.credits}, ${c.capacity});`));
    L.push(`CREATE TABLE ${enrT} (enrollment_id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES ${stuT}(student_id), course_id INTEGER NOT NULL REFERENCES ${crsT}(course_id), gpa REAL, semester TEXT);`);
    enrollments.forEach(e => L.push(`INSERT INTO ${enrT} VALUES (${e.id}, ${e.studentId}, ${e.courseId}, ${e.gpa}, '${e.semester}');`));
    L.push(`CREATE INDEX idx_enr_student ON ${enrT}(student_id);`);
    L.push(`CREATE INDEX idx_enr_course ON ${enrT}(course_id);`);
    L.push(`CREATE INDEX idx_stu_dept ON ${stuT}(dept_id);`);
  } else {
    const deptT = "depts", stuT = "stus", insT = "profs", crsT = "crss", enrT = "enrs";
    L.push(`CREATE TABLE ${deptT} (dept_id INTEGER PRIMARY KEY, dept_nm TEXT, bud INTEGER);`);
    departments.forEach(d => L.push(`INSERT INTO ${deptT} VALUES (${d.id}, '${d.name}', ${d.budget});`));
    L.push(`CREATE TABLE ${insT} (prof_id INTEGER PRIMARY KEY, prof_nm TEXT, dept_id INTEGER, sal INTEGER, yrs INTEGER, adv_id INTEGER);`);
    instructors.forEach(i => L.push(`INSERT INTO ${insT} VALUES (${i.id}, '${esc(i.name)}', ${i.deptId}, ${i.salary}, ${i.experience}, ${i.advisorId || "NULL"});`));
    L.push(`CREATE TABLE ${stuT} (stu_id INTEGER PRIMARY KEY, stu_nm TEXT, dept_id INTEGER, yr INTEGER, adv_id INTEGER);`);
    students.forEach(s => L.push(`INSERT INTO ${stuT} VALUES (${s.id}, '${esc(s.name)}', ${s.deptId}, ${s.year}, ${s.advisorId || "NULL"});`));
    L.push(`CREATE TABLE ${crsT} (crs_id INTEGER PRIMARY KEY, crs_cd TEXT, crs_nm TEXT, dept_id INTEGER, prof_id INTEGER, cred INTEGER, cap INTEGER);`);
    courses.forEach(c => L.push(`INSERT INTO ${crsT} VALUES (${c.id}, '${c.code}', '${c.name}', ${c.deptId}, ${c.instructorId}, ${c.credits}, ${c.capacity});`));
    L.push(`CREATE TABLE ${enrT} (enr_id INTEGER PRIMARY KEY, stu_id INTEGER NOT NULL, crs_id INTEGER NOT NULL, grade TEXT, sem TEXT);`);
    enrollments.forEach(e => L.push(`INSERT INTO ${enrT} VALUES (${e.id}, ${e.studentId}, ${e.courseId}, '${e.grade}', '${e.semester}');`));
    L.push(`CREATE INDEX idx_enr_stu ON ${enrT}(stu_id);`);
    L.push(`CREATE INDEX idx_enr_crs ON ${enrT}(crs_id);`);
  }

  L.push("COMMIT;");
  const sqlFile = path.join(OUT_DIR, `.gen_${name}.sql`);
  writeFileSync(sqlFile, L.join("\n"));
  execSync(`sqlite3 "${dbPath}" < "${sqlFile}"`);
  rmSync(sqlFile);
  return { dbPath, legacy, students, courses, enrollments, instructors, departments };
}

// ═══ GENERATE — 3 sizes ═══
const u1 = generateUniversity({ name: "U1", seed: 91,  students: 300,   courses: 40,  legacy: false });
const u2 = generateUniversity({ name: "U2", seed: 92,  students: 3000,  courses: 120, legacy: false });
const u3 = generateUniversity({ name: "U3", seed: 93,  students: 12000, courses: 300, legacy: true  });

// ═══ VERIFY ═══
for (const [label, g] of [["U1_stateuniv (SMALL)", u1], ["U2_metrouniv (MEDIUM)", u2], ["U3_institute (LARGE)", u3]]) {
  console.log(`\n═══ ${label} — ${g.dbPath} ═══`);
  const stuT = g.legacy ? "stus" : "students";
  const enrT = g.legacy ? "enrs" : "enrollments";
  const insT = g.legacy ? "profs" : "instructors";
  const stuId = g.legacy ? "stu_id" : "student_id";
  const advCol = g.legacy ? "adv_id" : "advisor_id";
  const insId = g.legacy ? "prof_id" : "instructor_id";
  const gradeCol = g.legacy ? "grade" : "gpa";
  const q = (s) => execSync(`sqlite3 "${g.dbPath}" "${s}"`).toString().trim();

  console.log("students:", q(`SELECT COUNT(*) FROM ${stuT};`));
  console.log("enrollments:", q(`SELECT COUNT(*) FROM ${enrT};`));
  console.log("instructors with advisors:", q(`SELECT COUNT(*) FROM ${insT} WHERE ${advCol} IS NOT NULL;`));
  console.log("students WITHOUT advisor (anti-join):", q(`SELECT COUNT(*) FROM ${stuT} WHERE ${advCol} IS NULL;`));
  if (!g.legacy) {
    console.log("avg student GPA:", q(`SELECT ROUND(AVG(gpa),3) FROM ${stuT};`));
    console.log("top dept by avg GPA:", q(`SELECT d.name, ROUND(AVG(s.gpa),3) a FROM students s JOIN departments d ON s.dept_id=d.dept_id GROUP BY 1 ORDER BY a DESC LIMIT 1;`));
  } else {
    console.log("most-awarded grade:", q(`SELECT grade, COUNT(*) c FROM ${enrT} GROUP BY grade ORDER BY c DESC LIMIT 1;`));
    console.log("top dept by enrollments:", q(`SELECT c.dept_id, COUNT(*) c FROM ${enrT} e JOIN crss c ON e.crs_id=c.crs_id GROUP BY 1 ORDER BY c DESC LIMIT 1;`));
  }
  console.log("most popular course:", q(`SELECT ${g.legacy ? "crs_id" : "course_id"}, COUNT(*) c FROM ${enrT} GROUP BY ${g.legacy ? "crs_id" : "course_id"} ORDER BY c DESC LIMIT 1;`));
}
console.log("\n✅ University realm complete: U1 (small) + U2 (medium) + U3 (large)");

