import express from "express";
import {
  demoLogin,
  getStudentDashboard,
  getFacultyCourses,
  getCourseRoster,
  parseVoiceMarks,
  submitMarks,
  getCourseAtRisk,
  getAdminHeatmap
} from "../controllers/academic.controller.js";

const router = express.Router();

// 1-Click Demo Login
router.post("/auth/demo-login", demoLogin);

// Student Endpoints
router.get("/student/dashboard", getStudentDashboard);

// Faculty Endpoints
router.get("/faculty/courses", getFacultyCourses);
router.get("/faculty/course/:offeringId/roster", getCourseRoster);
router.post("/faculty/parse-voice-marks", parseVoiceMarks);
router.post("/faculty/submit-marks", submitMarks);
router.get("/faculty/course/:offeringId/at-risk", getCourseAtRisk);

// Admin Endpoints
router.get("/admin/heatmap", getAdminHeatmap);

export default router;
