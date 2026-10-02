// ============================================================================
// AUTHENTICATION MIDDLEWARE (VULN-05 & VULN-06)
// JWT-based authentication and cryptographic identity provider.
// ============================================================================

import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, "../../.env");

dotenv.config({ path: ENV_PATH });

let jwtSecret = process.env.COGNICORE_JWT_SECRET;

export function getJwtSecret() {
  if (jwtSecret) return jwtSecret;

  if (process.env.COGNICORE_JWT_SECRET) {
    jwtSecret = process.env.COGNICORE_JWT_SECRET;
    return jwtSecret;
  }

  // Auto-generate on first boot if absent
  const newSecret = crypto.randomBytes(32).toString("hex");
  jwtSecret = newSecret;
  process.env.COGNICORE_JWT_SECRET = newSecret;

  try {
    const envLine = `\nCOGNICORE_JWT_SECRET=${newSecret}\n`;
    fs.appendFileSync(ENV_PATH, envLine, "utf8");
    console.log("🔐 [Auth] Generated new JWT secret and saved to backend/.env");
  } catch (err) {
    console.warn("⚠️ [Auth] Could not persist generated JWT secret to .env:", err.message);
  }

  return jwtSecret;
}

export function generateToken(payload, expiresIn = "8h") {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

export function authenticate(requiredRole = null) {
  return (req, res, next) => {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];

    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "authentication_required",
        message: "Authorization: Bearer <token> is required."
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        error: "authentication_required",
        message: "Bearer token missing."
      });
    }

    try {
      const decoded = verifyToken(token);
      const roles = Array.isArray(decoded.roles)
        ? decoded.roles
        : (decoded.role ? [decoded.role] : []);

      req.user = {
        id: decoded.id,
        userId: String(decoded.userId || decoded.id || "anonymous"),
        role: decoded.role || roles[0] || "user",
        employeeId: decoded.employeeId ? String(decoded.employeeId) : null,
        roles,
        company: decoded.company || null,
        identitySource: "jwt",
        ...decoded
      };

      if (requiredRole) {
        const hasRole = roles.includes(requiredRole) || roles.includes("admin");
        if (!hasRole) {
          return res.status(403).json({
            error: "insufficient_role",
            message: `Requires role: '${requiredRole}'. Current roles: [${roles.join(", ")}]`
          });
        }
      }

      return next();
    } catch (err) {
      return res.status(401).json({
        error: "authentication_required",
        message: "Invalid or expired authorization token: " + err.message
      });
    }
  };
}
