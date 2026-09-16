// ============================================================
// HOSPITAL REALM GENERATOR — 3 sizes, complete column map
// H1_clinic.db     SMALL  modern, normalized, ISO dates
// H2_legacymed.db  LARGE  legacy abbreviated, denormalized dept, YYYYMMDD
// H3_metropol.db   MEDIUM modern + wards/lab_tests/appointments extras
// Deterministic. Run: node database/gen_hospital.js
// ============================================================
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(__dirname, "..", "test", "fixtures", "realms", "hospital");
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

const FIRST = ["Aarav", "Maya", "Kiran", "Tariq", "Ingrid", "Raj", "Zara", "Omar", "Lena", "Viktor", "Priya", "Hana", "Diego", "Nadia", "Felix", "Aiko", "Samir", "Greta", "Rohan", "Yuki"];
const LAST = ["Patel", "Khan", "Weber", "Silva", "Okafor", "Rossi", "Kim", "Haddad", "Novak", "Tanaka", "Sharma", "Lopez", "Ahmed", "Berger", "Costa", "Devi", "Iyer", "Jain", "Mehta", "Rahman"];
const DEPTS = ["Cardiology", "Neurology", "Orthopedics", "Pediatrics", "Oncology", "General Medicine", "Emergency"];
const DIAGNOSES = [["I10", "Hypertension"], ["E11", "Type 2 Diabetes"], ["J45", "Asthma"], ["M54", "Low Back Pain"], ["N39", "Urinary Tract Infection"], ["K29", "Gastritis"], ["R07", "Chest Pain"], ["F41", "Anxiety Disorder"]];
const MEDS = ["Metformin", "Lisinopril", "Albuterol", "Ibuprofen", "Amoxicillin", "Omeprazole", "Atorvastatin", "Sertraline"];
const STATUSES = ["Completed", "Completed", "Completed", "Completed", "Follow-up", "Cancelled"];
const LAB_TESTS = [["CBC", "Complete Blood Count"], ["LFT", "Liver Function"], ["LIPID", "Lipid Panel"], ["XRAY", "X-Ray"], ["MRI", "MRI Scan"], ["URINE", "Urinalysis"]];

