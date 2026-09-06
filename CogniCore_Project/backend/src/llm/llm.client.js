// ==========================================
// LOCAL LLM CLIENT (OLLAMA ADAPTER)
// Communicates with local Ollama API at /api/generate
// ==========================================

import "dotenv/config";
import { performance } from "perf_hooks";

let thinkSupported = true;

/**
 * Sends a generation request to the local Ollama API.
 *
 * @param {object} params
 * @param {string} params.prompt - Fully constructed prompt
 * @param {string} [params.model] - Optional model override
 * @returns {Promise<{ success: boolean, sql: string|null, errorType: string|null, durationMs: number, model: string }>}
 */
export async function generateSql({ prompt, model }) {
  const baseUrl = process.env.LOCAL_LLM_URL || "http://localhost:11434";
  const defaultModel = process.env.LOCAL_LLM_MODEL || "gemma3:4b";
  const resolvedModel = (model && String(model).trim()) || defaultModel;
  const timeoutMs = parseInt(process.env.LOCAL_LLM_TIMEOUT_MS, 10) || 15000;
  const keepAlive = process.env.LOCAL_LLM_KEEP_ALIVE || "30m";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = performance.now();

  const makeBody = (includeThink) => {
    const b = {
      model: resolvedModel,
      prompt,
      stream: false,
      keep_alive: keepAlive,
      options: {
        temperature: 0.1,
        num_predict: 300,
        num_ctx: 8192
      }
    };
    if (includeThink) {
      b.think = false;
    }
    return b;
  };

  try {
    let res;
    try {
      res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(thinkSupported)),
        signal: controller.signal
      });

      // Version fallback: if 400 and think was included, retry once without think
      if (res.status === 400 && thinkSupported) {
        console.log("ℹ️ [LLM Client] Ollama returned 400 with think field, retrying without think parameter.");
        thinkSupported = false;
        res = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeBody(false)),
          signal: controller.signal
        });
      }
    } catch (networkErr) {
      const durationMs = parseFloat((performance.now() - startTime).toFixed(2));
      clearTimeout(timer);

      if (networkErr.name === "AbortError") {
        console.log(`⏱️ [LLM Client] Call aborted after ${durationMs} ms (timeout: ${timeoutMs} ms)`);
        return {
          success: false,
          sql: null,
          errorType: "llm_timeout",
          durationMs,
          model: resolvedModel
        };
      }

      console.log(`⏱️ [LLM Client] Connection error after ${durationMs} ms: ${networkErr.message}`);
      return {
        success: false,
        sql: null,
        errorType: "llm_offline",
        durationMs,
        model: resolvedModel
      };
    }

    clearTimeout(timer);
    const durationMs = parseFloat((performance.now() - startTime).toFixed(2));

    if (res.status === 404) {
      console.log(`⏱️ [LLM Client] Model not found (404) after ${durationMs} ms: ${resolvedModel}`);
      return {
        success: false,
        sql: null,
        errorType: "llm_model_not_found",
        durationMs,
        model: resolvedModel
      };
    }

    if (!res.ok) {
      console.log(`⏱️ [LLM Client] HTTP ${res.status} after ${durationMs} ms`);
      return {
        success: false,
        sql: null,
        errorType: "llm_bad_output",
        durationMs,
        model: resolvedModel
      };
    }

    let data;
    try {
      data = await res.json();
    } catch {
      return {
        success: false,
        sql: null,
        errorType: "llm_bad_output",
        durationMs,
        model: resolvedModel
      };
    }

    const rawResponse = data?.response;
    if (typeof rawResponse !== "string" || !rawResponse.trim()) {
      return {
        success: false,
        sql: null,
        errorType: "llm_bad_output",
        durationMs,
        model: resolvedModel
      };
    }

    const cleanSql = cleanLlmSql(rawResponse);

    console.log(`⏱️ [LLM Client] Completed in ${durationMs} ms (model: ${resolvedModel})`);
    return {
      success: true,
      sql: cleanSql,
      errorType: null,
      durationMs,
      model: resolvedModel
    };

  } catch (unexpectedErr) {
    clearTimeout(timer);
    const durationMs = parseFloat((performance.now() - startTime).toFixed(2));
    console.error(`🚨 [LLM Client] Unexpected error after ${durationMs} ms:`, unexpectedErr);
    return {
      success: false,
      sql: null,
      errorType: "llm_bad_output",
      durationMs,
      model: resolvedModel
    };
  }
}

/**
 * Defensively strips <think> blocks, reasoning tags, and markdown code fences.
 *
 * @param {string} rawResponse
 * @returns {string}
 */
export function cleanLlmSql(rawResponse) {
  if (typeof rawResponse !== "string") return "";
  let cleanSql = rawResponse.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (cleanSql.includes("```")) {
    const fenceMatch = cleanSql.match(/```(?:sqlite|sql)?\s*([\s\S]*?)(?:```|$)/i);
    if (fenceMatch && fenceMatch[1] !== undefined) {
      cleanSql = fenceMatch[1].trim();
    } else {
      cleanSql = cleanSql.replace(/```[a-zA-Z]*/g, "").replace(/```/g, "").trim();
    }
  }
  // Also strip any trailing semicolon
  cleanSql = cleanSql.replace(/;+\s*$/, "").trim();
  return cleanSql;
}

