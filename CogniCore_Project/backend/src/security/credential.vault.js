// ============================================================
// CREDENTIAL VAULT (PHASE D6)
// Encrypts and decrypts database credentials at rest using AES-256-GCM.
// Dedicated internal database: backend/data/cognicore_vault.db
// Invariant:
//   - Encryption key loaded ONLY from process.env.VAULT_MASTER_KEY.
//   - Raw secrets are NEVER logged, returned in API responses, or exposed to frontend.
// ============================================================

import crypto from "crypto";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const VAULT_DB_PATH = path.resolve(__dirname, "../../data/cognicore_vault.db");

let vaultDb = null;
let initPromise = null;
const memoryCache = new Map();

function getMasterKey() {
  const masterKey = process.env.VAULT_MASTER_KEY;
  if (!masterKey || typeof masterKey !== "string" || !masterKey.trim()) {
    throw new Error("[Credential Vault] Fatal: VAULT_MASTER_KEY environment variable is not configured.");
  }
  return crypto.createHash("sha256").update(masterKey.trim()).digest();
}

function decryptRecord(ivHex, tagHex, ciphertextHex) {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

function encryptRecord(credentialObject) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const serialized = JSON.stringify(credentialObject);
  let ciphertext = cipher.update(serialized, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    iv: iv.toString("hex"),
    tag: authTag,
    ciphertext
  };
}

export async function initCredentialVault() {
  if (vaultDb) return vaultDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dataDir = path.dirname(VAULT_DB_PATH);
    await fs.mkdir(dataDir, { recursive: true });

    vaultDb = await open({
      filename: VAULT_DB_PATH,
      driver: sqlite3.Database
    });

    await vaultDb.exec("PRAGMA journal_mode = WAL;");

    await vaultDb.exec(`
      CREATE TABLE IF NOT EXISTS vault_entries (
        source_id TEXT PRIMARY KEY,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Pre-populate memory cache from persisted entries
    try {
      const rows = await vaultDb.all("SELECT source_id, iv, auth_tag, ciphertext FROM vault_entries");
      for (const row of rows) {
        try {
          const decrypted = decryptRecord(row.iv, row.auth_tag, row.ciphertext);
          memoryCache.set(row.source_id, decrypted);
        } catch (decErr) {
          console.error("❌ [Credential Vault] Credential decryption failed for a source entry");
        }
      }
    } catch {}

    return vaultDb;
  })();

  return initPromise;
}

// Auto-initialize vault in background on import
initCredentialVault().catch(() => {});

export async function storeCredential(sourceId, credentialObject) {
  if (!sourceId || typeof sourceId !== "string") {
    throw new Error("[Credential Vault] Invalid sourceId for credential storage.");
  }
  if (!credentialObject || typeof credentialObject !== "object") {
    throw new Error("[Credential Vault] Invalid credentialObject: must be an object.");
  }

  const { iv, tag, ciphertext } = encryptRecord(credentialObject);

  const db = await initCredentialVault();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO vault_entries (source_id, iv, auth_tag, ciphertext, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_id) DO UPDATE SET
       iv = excluded.iv,
       auth_tag = excluded.auth_tag,
       ciphertext = excluded.ciphertext,
       updated_at = excluded.updated_at`,
    [sourceId, iv, tag, ciphertext, now, now]
  );

  // Update memory cache
  memoryCache.set(sourceId, { ...credentialObject });
}

export function resolveCredential(sourceId) {
  if (!sourceId) return null;
  // Fast synchronous return from memory cache
  if (memoryCache.has(sourceId)) {
    return { ...memoryCache.get(sourceId) };
  }
  return null;
}

export async function resolveCredentialAsync(sourceId) {
  if (!sourceId) return null;
  if (memoryCache.has(sourceId)) {
    return { ...memoryCache.get(sourceId) };
  }

  const db = await initCredentialVault();
  const row = await db.get("SELECT iv, auth_tag, ciphertext FROM vault_entries WHERE source_id = ?", [sourceId]);
  if (!row) {
    return null;
  }

  const decrypted = decryptRecord(row.iv, row.auth_tag, row.ciphertext);
  memoryCache.set(sourceId, decrypted);
  return { ...decrypted };
}

export function hasCredential(sourceId) {
  if (!sourceId) return false;
  return memoryCache.has(sourceId);
}

export async function deleteCredential(sourceId) {
  if (!sourceId) return false;
  memoryCache.delete(sourceId);
  const db = await initCredentialVault();
  const res = await db.run("DELETE FROM vault_entries WHERE source_id = ?", [sourceId]);
  return (res.changes || 0) > 0;
}

export async function closeVault() {
  if (vaultDb) {
    try {
      await vaultDb.close();
    } catch {}
    vaultDb = null;
    initPromise = null;
    memoryCache.clear();
  }
}