function generateHospital(opts) {
  const { name, seed, patients: nPatients, visitMin, visitMax, legacy, metropol } = opts;
  const rng = mulberry32(seed);
  const suffix = legacy ? "legacymed" : metropol ? "metropol" : "clinic";
  const dbPath = path.join(OUT_DIR, `${name}_${suffix}.db`);
  rmSync(dbPath, { force: true });

  // ============================================================
  // THE COMPLETE MAP — doctors, patients, visits, diagnoses,
  // prescriptions (+ wards/lab_tests/appointments when metropol).
  // DDL and verification reference NOTHING outside this object.
  // ============================================================
  const T = legacy
    ? {
        doc: "docs",   docPk: "doc_id",   docNm: "doc_nm",   docDept: "dept_nm",  docExp: "yrs_exp",
        pat: "pts",    patPk: "pat_id",   patNm: "pat_nm",   patAge: "age",       patSex: "sex",        patBlood: "blood",
        vis: "vsts",   visPk: "visit_id", visPat: "pat_id",  visDoc: "doc_id",    visDept: "dept_nm",   visDate: "adm_dt",   visFee: "fee",   visSt: "status",
        dx: "dx",      dxPk: "dx_id",     dxVis: "visit_id", dxCode: "dx_code",   dxNm: "dx_nm",        dxSev: "severity",
        rx: "rx",      rxPk: "rx_id",     rxVis: "visit_id", rxMed: "med_nm",     rxDays: "dur_days",
      }
    : {
        doc: "doctors",        docPk: "doc_id",  docNm: "name",   docDept: "dept_id", docExp: "experience_yrs",
        pat: "patients",       patPk: "patient_id", patNm: "patient_name", patAge: "age", patSex: "gender", patBlood: "blood_group",
        vis: "visits",         visPk: "visit_id", visPat: "patient_id", visDoc: "doctor_id", visDept: "dept_id", visDate: "visit_date", visFee: "fee", visSt: "status",
        dx: "diagnoses",       dxPk: "dx_id",     dxVis: "visit_id", dxCode: "code",      dxNm: "diagnosis",    dxSev: "severity",
        rx: "prescriptions",   rxPk: "rx_id",     rxVis: "visit_id", rxMed: "medicine",   rxDays: "duration_days",
      };
  // metropol extras share the modern shape (only H3 uses them)
  const X = {
    ward: "wards",        wardPk: "ward_id",   wardNm: "ward_name", wardBeds: "beds",
    lab: "lab_tests",     labPk: "lab_id",     labVis: "visit_id",  labCode: "test_code", labRes: "result",
    apt: "appointments",  aptPk: "appt_id",    aptPat: "patient_id", aptDoc: "doctor_id", aptDay: "appt_day", aptMonth: "appt_month", aptYear: "appt_year",
  };

  const L = [];
  L.push("PRAGMA journal_mode=DELETE;");
  L.push("BEGIN TRANSACTION;");

  const doctors = [];
  for (let i = 0; i < 25; i++) {
    doctors.push({
      id: i + 1,
      name: legacy ? `Dr. ${pick(rng, LAST)}, ${pick(rng, FIRST)}` : `Dr. ${pick(rng, FIRST)} ${pick(rng, LAST)}`,
      dept: legacy ? DEPTS[i % DEPTS.length] : DEPTS.indexOf(DEPTS[i % DEPTS.length]) + 1,  // legacy stores NAME, modern stores ID
      experience: int(rng, 2, 30),
    });
  }

  const patients = [];
  for (let i = 0; i < nPatients; i++) {
    const fn = pick(rng, FIRST), ln = pick(rng, LAST);
    patients.push({
      id: i + 1,
      name: legacy ? `${ln}, ${fn}` : `${fn} ${ln}`,
      age: int(rng, 1, 92),
      sex: pick(rng, ["M", "F"]),
      phone: `9${int(rng, 1000000000, 9999999999)}`,
      blood: pick(rng, ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]),
    });
  }

  const visits = [];
  let vid = 0;
  for (const p of patients) {
    const n = int(rng, visitMin, visitMax);
    for (let k = 0; k < n; k++) {
      vid++;
      const dept = pick(rng, DEPTS);
      const day = int(rng, 1, 28), month = int(rng, 1, 12), year = int(rng, 2023, 2025);
      visits.push({
        id: vid,
        pat: p.id,
        doc: pick(rng, doctors).id,
        dept: legacy ? dept : DEPTS.indexOf(dept) + 1,   // legacy: name inline (denormalized flavor)
        date: legacy
          ? `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`
          : `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        fee: int(rng, 200, 5000),
        status: pick(rng, STATUSES),
      });
    }
  }

  const diagnoses = [], prescriptions = [];
  let did = 0, rxid = 0;
  for (const v of visits) {
    if (v.status === "Cancelled") continue;
    const d = pick(rng, DIAGNOSES);
    diagnoses.push({ id: ++did, visit: v.id, code: d[0], name: d[1], severity: pick(rng, ["Mild", "Moderate", "Severe"]) });
    if (rng() < 0.55) prescriptions.push({ id: ++rxid, visit: v.id, med: pick(rng, MEDS), days: int(rng, 3, 30) });
  }

  // ── DDL — built entirely through the map ──
  if (legacy) {
    L.push(`CREATE TABLE ${T.doc} (${T.docPk} INTEGER PRIMARY KEY, ${T.docNm} TEXT NOT NULL, ${T.docDept} TEXT, ${T.docExp} INTEGER);`);
    doctors.forEach(d => L.push(`INSERT INTO ${T.doc} VALUES (${d.id}, '${esc(d.name)}', '${d.dept}', ${d.experience});`));
    L.push(`CREATE TABLE ${T.pat} (${T.patPk} INTEGER PRIMARY KEY, ${T.patNm} TEXT NOT NULL, ${T.patAge} INTEGER, ${T.patSex} TEXT, phone TEXT, ${T.patBlood} TEXT);`);
    patients.forEach(p => L.push(`INSERT INTO ${T.pat} VALUES (${p.id}, '${esc(p.name)}', ${p.age}, '${p.sex}', '${p.phone}', '${p.blood}');`));
    L.push(`CREATE TABLE ${T.vis} (${T.visPk} INTEGER PRIMARY KEY, ${T.visPat} INTEGER NOT NULL, ${T.visDoc} INTEGER NOT NULL, ${T.visDept} TEXT NOT NULL, ${T.visDate} TEXT NOT NULL, ${T.visFee} REAL, ${T.visSt} TEXT);`);
    visits.forEach(v => L.push(`INSERT INTO ${T.vis} VALUES (${v.id}, ${v.pat}, ${v.doc}, '${v.dept}', '${v.date}', ${v.fee}, '${v.status}');`));
    L.push(`CREATE TABLE ${T.dx} (${T.dxPk} INTEGER PRIMARY KEY, ${T.dxVis} INTEGER NOT NULL, ${T.dxCode} TEXT, ${T.dxNm} TEXT, ${T.dxSev} TEXT);`);
    diagnoses.forEach(d => L.push(`INSERT INTO ${T.dx} VALUES (${d.id}, ${d.visit}, '${d.code}', '${esc(d.name)}', '${d.severity}');`));
    L.push(`CREATE TABLE ${T.rx} (${T.rxPk} INTEGER PRIMARY KEY, ${T.rxVis} INTEGER NOT NULL, ${T.rxMed} TEXT, ${T.rxDays} INTEGER);`);
    prescriptions.forEach(p => L.push(`INSERT INTO ${T.rx} VALUES (${p.id}, ${p.visit}, '${p.med}', ${p.days});`));
    L.push(`CREATE INDEX idx_vsts_pat ON ${T.vis}(${T.visPat});`);
  } else {
    L.push(`CREATE TABLE ${T.doc} (${T.docPk} INTEGER PRIMARY KEY, ${T.docNm} TEXT NOT NULL, ${T.docDept} INTEGER NOT NULL, ${T.docExp} INTEGER);`);
    doctors.forEach(d => L.push(`INSERT INTO ${T.doc} VALUES (${d.id}, '${esc(d.name)}', ${d.dept}, ${d.experience});`));
    L.push(`CREATE TABLE ${T.pat} (${T.patPk} INTEGER PRIMARY KEY, ${T.patNm} TEXT NOT NULL, ${T.patAge} INTEGER, ${T.patSex} TEXT, phone TEXT, ${T.patBlood} TEXT);`);
    patients.forEach(p => L.push(`INSERT INTO ${T.pat} VALUES (${p.id}, '${esc(p.name)}', ${p.age}, '${p.sex}', '${p.phone}', '${p.blood}');`));
    L.push(`CREATE TABLE ${T.vis} (${T.visPk} INTEGER PRIMARY KEY, ${T.visPat} INTEGER NOT NULL, ${T.visDoc} INTEGER NOT NULL, ${T.visDept} INTEGER NOT NULL, ${T.visDate} TEXT NOT NULL, ${T.visFee} REAL, ${T.visSt} TEXT);`);
    visits.forEach(v => L.push(`INSERT INTO ${T.vis} VALUES (${v.id}, ${v.pat}, ${v.doc}, ${v.dept}, '${v.date}', ${v.fee}, '${v.status}');`));
    L.push(`CREATE TABLE ${T.dx} (${T.dxPk} INTEGER PRIMARY KEY, ${T.dxVis} INTEGER NOT NULL, ${T.dxCode} TEXT, ${T.dxNm} TEXT, ${T.dxSev} TEXT);`);
    diagnoses.forEach(d => L.push(`INSERT INTO ${T.dx} VALUES (${d.id}, ${d.visit}, '${d.code}', '${esc(d.name)}', '${d.severity}');`));
    L.push(`CREATE TABLE ${T.rx} (${T.rxPk} INTEGER PRIMARY KEY, ${T.rxVis} INTEGER NOT NULL, ${T.rxMed} TEXT, ${T.rxDays} INTEGER);`);
    prescriptions.forEach(p => L.push(`INSERT INTO ${T.rx} VALUES (${p.id}, ${p.visit}, '${p.med}', ${p.days});`));
    L.push(`CREATE TABLE departments (dept_id INTEGER PRIMARY KEY, name TEXT NOT NULL, floor INTEGER);`);
    DEPTS.forEach((d, i) => L.push(`INSERT INTO departments VALUES (${i + 1}, '${d}', ${(i % 5) + 1});`));
    L.push(`CREATE INDEX idx_vis_pat ON ${T.vis}(${T.visPat});`);
    L.push(`CREATE INDEX idx_vis_dept ON ${T.vis}(${T.visDept});`);
  }

  // ── metropol extras (modern shape only) ──
  if (metropol) {
    const wards = [];
    for (let w = 0; w < 8; w++) wards.push({ id: w + 1, name: `Ward ${String.fromCharCode(65 + w)}`, beds: int(rng, 20, 60) });
    L.push(`CREATE TABLE ${X.ward} (${X.wardPk} INTEGER PRIMARY KEY, ${X.wardNm} TEXT, ${X.wardBeds} INTEGER);`);
    wards.forEach(w => L.push(`INSERT INTO ${X.ward} VALUES (${w.id}, '${w.name}', ${w.beds});`));

    const labs = [];
    for (const v of visits) {
      if (v.status === "Cancelled") continue;
      if (rng() < 0.45) labs.push({ id: labs.length + 1, visit: v.id, test: pick(rng, LAB_TESTS)[0], result: pick(rng, ["Normal", "Abnormal", "Borderline"]) });
    }
    L.push(`CREATE TABLE ${X.lab} (${X.labPk} INTEGER PRIMARY KEY, ${X.labVis} INTEGER NOT NULL, ${X.labCode} TEXT, ${X.labRes} TEXT);`);
    labs.forEach(l => L.push(`INSERT INTO ${X.lab} VALUES (${l.id}, ${l.visit}, '${l.test}', '${l.result}');`));

    const appts = [];
    for (let a = 0; a < Math.floor(visits.length * 0.4); a++) {
      appts.push({ id: a + 1, pat: pick(rng, patients).id, doc: pick(rng, doctors).id, day: int(rng, 1, 28), month: int(rng, 1, 12), year: int(rng, 2025, 2026) });
    }
    L.push(`CREATE TABLE ${X.apt} (${X.aptPk} INTEGER PRIMARY KEY, ${X.aptPat} INTEGER, ${X.aptDoc} INTEGER, ${X.aptDay} INTEGER, ${X.aptMonth} INTEGER, ${X.aptYear} INTEGER);`);
    appts.forEach(a => L.push(`INSERT INTO ${X.apt} VALUES (${a.id}, ${a.pat}, ${a.doc}, ${a.day}, ${a.month}, ${a.year});`));

    L.push(`CREATE INDEX idx_lab_vis ON ${X.lab}(${X.labVis});`);
    L.push(`CREATE INDEX idx_appt_pat ON ${X.apt}(${X.aptPat});`);
    console.log(`[${name}] extras: wards=8, lab_tests=${labs.length}, appointments=${appts.length}`);
  }

  L.push("COMMIT;");
  const sqlFile = path.join(OUT_DIR, `.gen_${name}.sql`);
  writeFileSync(sqlFile, L.join("\n"));
  execSync(`sqlite3 "${dbPath}" < "${sqlFile}"`);
  rmSync(sqlFile);
  return { dbPath, legacy, metropol, T, X, doctors, patients, visits, diagnoses, prescriptions };
}

// ═══ GENERATE — 3 sizes ═══
const h1 = generateHospital({ name: "H1", seed: 42, patients: 400, visitMin: 3, visitMax: 10, legacy: false });
const h2 = generateHospital({ name: "H2", seed: 1337, patients: 15000, visitMin: 5, visitMax: 14, legacy: true });
const h3 = generateHospital({ name: "H3", seed: 777, patients: 3000, visitMin: 2, visitMax: 9, legacy: false, metropol: true });

// ═══ VERIFICATION — every reference through T/X, zero hardcoded names ═══
for (const [label, g] of [["H1_clinic (SMALL)", h1], ["H2_legacymed (LARGE)", h2], ["H3_metropol (MEDIUM)", h3]]) {
  console.log(`\n═══ ${label} — ${g.dbPath} ═══`);
  const T = g.T;
  const dateExpr = g.legacy ? `substr(${T.visDate},1,4)='2024'` : `${T.visDate} LIKE '2024%'`;
  const q = (s) => execSync(`sqlite3 "${g.dbPath}" "${s}"`).toString().trim();

  console.log("doctors:", q(`SELECT COUNT(*) FROM ${T.doc};`));
  console.log("patients:", q(`SELECT COUNT(*) FROM ${T.pat};`));
  console.log("visits:", q(`SELECT COUNT(*) FROM ${T.vis};`));
  console.log("2024 visits:", q(`SELECT COUNT(*) FROM ${T.vis} WHERE ${dateExpr};`));
  console.log("cancelled:", q(`SELECT COUNT(*) FROM ${T.vis} WHERE ${T.visSt}='Cancelled';`));
  console.log("total completed fees:", q(`SELECT ROUND(SUM(${T.visFee}),2) FROM ${T.vis} WHERE ${T.visSt}='Completed';`));
  console.log("top dept by visits:", q(`SELECT ${T.visDept}, COUNT(*) c FROM ${T.vis} GROUP BY ${T.visDept} ORDER BY c DESC LIMIT 1;`));
  console.log("busiest doctor:", q(`SELECT d.${T.docNm}, COUNT(*) c FROM ${T.vis} v JOIN ${T.doc} d ON v.${T.visDoc}=d.${T.docPk} GROUP BY 1 ORDER BY c DESC LIMIT 1;`));
  console.log("diagnoses:", q(`SELECT COUNT(*) FROM ${T.dx};`));
  console.log("prescriptions:", q(`SELECT COUNT(*) FROM ${T.rx};`));

  if (g.metropol) {
    const X = g.X;
    console.log("wards:", q(`SELECT COUNT(*) FROM ${X.ward};`));
    console.log("lab_tests:", q(`SELECT COUNT(*) FROM ${X.lab};`));
    console.log("normal lab results:", q(`SELECT COUNT(*) FROM ${X.lab} WHERE ${X.labRes}='Normal';`));
    console.log("appointments:", q(`SELECT COUNT(*) FROM ${X.apt};`));
  }
}
console.log("\n✅ Hospital realm complete: H1 (small) + H2 (large) + H3 (medium)");