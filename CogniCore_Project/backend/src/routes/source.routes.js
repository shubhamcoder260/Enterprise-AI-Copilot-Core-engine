// ============================================================
// SOURCE ROUTER (PART 5)
// Routes for Connection Wizard, Source CRUD, and Testing.
// ============================================================

import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  handleTestSource,
  handleGenerateScript,
  handleAutoProvision,
  handleCreateSource,
  handleListSources,
  handleGetSource,
  handleRetestSource,
  handleDeleteSource
} from "../controllers/source.controller.js";

const router = express.Router();
router.use(authenticate());

// Pre-flight test connection (Part 2)
router.post("/test", handleTestSource);

// DBA script generator (Part 3)
router.post("/generate-grant-script", handleGenerateScript);

// Optional auto-provisioning (Part 4)
router.post("/auto-provision", authenticate("admin"), handleAutoProvision);

// Source CRUD (Part 5)
router.post("/", handleCreateSource);
router.get("/", handleListSources);
router.get("/:id", handleGetSource);
router.post("/:id/test", handleRetestSource);
router.delete("/:id", authenticate("admin"), handleDeleteSource);

export default router;
