import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  demoLogin,
  loginWithCredentials,
  getStudentDashboard,
  getFacultyCourses,
  getCourseRoster,
  parseVoiceMarks,
  submitMarks,
  getCourseAtRisk,
  getAdminHeatmap,
  getDebarmentForecastHandler,
  getBacktestHandler,
  verifyAuditLogHandler,
  getOutboxHandler,
  simulateRecoveryHandler
} from "../controllers/academic.controller.js";

const router = express.Router();

// Authentication Endpoints (Credentials & Quick Demo)
router.post("/auth/demo-login", demoLogin);
router.post("/auth/login", loginWithCredentials);

// Student Endpoints (Protected: Student or Admin)
router.get("/student/dashboard", authenticate("student"), getStudentDashboard);
router.post("/student/recovery-simulate", authenticate("student", "faculty", "admin"), simulateRecoveryHandler);

// Faculty Endpoints (Protected: Faculty or Admin)
router.get("/faculty/courses", authenticate("faculty"), getFacultyCourses);
router.get("/faculty/course/:offeringId/roster", authenticate("faculty"), getCourseRoster);
router.post("/faculty/parse-voice-marks", authenticate("faculty"), parseVoiceMarks);
router.post("/faculty/submit-marks", authenticate("faculty"), submitMarks);
router.get("/faculty/course/:offeringId/at-risk", authenticate("faculty"), getCourseAtRisk);

// Admin & Institutional Analytics Endpoints (Protected: Admin)
router.get("/admin/heatmap", authenticate("admin"), getAdminHeatmap);
router.get("/admin/debarment-forecast", authenticate("admin"), getDebarmentForecastHandler);
router.get("/admin/audit-verify", authenticate("admin"), verifyAuditLogHandler);

// Cross-Role Institutional Intelligence (Protected)
router.get("/analytics/backtest", authenticate("student", "faculty", "admin"), getBacktestHandler);
router.get("/outbox", authenticate("student", "faculty", "admin"), getOutboxHandler);

export default router;
