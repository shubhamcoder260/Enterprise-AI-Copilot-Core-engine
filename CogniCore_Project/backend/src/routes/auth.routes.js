// ============================================================================
// AUTHENTICATION ROUTES (VULN-05)
// Endpoint for user login with encrypted local user store and rate limiting.
// ============================================================================

import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateToken, getJwtSecret } from "../middleware/auth.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const USERS_ENC_PATH = path.resolve(DATA_DIR, "users.enc");

// ─── Rate Limiter (5 attempts per minute per IP) ───
const loginAttempts = new Map();

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count++;
  return true;
}

// ─── AES-256-GCM User Store ───
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

function initUsersStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_ENC_PATH)) {
    const adminSalt = crypto.randomBytes(16).toString("hex");
    const devonSalt = crypto.randomBytes(16).toString("hex");
    const victoriaSalt = crypto.randomBytes(16).toString("hex");
    const marcusSalt = crypto.randomBytes(16).toString("hex");

    const users = {
      admin: {
        userId: "admin",
        employeeId: "EMP-ADMIN",
        salt: adminSalt,
        passwordHash: hashPassword("admin123", adminSalt),
        roles: ["admin", "Sales Manager", "Sales User"]
      },
      devon: {
        userId: "devon",
        employeeId: "EMP-002",
        salt: devonSalt,
        passwordHash: hashPassword("password123", devonSalt),
        roles: ["employee", "Employee"]
      },
      marcus: {
        userId: "marcus",
        employeeId: "EMP-003",
        salt: marcusSalt,
        passwordHash: hashPassword("password123", marcusSalt),
        roles: ["Sales Manager", "Sales User"]
      },
      victoria: {
        userId: "victoria",
        employeeId: "EMP-001",
        salt: victoriaSalt,
        passwordHash: hashPassword("password123", victoriaSalt),
        roles: ["admin", "Executive", "HR Manager", "Sales Manager"]
      }
    };

    const enc = encryptUsers(users);
    fs.writeFileSync(USERS_ENC_PATH, enc);
    console.log("👤 [Auth] Initialized encrypted user store (backend/data/users.enc) with default admin/demo accounts.");
  }
}

function loadUsers() {
  initUsersStore();
  const buf = fs.readFileSync(USERS_ENC_PATH);
  return decryptUsers(buf);
}

// Initialize on boot
try {
  initUsersStore();
} catch (err) {
  console.warn("⚠️ [Auth] Error initializing users store:", err.message);
}

router.post("/login", (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
  if (!checkLoginRateLimit(clientIp)) {
    return res.status(429).json({
      error: "too_many_requests",
      message: "Rate limit exceeded: maximum 5 login attempts per minute."
    });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({
      error: "invalid_request",
      message: "Both username and password are required."
    });
  }

  try {
    const users = loadUsers();
    const user = users[String(username).trim().toLowerCase()];

    if (!user) {
      return res.status(401).json({
        error: "invalid_credentials",
        message: "Invalid username or password."
      });
    }

    const computedHash = hashPassword(String(password), user.salt);
    if (!crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(user.passwordHash, "hex"))) {
      return res.status(401).json({
        error: "invalid_credentials",
        message: "Invalid username or password."
      });
    }

    const token = generateToken({
      userId: user.userId,
      employeeId: user.employeeId,
      roles: user.roles
    }, "8h");

    return res.status(200).json({
      success: true,
      token,
      expiresIn: "8h",
      user: {
        userId: user.userId,
        employeeId: user.employeeId,
        roles: user.roles
      }
    });
  } catch (err) {
    return res.status(500).json({
      error: "auth_store_error",
      message: "Failed to authenticate against user store: " + err.message
    });
  }
});

export default router;
