import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({
  filename: "./cognicore.db",
  driver: sqlite3.Database
});

console.log("Connected to SQLite database");

// Create students table
await db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cgpa REAL,
    country TEXT,
    enrollment_year INTEGER
  )
`);

// Create hospital visits table
await db.exec(`
  CREATE TABLE IF NOT EXISTS hospital_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT,
    department TEXT,
    visit_date TEXT
  )
`);

// Clear old demo records
await db.exec("DELETE FROM students");
await db.exec("DELETE FROM hospital_visits");

// Insert student data
await db.run(
  "INSERT INTO students VALUES (?, ?, ?, ?, ?)",
  ["S001", "Aarav", 9.1, "India", 2026]
);

await db.run(
  "INSERT INTO students VALUES (?, ?, ?, ?, ?)",
  ["S002", "Maya", 8.6, "Nepal", 2026]
);

await db.run(
  "INSERT INTO students VALUES (?, ?, ?, ?, ?)",
  ["S003", "Rahul", 7.8, "India", 2025]
);

await db.run(
  "INSERT INTO students VALUES (?, ?, ?, ?, ?)",
  ["S004", "Anita", 8.2, "Sri Lanka", 2026]
);

await db.run(
  "INSERT INTO students VALUES (?, ?, ?, ?, ?)",
  ["S005", "Kiran", 9.4, "India", 2026]
);

// Insert hospital visit data
await db.run(
  "INSERT INTO hospital_visits (patient_id, department, visit_date) VALUES (?, ?, ?)",
  ["P001", "Cardiology", "2026-09-01"]
);

await db.run(
  "INSERT INTO hospital_visits (patient_id, department, visit_date) VALUES (?, ?, ?)",
  ["P002", "Cardiology", "2026-09-02"]
);

await db.run(
  "INSERT INTO hospital_visits (patient_id, department, visit_date) VALUES (?, ?, ?)",
  ["P003", "Neurology", "2026-09-03"]
);

await db.run(
  "INSERT INTO hospital_visits (patient_id, department, visit_date) VALUES (?, ?, ?)",
  ["P004", "Cardiology", "2026-09-04"]
);

console.log("Students and hospital data inserted successfully!");
console.log("Database setup completed!");

await db.close();