import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATABASE = path.join(
  __dirname,
  "../../chinook.db"
);

const CONFIG_FILE = path.join(
  __dirname,
  "../../active-database.json"
);

let activeDatabasePath = DEFAULT_DATABASE;
let db = null;


// ==========================================
// LOAD ACTIVE DATABASE
// ==========================================

function loadActiveDatabasePath() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return DEFAULT_DATABASE;
    }

    const saved = JSON.parse(
      fs.readFileSync(CONFIG_FILE, "utf8")
    );

    if (
      saved.activeDatabasePath &&
      fs.existsSync(saved.activeDatabasePath)
    ) {
      return saved.activeDatabasePath;
    }

  } catch (error) {
    console.error(
      "Could not load active database:",
      error.message
    );
  }

  return DEFAULT_DATABASE;
}


// ==========================================
// SAVE ACTIVE DATABASE
// ==========================================

function saveActiveDatabasePath(databasePath) {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          activeDatabasePath: databasePath
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(
      "💾 Active database saved:",
      databasePath
    );

  } catch (error) {
    console.error(
      "Could not save active database:",
      error.message
    );
  }
}


// ==========================================
// INITIALIZE
// ==========================================

activeDatabasePath = loadActiveDatabasePath();


// ==========================================
// CONNECT DATABASE
// ==========================================

export async function connectDatabase() {

  if (db) {
    return db;
  }

  console.log(
    "🔌 Connecting to database:",
    activeDatabasePath
  );

  db = await open({
    filename: activeDatabasePath,
    driver: sqlite3.Database
  });

  console.log(
    "✅ CogniCore connected to database:",
    activeDatabasePath
  );

  return db;
}


// ==========================================
// SWITCH DATABASE
// ==========================================

export async function switchDatabase(newDatabasePath) {

  console.log(
    "🔄 Switching database to:",
    newDatabasePath
  );

  if (!fs.existsSync(newDatabasePath)) {
    throw new Error(
      `Database file does not exist: ${newDatabasePath}`
    );
  }

  if (db) {
    await db.close();
    db = null;
  }

  activeDatabasePath = newDatabasePath;

  saveActiveDatabasePath(activeDatabasePath);

  return await connectDatabase();
}


// ==========================================
// GET ACTIVE DATABASE
// ==========================================

export function getActiveDatabasePath() {
  return activeDatabasePath;
}