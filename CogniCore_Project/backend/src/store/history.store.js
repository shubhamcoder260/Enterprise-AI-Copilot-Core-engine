// ==========================================
// HISTORY STORE (PERSISTENT CONVERSATION MEMORY)
// Dedicated internal database: backend/data/cognicore_history.db
// Independent of active user databases and switchDatabase hooks
// ==========================================

import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_DB_PATH = path.resolve(__dirname, "../../data/cognicore_history.db");

let historyDb = null;
let initPromise = null;

export async function initHistoryStore() {
  if (historyDb) return historyDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Ensure data directory exists
    const dataDir = path.dirname(HISTORY_DB_PATH);
    await fs.mkdir(dataDir, { recursive: true });

    historyDb = await open({
      filename: HISTORY_DB_PATH,
      driver: sqlite3.Database
    });

    // Enable WAL mode for high concurrency
    await historyDb.exec("PRAGMA journal_mode = WAL;");

    // Initialize exchanges table and index
    await historyDb.exec(`
      CREATE TABLE IF NOT EXISTS exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        question TEXT,
        answer TEXT,
        source TEXT,
        sql TEXT,
        model TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_exchanges_session_id ON exchanges(session_id);
    `);

    console.log(`🧠 [History Store] Connected in WAL mode: ${HISTORY_DB_PATH}`);
    return historyDb;
  })();

  return initPromise;
}

export async function recordExchange({ sessionId, question, answer, source, sql = null, model = null }) {
  if (!sessionId) return null;
  try {
    const db = await initHistoryStore();
    const result = await db.run(
      `INSERT INTO exchanges (session_id, question, answer, source, sql, model)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(sessionId).trim(),
        question || "",
        answer || "",
        source || "unknown",
        sql || null,
        model || null
      ]
    );
    return result.lastID;
  } catch (err) {
    console.warn("⚠️ [History] Failed to record exchange:", err.message);
    return null;
  }
}

export async function getRecentExchanges(sessionId, limit = 3) {
  if (!sessionId) return [];
  try {
    const db = await initHistoryStore();
    // Fetch last N exchanges in chronological order (oldest to newest among the last N)
    const rows = await db.all(
      `SELECT id, session_id, question, answer, source, sql, model, created_at
       FROM (
         SELECT * FROM exchanges
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT ?
       )
       ORDER BY id ASC`,
      [String(sessionId).trim(), limit]
    );
    return rows;
  } catch (err) {
    console.warn("⚠️ [History] Failed to get recent exchanges:", err.message);
    return [];
  }
}

export async function getFullHistory(sessionId, limit = 100) {
  if (!sessionId) return [];
  try {
    const db = await initHistoryStore();
    const rows = await db.all(
      `SELECT id, session_id, question, answer, source, sql, model, created_at
       FROM (
         SELECT * FROM exchanges
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT ?
       )
       ORDER BY id ASC`,
      [String(sessionId).trim(), limit]
    );
    return rows;
  } catch (err) {
    console.warn("⚠️ [History] Failed to get full history:", err.message);
    return [];
  }
}

export async function closeHistoryStore() {
  if (historyDb) {
    try {
      await historyDb.close();
    } catch {}
    historyDb = null;
    initPromise = null;
  }
}
