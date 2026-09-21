import crypto from "crypto";
import { runCoreEngine } from "../core/core.engine.js";
import { recordExchange, getFullHistory } from "../store/history.store.js";
import { formatFor } from "../kernel/formatter.registry.js";

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

    // Step 3: Wire polymorphic presentation format (B1)
    // Fail-safe: format failure NEVER breaks an answer. Try/catch at wiring point.
    const finalResponse = selectFormat(result, req.body?.format);

    // Returns standard { answer, source, data, meta, [format] }
    res.json(finalResponse);
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
        models: [defaultModel]
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
      models: [defaultModel]
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

/**
 * Selects and attaches a presentation format to the standard contract envelope.
 *
 * PRIME INVARIANT: formatters are presentation only. They NEVER alter data/meta/answer/source.
 * FAIL-SAFE: Any error or unsupported shape returns the contract unchanged without a format field.
 *
 * @param {object} contract - Standard { answer, source, data, meta }
 * @param {string} [hint] - Optional user/client format hint (e.g. "csv")
 * @returns {object} { answer, source, data, meta, [format] }
 */
export function selectFormat(contract, hint) {
  if (!contract || typeof contract !== "object") return contract;

  try {
    const data = contract.data;
    if (!data || typeof data !== "object") return contract;

    let formatObj = null;

    // Hint handling (only "csv" supported currently)
    if (typeof hint === "string" && hint.toLowerCase() === "csv") {
      if (Array.isArray(data.records) && data.records.length > 0) {
        // Table data available -> derive columns and rows
        const tableShape = formatFor("table", { records: data.records });
        if (tableShape && Array.isArray(tableShape.columns) && Array.isArray(tableShape.rows)) {
          formatObj = formatFor("csv", { columns: tableShape.columns, rows: tableShape.rows });
        }
      }
    }

    // Auto selection if no hint matched
    if (!formatObj) {
      if (Array.isArray(data.records) && data.records.length > 0) {
        // If it is a single-row single-numeric result, check if it is a pure scalar result
        if (data.records.length === 1 && typeof data.value === "number" && !Number.isNaN(data.value)) {
          formatObj = formatFor("kpi", { label: data.column || null, value: data.value });
        } else if (data.records.length === 1 && typeof data.records[0] === "object") {
          const keys = Object.keys(data.records[0]);
          const firstVal = data.records[0][keys[0]];
          if (keys.length === 1 && typeof firstVal === "number" && !Number.isNaN(firstVal)) {
            formatObj = formatFor("kpi", { label: keys[0], value: firstVal });
          } else {
            formatObj = formatFor("table", { records: data.records });
          }
        } else {
          formatObj = formatFor("table", { records: data.records });
        }
      } else if (typeof data.value === "number" && !Number.isNaN(data.value)) {
        formatObj = formatFor("kpi", { label: data.column || null, value: data.value });
      } else if (Array.isArray(data.records)) {
        formatObj = formatFor("table", { records: data.records });
      }
    }

    if (formatObj && typeof formatObj === "object") {
      return {
        ...contract,
        format: formatObj
      };
    }

    return contract;
  } catch (err) {
    console.warn("⚠️ [Format Registry] Fail-safe format failure:", err.message);
    return contract;
  }
}


