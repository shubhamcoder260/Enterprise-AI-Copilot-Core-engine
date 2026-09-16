// ============================================================
// INDUSTRY REALM GENERATOR — 3 sizes, complete column map
// I1_workshop.db   SMALL  terse names, denormalized, epoch timestamps
// I2_factory.db    MEDIUM hybrid, ISO dates
// I3_plantops.db   LARGE  verbose, normalized, OEE-style metrics
// Deterministic. Run: node database/gen_industry.js
// ============================================================
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(__dirname, "..", "test", "fixtures", "realms", "industry");
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

const SHIFTS = ["Morning", "Evening", "Night"];
const DEFECT_TYPES = [["SCRATCH", "Surface Scratch"], ["DENT", "Structural Dent"], ["MISCUT", "Miscut Dimension"], ["WELD", "Weld Failure"], ["PAINT", "Paint Defect"]];
const MACHINES_VERBOSE = ["CNC Mill Alpha", "CNC Lathe Beta", "Hydraulic Press One", "Assembly Robot A", "Assembly Robot B", "Injection Molder X", "Injection Molder Y", "Laser Cutter Pro"];
const OPERATORS_VERBOSE = ["Ravi Kumar", "Suresh Singh", "Anita Verma", "Deepak Das", "Meera Iyer", "Arun Bose"];

function generateIndustry(opts) {
  const { name, seed, runs: nRuns, terse, verbose } = opts;
  const rng = mulberry32(seed);
  const suffix = terse ? "workshop" : verbose ? "plantops" : "factory";
  const dbPath = path.join(OUT_DIR, `${name}_${suffix}.db`);
  rmSync(dbPath, { force: true });

  // ============================================================
  // THE COMPLETE MAP — machines, production_runs, defect_log.
  // Legacy (I1): terse names, epoch int timestamps, denormalized.
  // Modern (I2/I3): verbose names, ISO date text, normalized.
  // DDL and verification reference NOTHING outside this object.
  // ============================================================
  const T = terse
    ? {
        mc: "mcs",    mcPk: "mc_id",   mcNm: "mc_nm",    mcEff: "eff",    mcYr: "yr",
        run: "prod",  runPk: "run_id", runMc: "mc_id",   runShift: "shift", runTs: "run_ts", runUnits: "units", runDefs: "defs", runOpr: "opr",
        df: "dfc",    dfPk: "df_id",   dfRun: "run_id",  dfType: "tp",    dfSev: "sv",
        timeMode: "epoch",
      }
    : {
        mc: "machines",       mcPk: "machine_id",  mcNm: "machine_name", mcEff: "efficiency_pct", mcYr: "install_year",
        run: "production_runs", runPk: "run_id",   runMc: "machine_id",  runShift: "shift",        runTs: "run_date", runUnits: "units_produced", runDefs: "units_defective", runOpr: "operator",
        df: "defect_log",     dfPk: "defect_id",   dfRun: "run_id",      dfType: "defect_type",    dfSev: "severity",
        timeMode: "iso",
      };

  const L = [];
  L.push("PRAGMA journal_mode=DELETE;");
  L.push("BEGIN TRANSACTION;");

  // machines
  const machines = [];
  const nMachines = Math.max(6, Math.floor(nRuns / 500));
  for (let m = 0; m < nMachines; m++) {
    machines.push({
      id: m + 1,
      name: terse ? `MC_${String(m + 1).padStart(3, "0")}` : MACHINES_VERBOSE[m % MACHINES_VERBOSE.length],
      efficiency: int(rng, 60, 98),
      installYear: int(rng, 2010, 2024),
    });
  }

  // production runs (spread over ~1 year)
  const START_EPOCH = 1704067200; // 2024-01-01
  const productionRuns = [];
  const defects = [];
  let did = 0;
  for (let r = 0; r < nRuns; r++) {
    const m = pick(rng, machines);
    const shift = pick(rng, SHIFTS);
    const epoch = START_EPOCH + int(rng, 0, 7 * 86400 * 52);
    const produced = int(rng, 50, 1200);
    const defectRate = rng() < 0.08 ? int(rng, 3, 8) / 100 : int(rng, 0, 2) / 100;  // 8% bad batches
    const defective = Math.floor(produced * defectRate);
    const timestamp = T.timeMode === "epoch" ? epoch : new Date(epoch * 1000).toISOString().slice(0, 10);
    productionRuns.push({
      id: r + 1, mc: m.id, shift, ts: timestamp,
      units: produced, defs: defective,
      operator: terse ? pick(rng, OPERATORS_VERBOSE).split(" ")[0].toUpperCase() : pick(rng, OPERATORS_VERBOSE),
    });
    for (let d = 0; d < Math.min(defective, 12); d++) {
      const dt = pick(rng, DEFECT_TYPES);
      defects.push({ id: ++did, run: r + 1, type: dt[0], severity: int(rng, 1, 5) });
    }
  }

  // ── DDL — entirely through the map ──
  L.push(`CREATE TABLE ${T.mc} (${T.mcPk} INTEGER PRIMARY KEY, ${T.mcNm} TEXT NOT NULL, ${T.mcEff} INTEGER, ${T.mcYr} INTEGER);`);
  machines.forEach(m => L.push(`INSERT INTO ${T.mc} VALUES (${m.id}, '${esc(m.name)}', ${m.efficiency}, ${m.installYear});`));

  if (T.timeMode === "epoch") {
    L.push(`CREATE TABLE ${T.run} (${T.runPk} INTEGER PRIMARY KEY, ${T.runMc} INTEGER NOT NULL, ${T.runShift} TEXT, ${T.runTs} INTEGER NOT NULL, ${T.runUnits} INTEGER, ${T.runDefs} INTEGER, ${T.runOpr} TEXT);`);
  } else {
    L.push(`CREATE TABLE ${T.run} (${T.runPk} INTEGER PRIMARY KEY, ${T.runMc} INTEGER NOT NULL, ${T.runShift} TEXT, ${T.runTs} TEXT NOT NULL, ${T.runUnits} INTEGER, ${T.runDefs} INTEGER, ${T.runOpr} TEXT);`);
  }
  productionRuns.forEach(p => L.push(`INSERT INTO ${T.run} VALUES (${p.id}, ${p.mc}, '${p.shift}', '${p.ts}', ${p.units}, ${p.defs}, '${esc(p.operator)}');`));

  L.push(`CREATE TABLE ${T.df} (${T.dfPk} INTEGER PRIMARY KEY, ${T.dfRun} INTEGER NOT NULL, ${T.dfType} TEXT, ${T.dfSev} INTEGER);`);
  defects.forEach(d => L.push(`INSERT INTO ${T.df} VALUES (${d.id}, ${d.run}, '${d.type}', ${d.severity});`));

  L.push(`CREATE INDEX idx_run_mc ON ${T.run}(${T.runMc});`);
  L.push(`CREATE INDEX idx_df_run ON ${T.df}(${T.dfRun});`);

  L.push("COMMIT;");
  const sqlFile = path.join(OUT_DIR, `.gen_${name}.sql`);
  writeFileSync(sqlFile, L.join("\n"));
  execSync(`sqlite3 "${dbPath}" < "${sqlFile}"`);
  rmSync(sqlFile);
  return { dbPath, T, machines, productionRuns, defects };
}

