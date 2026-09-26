// ============================================================================
// ACTION ROUTES (PHASE D5 ACTION GATEWAY)
// Express router for proposal, approval, rejection, and audit log endpoints.
// ============================================================================

import express from "express";
import {
  proposeAction,
  approveAction,
  rejectAction,
  listActionTemplates,
  getActionAuditLog
} from "../controllers/action.controller.js";

const router = express.Router();

router.get("/templates", listActionTemplates);
router.get("/audit", getActionAuditLog);
router.post("/propose", proposeAction);
router.post("/:id/approve", approveAction);
router.post("/:id/reject", rejectAction);

export default router;
