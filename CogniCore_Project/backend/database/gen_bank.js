// ============================================================
// BANK REALM GENERATOR — 3 sizes, COMPLETE column map
// B1_community.db  SMALL  abbreviated, YYYYMMDD
// B2_district.db   MEDIUM hybrid
// B3_metro.db      LARGE  verbose, ISO datetimes
// Run: node database/gen_bank.js
// ============================================================
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(__dirname, "..", "test", "fixtures", "realms", "bank");
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

const ACCT_TYPES = ["Savings", "Current", "Fixed Deposit", "Salary"];
const ACCT_STATUS = ["Active", "Active", "Active", "Dormant", "Frozen"];
const TXN_TYPES = ["DEPOSIT", "WITHDRAWAL", "TRANSFER_OUT", "TRANSFER_IN", "BILL_PAYMENT"];
const FIRST = ["Aarav", "Maya", "Kiran", "Tariq", "Ingrid", "Raj", "Zara", "Omar", "Lena", "Viktor", "Priya", "Hana", "Diego", "Nadia", "Felix"];
const LAST = ["Patel", "Khan", "Weber", "Silva", "Okafor", "Rossi", "Kim", "Haddad", "Novak", "Tanaka"];
const CITIES = ["Mumbai", "Delhi", "Pune", "Bangalore"];
const BRANCH_NAMES = ["Metro", "Central", "Riverside", "Hillview", "Airport", "Downtown"];

