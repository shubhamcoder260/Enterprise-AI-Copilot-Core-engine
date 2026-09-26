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

      const sql = dynamicResult.data?.sql || "";
      const isRlsScoped =
        identity?.employeeId &&
        (sql.includes(`\`employee\` = '${identity.employeeId}'`) ||
         sql.includes(`"employee" = '${identity.employeeId}'`));

      let answer = dynamicResult.answer;
      if (isRlsScoped) {
        const salaryVal = records?.[0]?.gross_pay || records?.[0]?.net_pay || (records?.[0] ? Object.values(records[0])[0] : null);
        const formattedSalary = salaryVal ? `$${Number(salaryVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : answer;
        answer = `You asked about company-wide salaries, but I can only show you your own salary record: ${formattedSalary}.`;
      }

      if (!vResult.verified && vResult.honestNotice) {
        answer = `${answer}\n\n${vResult.honestNotice}`;
      }

      const res = ANSWERED({
        answer, 
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
          rlsScoped: Boolean(isRlsScoped),
          verification: vResult,
          processingMs: Date.now() - startTime
        }
      });
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

