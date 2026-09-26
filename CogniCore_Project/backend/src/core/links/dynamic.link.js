import { runDynamicQuery } from "../dynamic.query.engine.js";
import { ANSWERED, PASS, BUG } from "../../kernel/handler-result.js";


export async function executeDynamicLink({ query, organization, role, sessionId, startTime, capabilities }) {
  const dialect = capabilities?.source?.dialect || "sqlite";

  try {
    console.log(`🔥 Attempting Dynamic Query Engine Link (${dialect})`);
    const dynamicResult = await runDynamicQuery(query, { capabilities });

    if (dynamicResult.success) {
      return ANSWERED({
        answer: dynamicResult.answer, 
        source: "dynamic",
        data: dynamicResult.data || {}, 
        meta: {
          sessionId,
          organization, 
          role, 
          engineMode: "dynamic_query", 
          intent: "dynamic_query", 
          source: dialect,
          sourceId: capabilities?.source?.id || "sqlite_default",
          processingMs: Date.now() - startTime
        }
      });
    }

    const code = dynamicResult.code || dynamicResult.data?.errorType || "dynamic_failed";
    return PASS(`${code}: ${dynamicResult.answer}`, {
      code,
      partialResult: dynamicResult
    });
    
  } catch (err) {
    console.error("🚨 [DYNAMIC ENGINE BUG] Unexpected error:", err);
    return BUG(`dynamic_bug:${err.message}`,err);
  }
}

