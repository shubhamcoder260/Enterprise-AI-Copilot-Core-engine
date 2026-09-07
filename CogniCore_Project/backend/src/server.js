import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import aiRoutes from "./routes/ai.routes.js";
import databaseRoutes from "./routes/database.routes.js";

dotenv.config();

const app = express();

app.use(cors());
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

// AI Query & LLM Routes
app.use("/api/ai", aiRoutes);
app.use("/api/llm", aiRoutes);
app.use("/api", aiRoutes);

// Database Upload Routes
app.use("/api/database", databaseRoutes);

// Global Error Handler Middleware (ensures JSON response on unexpected errors)
app.use((err, req, res, next) => {
  console.error("❌ Express unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(
    `CogniCore backend running at http://localhost:${PORT}`
  )
);