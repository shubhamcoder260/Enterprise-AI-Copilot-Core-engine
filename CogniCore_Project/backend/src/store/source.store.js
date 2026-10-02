// ============================================================
// SOURCE STORE (PERSISTENT SOURCE REGISTRY)
// Dedicated internal database: backend/data/cognicore_sources.db
// Persists customer and dynamic data sources across server restarts.
// ============================================================

import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCES_DB_PATH = path.resolve(__dirname, "../../data/cognicore_sources.db");

let sourcesDb = null;
let initPromise = null;

function rowToDescriptor(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    dialect: row.dialect,
    credentialRef: row.credential_ref,
    profileRef: row.profile_ref,
    path: row.path || null,
    host: row.host || null,
    port: row.port ? Number(row.port) : null,
    database: row.database || null,
    status: row.status || "untested",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function initSourceStore() {
  if (sourcesDb) return sourcesDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dataDir = path.dirname(SOURCES_DB_PATH);
    await fs.mkdir(dataDir, { recursive: true });

    sourcesDb = await open({
      filename: SOURCES_DB_PATH,
      driver: sqlite3.Database
    });

    await sourcesDb.exec("PRAGMA journal_mode = WAL;");

    await sourcesDb.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        dialect TEXT NOT NULL,
        credential_ref TEXT NOT NULL,
        profile_ref TEXT NOT NULL,
        path TEXT,
        host TEXT,
        port INTEGER,
        database TEXT,
        status TEXT NOT NULL DEFAULT 'untested',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    return sourcesDb;
  })();

  return initPromise;
}

export async function saveSource(descriptor) {
  if (!descriptor || !descriptor.id) {
    throw new Error("[Source Store] Invalid source descriptor: missing id");
  }

  const db = await initSourceStore();
  const now = new Date().toISOString();

  const id = descriptor.id;
  const name = descriptor.name || descriptor.id;
  const kind = descriptor.kind || descriptor.dialect || "mariadb";
  const dialect = descriptor.dialect || descriptor.kind || "mariadb";
  const credentialRef = descriptor.credentialRef || `vault:${descriptor.id}`;
  const profileRef = descriptor.profileRef || (dialect === "mariadb" ? "erpnext" : dialect);
  const dbPath = descriptor.path || null;
  const host = descriptor.host || null;
  const port = descriptor.port ? Number(descriptor.port) : null;
  const database = descriptor.database || null;
  const status = descriptor.status || "untested";

  await db.run(
    `INSERT INTO sources (id, name, kind, dialect, credential_ref, profile_ref, path, host, port, database, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       kind = excluded.kind,
       dialect = excluded.dialect,
       credential_ref = excluded.credential_ref,
       profile_ref = excluded.profile_ref,
       path = excluded.path,
       host = excluded.host,
       port = excluded.port,
       database = excluded.database,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [id, name, kind, dialect, credentialRef, profileRef, dbPath, host, port, database, status, now, now]
  );

  return getSource(id);
}

export async function getSource(id) {
  if (!id) return null;
  const db = await initSourceStore();
  const row = await db.get("SELECT * FROM sources WHERE id = ?", [id]);
  return rowToDescriptor(row);
}

export async function getAllSources() {
  const db = await initSourceStore();
  const rows = await db.all("SELECT * FROM sources ORDER BY created_at ASC");
  return rows.map(rowToDescriptor);
}

export async function updateSourceStatus(id, status) {
  if (!id) return;
  const db = await initSourceStore();
  const now = new Date().toISOString();
  await db.run("UPDATE sources SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
}

export async function deleteSource(id) {
  if (!id) return false;
  const db = await initSourceStore();
  const res = await db.run("DELETE FROM sources WHERE id = ?", [id]);
  return (res.changes || 0) > 0;
}

export async function closeSourceStore() {
  if (sourcesDb) {
    try {
      await sourcesDb.close();
    } catch {}
    sourcesDb = null;
    initPromise = null;
  }
}
