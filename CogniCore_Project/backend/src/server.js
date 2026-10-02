import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import crypto from "crypto";
import aiRoutes from "./routes/ai.routes.js";
import databaseRoutes from "./routes/database.routes.js";
import actionRoutes from "./routes/action.routes.js";
import sourceRoutes from "./routes/source.routes.js";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();

const app = express();

const allowedOrigins = process.env.COGNICORE_ALLOWED_ORIGINS
  ? process.env.COGNICORE_ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json());

app.get("/", (req, res) =>
  res.json({
    message: "CogniCore AI Engine is running!",
    status: "success"
  })
);

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "CogniCore AI Engine"
  })
);

// Authentication Routes (VULN-05)
app.use("/api/auth", authRoutes);

// AI Query & LLM Routes
app.use("/api/ai", aiRoutes);
app.use("/api/llm", aiRoutes);
app.use("/api", aiRoutes);

// Database Upload Routes
app.use("/api/database", databaseRoutes);

// Action Gateway Routes (Phase D5 Write Pipeline)
app.use("/api/actions", actionRoutes);

// Sources & Connection Management Routes (Phase D6)
app.use("/api/sources", sourceRoutes);

// Global Error Handler Middleware (ensures JSON response on unexpected errors with requestId)
app.use((err, req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  console.error(`❌ [${requestId}] Express unhandled error:`, err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? "internal_server_error" : (err.code || "request_failed"),
    requestId,
    message: status === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : (err.message || "Internal server error")
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(
    `CogniCore backend running at http://localhost:${PORT}`
  )
);