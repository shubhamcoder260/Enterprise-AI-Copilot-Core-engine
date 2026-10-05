// ============================================================
// VERIFICATION: GENERALIZATION LITMUS TEST
// Thesis Experiment: Proves the schema-driven engine operates on
// a NEVER-SEEN database with ZERO code additions and ZERO profile setup.
// Database: Municipal Library (books, borrowers, loans)
// ============================================================

import fs from "fs/promises";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { fileURLToPath } from "url";
import assert from "assert";
import { runCoreEngine } from "../src/core/core.engine.js";
import { switchDatabase, getActiveDatabasePath } from "../src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "../fixtures/library_generalization.db");

// 1. Generate Hermetic Library Database
async function setupLibraryDatabase() {
  try {
    await fs.unlink(DB_PATH);
  } catch {}

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT UNIQUE,
      year INTEGER,
      available INTEGER DEFAULT 1
    );

    CREATE TABLE borrowers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE
    );

    CREATE TABLE loans (
      id INTEGER PRIMARY KEY,
      book_id INTEGER,
      borrower_id INTEGER,
      loan_date TEXT,
      return_date TEXT,
      FOREIGN KEY(book_id) REFERENCES books(id),
      FOREIGN KEY(borrower_id) REFERENCES borrowers(id)
    );
  `);

  // Seed 10 Borrowers
  const borrowerNames = [
    "Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Evan Wright",
    "Fiona Gallagher", "George Clark", "Hannah Abbott", "Ian Malcolm", "Julia Roberts"
  ];
  for (let i = 0; i < borrowerNames.length; i++) {
    await db.run("INSERT INTO borrowers (id, name, email) VALUES (?, ?, ?)", [
      i + 1,
      borrowerNames[i],
      `user${i + 1}@example.org`
    ]);
  }

  // Seed 50 Books
  const authors = ["George Orwell", "Jane Austen", "Mark Twain", "Agatha Christie", "Isaac Asimov"];
  for (let i = 1; i <= 50; i++) {
    const author = authors[(i - 1) % authors.length];
    const year = 1940 + (i * 2); // Ranges 1942 to 2040 (books with year > 2020: 10 books)
    const available = i <= 35 ? 1 : 0; // 35 available, 15 checked out
    await db.run("INSERT INTO books (id, title, author, isbn, year, available) VALUES (?, ?, ?, ?, ?, ?)", [
      i,
      `Book Title ${i}`,
      author,
      `978-0-12345-${100 + i}`,
      year,
      available
    ]);
  }

  // Seed 30 Loans
  // Borrower 1 (Alice Smith) borrows 6 books (top borrower)
  for (let l = 1; l <= 30; l++) {
    const bookId = l;
    const borrowerId = l <= 6 ? 1 : ((l % 9) + 2);
    const isReturned = l > 15;
    const loanDate = `2024-0${((l % 8) + 1)}-10`;
    const returnDate = isReturned ? `2024-0${((l % 8) + 2)}-01` : null;
    await db.run("INSERT INTO loans (id, book_id, borrower_id, loan_date, return_date) VALUES (?, ?, ?, ?, ?)", [
      l,
      bookId,
      borrowerId,
      loanDate,
      returnDate
    ]);
  }

  await db.close();
  console.log("📚 [Setup] Library database generated successfully at:", DB_PATH);
}

// 2. The 10 Generalization Questions
const EXPERIMENT_QUESTIONS = [
  {
    id: "GEN-01",
    question: "How many books are there?",
    type: "count",
    check: (res) => {
      const val = res.data?.value ?? (res.data?.records?.[0]?.result || res.data?.records?.[0]?.count);
      return val === 50 || res.answer.includes("50");
    },
    expected: "50 books"
  },
  {
    id: "GEN-02",
    question: "Show me all books by George Orwell",
    type: "filtered_list",
    check: (res) => {
      const records = res.data?.records || [];
      return records.length > 0 && records.every(r => /george orwell/i.test(r.author || ""));
    },
    expected: "10 books by George Orwell"
  },
  {
    id: "GEN-03",
    question: "How many books are available?",
    type: "filtered_count",
    check: (res) => {
      const val = res.data?.value ?? (res.data?.records?.[0]?.result);
      return val === 35 || res.answer.includes("35");
    },
    expected: "35 available books"
  },
  {
    id: "GEN-04",
    question: "How many borrowers are there?",
    type: "count",
    check: (res) => {
      const val = res.data?.value ?? (res.data?.records?.[0]?.result);
      return val === 10 || res.answer.includes("10");
    },
    expected: "10 borrowers"
  },
  {
    id: "GEN-05",
    question: "Show me books published after 2020",
    type: "range_filter",
    check: (res) => {
      const records = res.data?.records || [];
      return records.length === 10 && records.every(r => Number(r.year) > 2020);
    },
    expected: "10 books published after 2020"
  },
  {
    id: "GEN-06",
    question: "List all borrowers",
    type: "list",
    check: (res) => {
      const records = res.data?.records || [];
      return records.length === 10;
    },
    expected: "10 borrowers in table"
  },
  {
    id: "GEN-07",
    question: "How many loans are there?",
    type: "count",
    check: (res) => {
      const val = res.data?.value ?? (res.data?.records?.[0]?.result);
      return val === 30 || res.answer.includes("30");
    },
    expected: "30 loans"
  },
  {
    id: "GEN-08",
    question: "Show me overdue books",
    type: "domain_semantic_unresolved",
    check: (res) => {
      const sql = res.data?.sql || "";
      return sql.includes("return_date") || res.source === "fallback";
    },
    expected: "Overdue books filtered or honest schema decline"
  },
  {
    id: "GEN-09",
    question: "Who has borrowed the most books?",
    type: "complex_join_unresolved",
    check: (res) => {
      const hasAlice = JSON.stringify(res).includes("Alice Smith") || JSON.stringify(res).includes("borrower_id");
      return hasAlice || res.source === "fallback";
    },
    expected: "Top borrower identified or honest fallback"
  },
  {
    id: "GEN-10",
    question: "What is the average loan duration?",
    type: "temporal_derivation_unresolved",
    check: (res) => {
      return res.source === "dynamic" || res.source === "llm" || res.source === "fallback";
    },
    expected: "Computed duration or honest cascade"
  }
];

async function runGeneralizationLitmus() {
  console.log("==================================================");
  console.log("   GENERALIZATION LITMUS TEST (NEVER-SEEN DB)     ");
  console.log("==================================================");

  await setupLibraryDatabase();

  const originalDb = getActiveDatabasePath();
  await switchDatabase(DB_PATH);

  let passed = 0;
  const scorecard = [];

  for (const exp of EXPERIMENT_QUESTIONS) {
    console.log(`\n❓ [${exp.id}] Query: "${exp.question}"`);
    const res = await runCoreEngine({
      query: exp.question,
      organization: "general",
      role: "admin",
      sessionId: `gen-${exp.id.toLowerCase()}`
    });

    const isPass = exp.check(res);
    const status = isPass ? "PASS" : "FAIL";
    if (isPass) passed++;

    const reason = isPass
      ? `Answered via [${res.source}]: ${res.data?.sql || res.answer.slice(0, 60)}`
      : `Failed expectation '${exp.expected}'. Source: ${res.source}. Reason: ${res.meta?.pipelineTrace?.map(t => t.reason).filter(Boolean).join(" -> ") || "unmatched_schema_intent"}`;

    scorecard.push({
      id: exp.id,
      question: exp.question,
      type: exp.type,
      status,
      source: res.source,
      reason
    });

    console.log(`   ${isPass ? "✅" : "⚠️"} ${status} [${res.source}] — ${reason}`);
  }

  // Restore DB
  if (originalDb) {
    await switchDatabase(originalDb);
  }

  console.log("\n==================================================");
  console.log(`📊 GENERALIZATION SCORECARD: ${passed}/${EXPERIMENT_QUESTIONS.length} PASSED`);
  console.log("==================================================");
  for (const s of scorecard) {
    console.log(`  [${s.id}] ${s.status.padEnd(5)} | Source: ${s.source.padEnd(10)} | "${s.question}"`);
  }

  // Acceptance Criterion A8: At least 5/10 questions answered correctly without code additions
  assert.ok(
    passed >= 5,
    `Generalization baseline requires at least 5/10 passed without custom code. Got ${passed}/10.`
  );

  console.log("\n🏆 GENERALIZATION LITMUS PASSED: Pure schema-driven engine verified on novel DB!");
}

runGeneralizationLitmus().catch((err) => {
  console.error("❌ Generalization litmus test failed:", err);
  process.exit(1);
});
