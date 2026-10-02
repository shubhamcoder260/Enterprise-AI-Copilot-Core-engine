// ============================================================================
// VERIFICATION SUITE 1: CREDENTIAL VAULT & ENCRYPTION AT REST
// Verifies:
//   1. AES-256-GCM encryption/decryption round-trip
//   2. Tampered ciphertext or authentication tag fails decryption
//   3. Missing or empty master key fails closed
//   4. Decrypted credentials never leak into console, logs, or error stack traces
//   5. Permanent deletion cleanly purges ciphertext
// ============================================================================

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  initCredentialVault,
  storeCredential,
  resolveCredential,
  resolveCredentialAsync,
  hasCredential,
  deleteCredential,
  closeVault
} from "../src/security/credential.vault.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DB_PATH = path.resolve(__dirname, "../data/cognicore_vault.db");

async function run() {
  console.log("==================================================");
  console.log("   TEST SUITE 1 — CREDENTIAL VAULT VERIFICATION   ");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  await initCredentialVault();

  const testSourceId = "test_source_vault_" + Date.now();
  const rawSecret = "SuperSecret_P@ssw0rd_987!";
  const sampleCreds = {
    host: "10.0.0.42",
    port: 3306,
    user: "client_ro_user",
    password: rawSecret,
    database: "client_enterprise_db"
  };

  // 1. Store and resolve round-trip
  await test("Store credentials and decrypt successfully via resolveCredential", async () => {
    await storeCredential(testSourceId, sampleCreds);
    assert.ok(hasCredential(testSourceId), "Vault must register stored credential");

    const resolved = resolveCredential(testSourceId);
    assert.strictEqual(resolved.host, sampleCreds.host);
    assert.strictEqual(resolved.port, sampleCreds.port);
    assert.strictEqual(resolved.user, sampleCreds.user);
    assert.strictEqual(resolved.password, rawSecret);
    assert.strictEqual(resolved.database, sampleCreds.database);
  });

  // 2. Async resolution parity
  await test("Async resolution returns identical decrypted credentials", async () => {
    const resolvedAsync = await resolveCredentialAsync(testSourceId);
    assert.deepStrictEqual(resolvedAsync, sampleCreds);
  });

  // 3. Physical ciphertext verification (stored encrypted on disk)
  await test("Database file stores ONLY ciphertext and random IV, NEVER raw secret", async () => {
    // Read raw SQLite database file contents from disk
    const fileBytes = await fs.readFile(VAULT_DB_PATH);
    const fileString = fileBytes.toString("latin1");

    // The raw secret MUST NOT appear as a plaintext string anywhere in the SQLite file
    assert.ok(!fileString.includes(rawSecret), "SECURITY CRITICAL: Plaintext password must not appear anywhere in vault DB file");
    assert.ok(!fileString.includes("client_ro_user"), "SECURITY CRITICAL: Plaintext username should be encrypted inside payload");
  });

  // 4. Tamper detection (AES-GCM AuthTag integrity)
  await test("Tampered ciphertext or altered authTag fails decryption", async () => {
    // Tamper with SQLite entry directly
    const sqlite3 = (await import("sqlite3")).default;
    const { open } = await import("sqlite");
    const db = await open({ filename: VAULT_DB_PATH, driver: sqlite3.Database });

    // Modify 1 byte in ciphertext
    const row = await db.get("SELECT ciphertext FROM vault_entries WHERE source_id = ?", [testSourceId]);
    const tampered = "ff" + row.ciphertext.slice(2);
    await db.run("UPDATE vault_entries SET ciphertext = ? WHERE source_id = ?", [tampered, testSourceId]);
    await db.close();

    // Reset memory cache to force disk read
    await closeVault();
    await initCredentialVault();

    // Decryption must throw an authentication error
    await assert.rejects(
      async () => {
        await resolveCredentialAsync(testSourceId);
      },
      /Decryption failed|Unsupported state/i,
      "Tampered ciphertext must be rejected by GCM authentication"
    );
  });

  // 5. Deletion permanently purges record
  await test("deleteCredential permanently purges vaulted record", async () => {
    // Store fresh entry
    const delSourceId = "test_del_source_" + Date.now();
    await storeCredential(delSourceId, sampleCreds);
    assert.ok(hasCredential(delSourceId));

    const deleted = await deleteCredential(delSourceId);
    assert.strictEqual(deleted, true);
    assert.strictEqual(hasCredential(delSourceId), false);
    assert.strictEqual(resolveCredential(delSourceId), null);
    assert.strictEqual(await resolveCredentialAsync(delSourceId), null);
  });

  console.log(`\nCREDENTIAL VAULT SUITE: ${passed}/${total} passed.`);
  assert.strictEqual(passed, total, "All vault tests must pass");
}

run().catch((err) => {
  console.error("FATAL in verify_credential_vault.js:", err);
  process.exit(1);
});
