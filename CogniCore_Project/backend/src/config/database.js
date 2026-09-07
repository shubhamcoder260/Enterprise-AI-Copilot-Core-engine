import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

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
let readOnlyDb = null;

// Registry for hooks triggered when the database switches (e.g. schema cache invalidation)
const switchHooks = new Set();

export function registerDatabaseSwitchHook(hookFn) {
  if (typeof hookFn === "function") {
    switchHooks.add(hookFn);
  }
}

// Auto-cleanup readOnlyDb on switch hook
registerDatabaseSwitchHook(async () => {
  if (readOnlyDb) {
    try {
      await readOnlyDb.close();
    } catch {}
    readOnlyDb = null;
  }
});

// Helper for non-blocking file existence check
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// LOAD ACTIVE DATABASE (ASYNC)
// ==========================================

async function loadActiveDatabasePath() {
  try {
    if (!(await fileExists(CONFIG_FILE))) {
      return DEFAULT_DATABASE;
    }

    const content = await fs.readFile(CONFIG_FILE, "utf8");
    const saved = JSON.parse(content);

    if (
      saved.activeDatabasePath &&
      (await fileExists(saved.activeDatabasePath))
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
// SAVE ACTIVE DATABASE (ASYNC & ATOMIC)
// ==========================================

async function saveActiveDatabasePath(databasePath) {
  const tempConfigFile = `${CONFIG_FILE}.tmp.${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const data = JSON.stringify(
      {
        activeDatabasePath: databasePath
      },
      null,
      2
    );

    await fs.writeFile(tempConfigFile, data, "utf8");
    await fs.rename(tempConfigFile, CONFIG_FILE);

    console.log(
      "💾 Active database saved:",
      databasePath
    );
  } catch (error) {
    console.error(
      "Could not save active database:",
      error.message
    );
    try {
      await fs.unlink(tempConfigFile);
    } catch {}
  }
}

// ==========================================
// INITIALIZE ACTIVE DATABASE (ASYNC STARTUP)
// ==========================================

let initPromise = null;

export async function ensureInitialized() {
  if (!initPromise) {
    initPromise = loadActiveDatabasePath()
      .then((p) => {
        activeDatabasePath = p;
        return p;
      })
      .catch((err) => {
        console.error("Initialization error, falling back to default:", err.message);
        activeDatabasePath = DEFAULT_DATABASE;
        return DEFAULT_DATABASE;
      });
  }
  return initPromise;
}

// Standard ESM module-level startup
activeDatabasePath = await ensureInitialized();
console.log("📂 [Database Config Loaded on Boot]:", activeDatabasePath);

// ==========================================
// CONNECT DATABASE
// ==========================================

export async function connectDatabase() {
  await ensureInitialized();

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
// SWITCH DATABASE (ASYNC, SERIALIZED QUEUE)
// ==========================================

let switchQueue = Promise.resolve();

async function doSwitchDatabase(newDatabasePath) {
  await ensureInitialized();

  console.log(
    "🔄 Switching database to:",
    newDatabasePath
  );

  if (!(await fileExists(newDatabasePath))) {
    throw new Error(
      `Database file does not exist: ${newDatabasePath}`
    );
  }

  if (db) {
    await db.close();
    db = null;
  }
  if (readOnlyDb) {
    try {
      await readOnlyDb.close();
    } catch {}
    readOnlyDb = null;
  }

  activeDatabasePath = newDatabasePath;

  // Persist asynchronously & atomically
  await saveActiveDatabasePath(activeDatabasePath);

  // Trigger switch hooks (e.g. invalidate schema cache)
  for (const hook of switchHooks) {
    try {
      hook(activeDatabasePath);
    } catch (hookErr) {
      console.error("Error in database switch hook:", hookErr);
    }
  }

  return await connectDatabase();
}

export function switchDatabase(newDatabasePath) {
  // Queue concurrent calls so overlapping operations execute cleanly in sequence
  const currentSwitch = switchQueue.then(() => doSwitchDatabase(newDatabasePath));
  switchQueue = currentSwitch.catch(() => {});
  return currentSwitch;
}

// ==========================================
// READ-ONLY DATABASE (PHYSICAL LOCK FOR LLM)
// ==========================================

export async function getReadOnlyDatabase() {
  await ensureInitialized();
  if (readOnlyDb) {
    return readOnlyDb;
  }

  console.log(
    "🔒 Connecting read-only database:",
    activeDatabasePath
  );

  readOnlyDb = await open({
    filename: activeDatabasePath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READONLY
  });

  console.log(
    "✅ CogniCore read-only connected to:",
    activeDatabasePath
  );

  return readOnlyDb;
}

export async function executeReadOnlySql(sql, params = []) {
  const roDb = await getReadOnlyDatabase();
  return await roDb.all(sql, params);
}

// ==========================================
// GET ACTIVE DATABASE PATH
// ==========================================

export function getActiveDatabasePath() {
  return activeDatabasePath;
}

// ==========================================
// CLOSE DATABASE
// ==========================================

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
  if (readOnlyDb) {
    try {
      await readOnlyDb.close();
    } catch {}
    readOnlyDb = null;
  }
}