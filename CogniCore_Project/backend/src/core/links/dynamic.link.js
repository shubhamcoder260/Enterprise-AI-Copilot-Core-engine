import { runDynamicQuery } from "../dynamic.query.engine.js";
import { ANSWERED, PASS, BUG } from "../../kernel/handler-result.js";
import { runVerificationChain } from "../../kernel/verify.chain.js";

export async function executeDynamicLink({ query, organization, role, sessionId, startTime, capabilities, identity }) {
  const dialect = capabilities?.source?.dialect || "sqlite";

  try {
    console.log(`🔥 Attempting Dynamic Query Engine Link (${dialect})`);
    const dynamicResult = await runDynamicQuery(query, { capabilities, identity });

    if (dynamicResult.rlsBlocked || dynamicResult.code?.startsWith("rls_") || dynamicResult.code?.startsWith("ast_rls_")) {
      console.log(`🛡️ [Dynamic Link RLS Block] Halting cascade: ${dynamicResult.code}`);
      return ANSWERED({
        answer: dynamicResult.answer || "Access to salary records of other employees is restricted by enterprise policy.",
        source: "rls_gate",
        data: { error: dynamicResult.code, sql: null },
        meta: {
          sessionId,
          organization,
          role,
          rlsBlocked: true,
          sqlExecuted: false,
          processingMs: Date.now() - startTime
        }
      });
    }

    if (dynamicResult.success) {
      const records = dynamicResult.data?.records || dynamicResult.data?.rows || [];
      const vResult = runVerificationChain({
        answer: dynamicResult.answer,
        records,
        query
      });

      const res = ANSWERED({
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
          verification: vResult,
          processingMs: Date.now() - startTime
        }
      });
      if (!vResult.verified && vResult.honestNotice) {
        res.payload.answer = `${res.payload.answer}\n\n${vResult.honestNotice}`;
      }
      return res;
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

