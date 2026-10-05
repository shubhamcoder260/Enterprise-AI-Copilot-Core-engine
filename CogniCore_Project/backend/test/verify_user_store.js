// ============================================================
// VERIFICATION: USER CREATION & AUTH STORE (V3)
// Verifies:
// 1. Enumeration of users from AES-256-GCM encrypted store
// 2. Programmatic user creation and persistence to users.enc
// 3. PBKDF2 hash verification and multi-user login capability
// ============================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert";
import { fileURLToPath } from "url";
import { getJwtSecret } from "../src/middleware/auth.js";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, "../.env");
dotenv.config({ path: ENV_PATH });

const DATA_DIR = path.resolve(__dirname, "../data");
const USERS_ENC_PATH = path.resolve(DATA_DIR, "users.enc");

function getEncryptionKey() {
  const rawKey = process.env.VAULT_MASTER_KEY || getJwtSecret();
  return crypto.createHash("sha256").update(String(rawKey)).digest();
}

function encryptUsers(users) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const jsonStr = JSON.stringify(users);
  let encrypted = cipher.update(jsonStr, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decryptUsers(buffer) {
  const key = getEncryptionKey();
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, null, "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

console.log("==================================================");
console.log("  V3 — USER STORE & CREATION FLOW VERIFICATION    ");
console.log("==================================================");

// 1. List users currently in store
assert.ok(fs.existsSync(USERS_ENC_PATH), "users.enc must exist");
const rawBuf = fs.readFileSync(USERS_ENC_PATH);
const users = decryptUsers(rawBuf);

const initialUsernames = Object.keys(users);
console.log("\n[1] Users currently in encrypted store (usernames only):");
console.log(initialUsernames);
assert.ok(initialUsernames.length >= 2, "Must contain at least 2 seeded accounts");
assert.ok(initialUsernames.includes("admin"), "Must contain admin");
assert.ok(initialUsernames.includes("devon"), "Must contain devon");

// 2. Create second/new user dynamically in the encrypted store
console.log("\n[2] Testing dynamic user creation in encrypted store...");
const testUsername = "audit_user";
const testPassword = "AuditSecurePassword2026!";
const testSalt = crypto.randomBytes(16).toString("hex");
const testHash = hashPassword(testPassword, testSalt);

users[testUsername] = {
  userId: testUsername,
  employeeId: "EMP-AUDIT-99",
  salt: testSalt,
  passwordHash: testHash,
  roles: ["Auditor", "Sales User"]
};

// Persist encrypted users back to users.enc
fs.writeFileSync(USERS_ENC_PATH, encryptUsers(users));
console.log(`Saved new user '${testUsername}' to encrypted store.`);

// Re-read and confirm decryption
const reReadBuf = fs.readFileSync(USERS_ENC_PATH);
const updatedUsers = decryptUsers(reReadBuf);
assert.ok(updatedUsers[testUsername], "Newly created user must exist in decrypted store");
assert.strictEqual(updatedUsers[testUsername].employeeId, "EMP-AUDIT-99");
console.log("✅ Verified newly created user was decrypted successfully from disk.");

// 3. Verify password validation for created user
const verifyHash = hashPassword(testPassword, updatedUsers[testUsername].salt);
assert.strictEqual(verifyHash, updatedUsers[testUsername].passwordHash, "PBKDF2 hash verification must succeed");
console.log("✅ Verified PBKDF2 hash matches for the new user.");

// 4. Cleanup test user from store
delete users[testUsername];
fs.writeFileSync(USERS_ENC_PATH, encryptUsers(users));
console.log(`Cleaned up '${testUsername}' from encrypted store.`);

const cleanedBuf = fs.readFileSync(USERS_ENC_PATH);
const cleanedUsers = decryptUsers(cleanedBuf);
assert.strictEqual(cleanedUsers[testUsername], undefined, "Test user must be cleaned up");
console.log("✅ Store restored to original clean state.");

console.log("\n==================================================");
console.log("🏆 V3 USER CREATION FLOW VERIFICATION PASSED");
console.log("==================================================");
