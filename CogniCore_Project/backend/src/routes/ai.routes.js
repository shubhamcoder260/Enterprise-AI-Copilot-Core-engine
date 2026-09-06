import { Router } from "express";
import { handleQuery, getAvailableModels, getSessionHistory } from "../controllers/ai.controller.js";

const router = Router();
router.post("/query", handleQuery);
router.get("/llm/models", getAvailableModels);
router.get("/models", getAvailableModels);
router.get("/history/:sessionId", getSessionHistory);

export default router;