// ═══ GENERATE — 3 sizes ═══
const i1 = generateIndustry({ name: "I1", seed: 55, runs: 500,   terse: true });
const i2 = generateIndustry({ name: "I2", seed: 56, runs: 8000,  terse: false, verbose: false });
const i3 = generateIndustry({ name: "I3", seed: 57, runs: 60000, terse: false, verbose: true });

// ═══ VERIFICATION — all through T ═══
for (const [label, g] of [["I1_workshop (SMALL)", i1], ["I2_factory (MEDIUM)", i2], ["I3_plantops (LARGE)", i3]]) {
  console.log(`\n═══ ${label} — ${g.dbPath} ═══`);
  const T = g.T;
  const q = (s) => execSync(`sqlite3 "${g.dbPath}" "${s}"`).toString().trim();

  console.log("machines:", q(`SELECT COUNT(*) FROM ${T.mc};`));
  console.log("production runs:", q(`SELECT COUNT(*) FROM ${T.run};`));
  console.log("total units produced:", q(`SELECT SUM(${T.runUnits}) FROM ${T.run};`));
  console.log("total defective:", q(`SELECT SUM(${T.runDefs}) FROM ${T.run};`));
  console.log("top machine by output:", q(`SELECT m.${T.mcNm}, SUM(r.${T.runUnits}) s FROM ${T.run} r JOIN ${T.mc} m ON r.${T.runMc}=m.${T.mcPk} GROUP BY 1 ORDER BY s DESC LIMIT 1;`));
  console.log("best shift (avg output):", q(`SELECT ${T.runShift}, ROUND(AVG(${T.runUnits}),1) a FROM ${T.run} GROUP BY 1 ORDER BY a DESC LIMIT 1;`));
  console.log("machines with zero defects:", q(`SELECT COUNT(*) FROM ${T.mc} WHERE ${T.mcPk} NOT IN (SELECT ${T.runMc} FROM ${T.run} WHERE ${T.runDefs} > 0);`));
  console.log("defect entries:", q(`SELECT COUNT(*) FROM ${T.df};`));
}
console.log("\n✅ Industry realm complete: I1 (small) + I2 (medium) + I3 (large)");