function generateBank(opts) {
  const { name, seed, accounts: nAccounts, txnMin, txnMax, legacy } = opts;
  const rng = mulberry32(seed);
  const suffix = legacy ? "community" : name === "B3" ? "metro" : "district";
  const dbPath = path.join(OUT_DIR, `${name}_${suffix}.db`);
  rmSync(dbPath, { force: true });

  // ============================================================
  // THE COMPLETE COLUMN MAP — every table, every column, both flavors.
  // Nothing is referenced outside this map.
  //
  // FIX: acBranch was missing. The DDL hardcoded "br_id"/"branch_id" for
  // the accounts→branches FK column, but that name never made it into T,
  // so the verification query's `T.brId` was undefined — it stringified
  // to the literal text "undefined" and broke the JOIN with a
  // "no such column: a.undefined" error, killing the script after all
  // three DBs were already generated.
  // ============================================================
  const T = legacy
    ? {
        // tables
        br: "brs", ac: "accts", tx: "txns", ln: "lns",
        // branch columns
        brPk: "br_id", brNm: "br_nm", brCity: "city",
        // account columns
        acPk: "acct_id", acHolder: "holder_nm", acBranch: "br_id", acType: "acct_typ",
        acBal: "bal", acStatus: "status", acOpenYear: "opn_yr",
        // transaction columns
        txPk: "txn_id", txAcct: "acct_id", txType: "txn_typ", txAmount: "amt", txDate: "txn_dt",
        // loan columns
        lnPk: "ln_id", lnAcct: "acct_id", lnPrincipal: "prin", lnRate: "rate",
        lnDuration: "dur", lnStatus: "status",
      }
    : {
        br: "branches", ac: "accounts", tx: "transactions", ln: "loans",
        brPk: "branch_id", brNm: "branch_name", brCity: "city",
        acPk: "account_id", acHolder: "holder_name", acBranch: "branch_id", acType: "account_type",
        acBal: "balance", acStatus: "status", acOpenYear: "open_year",
        txPk: "txn_id", txAcct: "account_id", txType: "txn_type", txAmount: "amount", txDate: "txn_date",
        lnPk: "loan_id", lnAcct: "account_id", lnPrincipal: "principal", lnRate: "interest_rate_pct",
        lnDuration: "duration_months", lnStatus: "status",
      };

  const L = [];
  L.push("PRAGMA journal_mode=DELETE;");
  L.push("BEGIN TRANSACTION;");

  const branches = [];
  for (let b = 0; b < 6; b++) {
    branches.push({
      id: b + 1,
      name: legacy ? `BR_${String(b + 1).padStart(2, "0")}` : `${BRANCH_NAMES[b]} Branch`,
      city: pick(rng, CITIES),
    });
  }

  const accounts = [];
  for (let a = 0; a < nAccounts; a++) {
    accounts.push({
      id: a + 1,
      holder: legacy ? `${pick(rng, LAST)}, ${pick(rng, FIRST)}` : `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
      branchId: int(rng, 1, branches.length),
      type: pick(rng, ACCT_TYPES),
      status: pick(rng, ACCT_STATUS),
      balance: int(rng, -5000, 500000),
      openYear: int(rng, 2018, 2025),
    });
  }

  const transactions = [];
  let tid = 0;
  for (const acc of accounts) {
    if (acc.status === "Dormant") continue;
    const n = int(rng, txnMin, txnMax);
    for (let k = 0; k < n; k++) {
      tid++;
      const day = int(rng, 1, 28), month = int(rng, 1, 12), year = int(rng, 2023, 2025);
      transactions.push({
        id: tid,
        accId: acc.id,
        type: pick(rng, TXN_TYPES),
        // FIX: was `int(rng, 100, 200000) / 100 * 100` — a no-op (divide
        // and multiply by the same number cancel out), so it generated
        // whole-dollar amounts with no cent precision despite the shape
        // implying one. Now generates real cent-precision amounts.
        amount: int(rng, 10000, 20000000) / 100,
        date: legacy
          ? `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`
          : `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${int(rng, 8, 20)}:${String(int(rng, 0, 59)).padStart(2, "0")}:00`,
      });
    }
  }

  const loans = [];
  for (const acc of accounts) {
    if (rng() < 0.22) {
      loans.push({
        id: loans.length + 1,
        accId: acc.id,
        principal: int(rng, 50000, 5000000),
        ratePct: int(rng, 7, 14),
        months: int(rng, 12, 84),
        status: pick(rng, ["Active", "Active", "Closed", "Defaulted"]),
      });
    }
  }

  // ── DDL + inserts (using ONLY the T map — now actually true) ──
  if (legacy) {
    L.push(`CREATE TABLE ${T.br} (${T.brPk} INTEGER PRIMARY KEY, ${T.brNm} TEXT, ${T.brCity} TEXT);`);
    branches.forEach(b => L.push(`INSERT INTO ${T.br} VALUES (${b.id}, '${esc(b.name)}', '${esc(b.city)}');`));
    L.push(`CREATE TABLE ${T.ac} (${T.acPk} INTEGER PRIMARY KEY, ${T.acHolder} TEXT, ${T.acBranch} INTEGER, ${T.acType} TEXT, ${T.acStatus} TEXT, ${T.acBal} REAL, ${T.acOpenYear} INTEGER);`);
    accounts.forEach(a => L.push(`INSERT INTO ${T.ac} VALUES (${a.id}, '${esc(a.holder)}', ${a.branchId}, '${a.type}', '${a.status}', ${a.balance}, ${a.openYear});`));
    L.push(`CREATE TABLE ${T.tx} (${T.txPk} INTEGER PRIMARY KEY, ${T.txAcct} INTEGER NOT NULL, ${T.txType} TEXT, ${T.txAmount} REAL, ${T.txDate} TEXT);`);
    transactions.forEach(t => L.push(`INSERT INTO ${T.tx} VALUES (${t.id}, ${t.accId}, '${t.type}', ${t.amount}, '${t.date}');`));
    L.push(`CREATE TABLE ${T.ln} (${T.lnPk} INTEGER PRIMARY KEY, ${T.lnAcct} INTEGER, ${T.lnPrincipal} REAL, ${T.lnRate} INTEGER, ${T.lnDuration} INTEGER, ${T.lnStatus} TEXT);`);
    loans.forEach(l => L.push(`INSERT INTO ${T.ln} VALUES (${l.id}, ${l.accId}, ${l.principal}, ${l.ratePct}, ${l.months}, '${l.status}');`));
    L.push(`CREATE INDEX idx_txn_acct ON ${T.tx}(${T.txAcct});`);
  } else {
    L.push(`CREATE TABLE ${T.br} (${T.brPk} INTEGER PRIMARY KEY, ${T.brNm} TEXT, ${T.brCity} TEXT);`);
    branches.forEach(b => L.push(`INSERT INTO ${T.br} VALUES (${b.id}, '${esc(b.name)}', '${esc(b.city)}');`));
    L.push(`CREATE TABLE ${T.ac} (${T.acPk} INTEGER PRIMARY KEY, ${T.acHolder} TEXT, ${T.acBranch} INTEGER REFERENCES ${T.br}(${T.brPk}), ${T.acType} TEXT, ${T.acStatus} TEXT, ${T.acBal} REAL, ${T.acOpenYear} INTEGER);`);
    accounts.forEach(a => L.push(`INSERT INTO ${T.ac} VALUES (${a.id}, '${esc(a.holder)}', ${a.branchId}, '${a.type}', '${a.status}', ${a.balance}, ${a.openYear});`));
    L.push(`CREATE TABLE ${T.tx} (${T.txPk} INTEGER PRIMARY KEY, ${T.txAcct} INTEGER NOT NULL REFERENCES ${T.ac}(${T.acPk}), ${T.txType} TEXT, ${T.txAmount} REAL, ${T.txDate} TEXT);`);
    transactions.forEach(t => L.push(`INSERT INTO ${T.tx} VALUES (${t.id}, ${t.accId}, '${t.type}', ${t.amount}, '${t.date}');`));
    L.push(`CREATE TABLE ${T.ln} (${T.lnPk} INTEGER PRIMARY KEY, ${T.lnAcct} INTEGER REFERENCES ${T.ac}(${T.acPk}), ${T.lnPrincipal} REAL, ${T.lnRate} INTEGER, ${T.lnDuration} INTEGER, ${T.lnStatus} TEXT);`);
    loans.forEach(l => L.push(`INSERT INTO ${T.ln} VALUES (${l.id}, ${l.accId}, ${l.principal}, ${l.ratePct}, ${l.months}, '${l.status}');`));
    L.push(`CREATE INDEX idx_txn_acct ON ${T.tx}(${T.txAcct});`);
    L.push(`CREATE INDEX idx_txn_date ON ${T.tx}(${T.txDate});`);
  }

  L.push("COMMIT;");
  const sqlFile = path.join(OUT_DIR, `.gen_${name}.sql`);
  writeFileSync(sqlFile, L.join("\n"));
  execSync(`sqlite3 "${dbPath}" < "${sqlFile}"`);
  rmSync(sqlFile);
  return { dbPath, legacy, T, accounts, transactions, loans };
}

const b1 = generateBank({ name: "B1", seed: 71, accounts: 200, txnMin: 5, txnMax: 25, legacy: true });
const b2 = generateBank({ name: "B2", seed: 72, accounts: 1500, txnMin: 5, txnMax: 25, legacy: false });
const b3 = generateBank({ name: "B3", seed: 73, accounts: 4000, txnMin: 8, txnMax: 30, legacy: false });

// ── verification: EVERY reference goes through T — zero hardcoded names ──
for (const [label, g] of [["B1_community (SMALL)", b1], ["B2_district (MEDIUM)", b2], ["B3_metro (LARGE)", b3]]) {
  console.log(`\n═══ ${label} — ${g.dbPath} ═══`);
  const T = g.T;
  const q = (s) => execSync(`sqlite3 "${g.dbPath}" "${s}"`).toString().trim();

  console.log("accounts:", q(`SELECT COUNT(*) FROM ${T.ac};`));
  console.log("transactions:", q(`SELECT COUNT(*) FROM ${T.tx};`));
  console.log("dormant:", q(`SELECT COUNT(*) FROM ${T.ac} WHERE ${T.acStatus}='Dormant';`));
  console.log("negative balance:", q(`SELECT COUNT(*) FROM ${T.ac} WHERE ${T.acBal}<0;`));
  console.log("total deposits:", q(`SELECT ROUND(SUM(${T.txAmount}),2) FROM ${T.tx} WHERE ${T.txType}='DEPOSIT';`));
  console.log("top branch by balance:", q(`SELECT br.${T.brNm}, ROUND(SUM(a.${T.acBal}),2) s FROM ${T.ac} a JOIN ${T.br} br ON a.${T.acBranch}=br.${T.brPk} GROUP BY 1 ORDER BY s DESC LIMIT 1;`));
  console.log("defaulted loans:", q(`SELECT COUNT(*) FROM ${T.ln} WHERE ${T.lnStatus}='Defaulted';`));
}
console.log("\n✅ Bank realm complete: B1 (small) + B2 (medium) + B3 (large)");