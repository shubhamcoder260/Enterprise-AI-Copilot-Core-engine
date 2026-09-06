import crypto from "crypto";
import { runCoreEngine } from "../core/core.engine.js";
import { recordExchange, getFullHistory } from "../store/history.store.js";

export async function handleQuery(req, res) {
  const startTime = Date.now();
  const sessionId =
    (req.body && req.body.sessionId && String(req.body.sessionId).trim()) ||
    (req.headers["x-session-id"] && String(req.headers["x-session-id"]).trim()) ||
    crypto.randomUUID();

  const organization = req.body?.organization || "college";
  const role = req.body?.role || "admin";
  const model = req.body?.model;

  try {
    const { query } = req.body || {};

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        answer: "Please provide a valid query.",
        source: "error",
        data: { error: "empty_query" },
        meta: {
          sessionId,
          organization,
          role,
          engineMode: "error",
          processingMs: Date.now() - startTime
        }
      });
    }

    const result = await runCoreEngine({ query, organization, role, sessionId, model });

    // Step 2: Record exchange in persistent history store (fail-safe)
    try {
      await recordExchange({
        sessionId,
        question: query,
        answer: result.answer,
        source: result.source,
        sql: result.data?.sql || null,
        model: result.meta?.model || null
      });
    } catch (histErr) {
      console.warn("⚠️ [History] Error recording exchange:", histErr.message);
    }

    // Returns standard { answer, source, data, meta }
    res.json(result);
  } catch (error) {
    console.error("AI Controller Error:", error);
    res.status(500).json({
      answer: `An error occurred while processing your query: ${error.message}`,
      source: "error",
      data: { error: error.message },
      meta: {
        sessionId,
        organization,
        role,
        engineMode: "error",
        processingMs: Date.now() - startTime
      }
    });
  }
}

export async function getAvailableModels(req, res) {
  const baseUrl = process.env.LOCAL_LLM_URL || "http://localhost:11434";
  const defaultModel = process.env.LOCAL_LLM_MODEL || "gemma3:4b";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      return res.json({
        available: false,
        current: defaultModel,
        models: []
      });
    }

    const data = await response.json();
    let modelNames = Array.isArray(data?.models)
      ? data.models
          .filter((m) => !Array.isArray(m.capabilities) || m.capabilities.includes("completion"))
          .map((m) => m.name)
          .filter(Boolean)
      : [];

    if (!modelNames.includes(defaultModel)) {
      modelNames.unshift(defaultModel);
    }

    return res.json({
      available: true,
      current: defaultModel,
      models: modelNames
    });
  } catch {
    clearTimeout(timer);
    return res.json({
      available: false,
      current: defaultModel,
      models: []
    });
  }
}

export async function getSessionHistory(req, res) {
  const sessionId = req.params?.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId parameter" });
  }

  try {
    const exchanges = await getFullHistory(sessionId, 100);
    return res.status(200).json({
      success: true,
      sessionId,
      count: exchanges.length,
      exchanges,
      history: exchanges
    });
  } catch (err) {
    console.warn("⚠️ [History] Error fetching session history:", err.message);
    return res.status(200).json({
      success: false,
      sessionId,
      count: 0,
      exchanges: [],
      history: []
    });
  }
}


