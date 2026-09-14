import { readDatabaseSchema } from "../schema.reader.js";
import { buildSqlPrompt } from "../../llm/sql.prompt.js"; 
import { generateSql } from "../../llm/llm.client.js"; 
import { executeReadOnlySql } from "../../config/database.js"; 
import { formatLlmResponse } from "../../llm/llm.formatter.js"; 
import { getRecentExchanges } from "../../store/history.store.js"; 
import { PASS, BUG, ANSWERED } from "../../kernel/handler-result.js";

 export async function executeLlmLink({ query, organization, role, sessionId, model, startTime }) {
   const isLlmEnabled = process.env.ENABLE_LOCAL_LLM !== "false";
 
   if (!isLlmEnabled) {
     return PASS("llm_not_configured");
   }
 
   try {
     console.log("🤖 Attempting Local LLM Link");
 
     // 1. Cached schema read (zero PRAGMA calls)
     const schema = await readDatabaseSchema();
 
     // 1b. Retrieve recent history for context resolution (up to 3 turns)
     const history = sessionId ? await getRecentExchanges(sessionId, 3) : [];
 
     // 2. Build prompt
     const prompt = buildSqlPrompt({ query, schema, history });
 
     // 3. Client generation with optional requestedModel
     const clientResult = await generateSql({ prompt, model });
 
     if (!clientResult.success) {
       console.log(`ℹ️ [LLM Cascade] Generation failed: ${clientResult.errorType}`);
       return PASS(clientResult.errorType);
     }
 
     // 4. Validator security gate
     const validation = validateAndSanitizeSql(clientResult.sql);
 
     if (!validation.valid) {
       console.log(`ℹ️ [LLM Cascade] Validation failed: ${validation.reason}`);
       return PASS(validation.reason);
     }
 
     console.log("📝 [LLM Link] Validated SQL:", validation.sql);
 
     // 5. Read-only physical execution
     let rows;
     let finalSql = validation.sql;
     try {
       rows = await executeReadOnlySql(finalSql);
     } catch (dbErr) {
       console.log(`ℹ️ [LLM Cascade] SQL execution error: ${dbErr.message}`);
       return PASS("llm_execution_error");
     }
 
     // 5b. Case-sensitivity recovery:
     // SQLite string equality is case-sensitive by default ('Submitted' != 'submitted').
     // If the query returned 0 records or count(*) = 0, retry with COLLATE NOCASE for string literals.
     const isZeroCount =
       Array.isArray(rows) &&
       rows.length === 1 &&
       Object.keys(rows[0]).length === 1 &&
       /count/i.test(Object.keys(rows[0])[0]) &&
       (rows[0][Object.keys(rows[0])[0]] === 0 || rows[0][Object.keys(rows[0])[0]] === "0");
 
     const isZeroResults = !Array.isArray(rows) || rows.length === 0 || isZeroCount;
 
     if (isZeroResults) {
       const enhancedSql = finalSql.replace(
         /((?:=|\!=|<>)\s*'(?:''|[^'])*')(?!\s+COLLATE\b)/gi,
         "$1 COLLATE NOCASE"
       );
 
       if (enhancedSql !== finalSql) {
         try {
           const recoveryRows = await executeReadOnlySql(enhancedSql);
           const recoveryZeroCount =
             Array.isArray(recoveryRows) &&
             recoveryRows.length === 1 &&
             Object.keys(recoveryRows[0]).length === 1 &&
             /count/i.test(Object.keys(recoveryRows[0])[0]) &&
             (recoveryRows[0][Object.keys(recoveryRows[0])[0]] === 0 || recoveryRows[0][Object.keys(recoveryRows[0])[0]] === "0");
 
           if (Array.isArray(recoveryRows) && recoveryRows.length > 0 && !recoveryZeroCount) {
             console.log(
               `ℹ️ [Case-Sensitivity Recovery] Retried query with COLLATE NOCASE, found matching records (${recoveryRows.length})`
             );
             rows = recoveryRows;
             finalSql = enhancedSql;
           }
         } catch (recoveryErr) {
           console.log(`ℹ️ [Case-Sensitivity Recovery] Retry failed: ${recoveryErr.message}`);
         }
       }
     }
 
     // 6. Formatter
     const processingMs = Date.now() - startTime;
     const extraMeta = {
       sessionId,
       organization,
       role,
       processingMs
     };
     if (history && history.length > 0) {
       extraMeta.contextTurns = history.length;
     }
 
     const responsePayload = formatLlmResponse({
       sql: finalSql,
       rows,
       model: clientResult.model,
       llmDurationMs: clientResult.durationMs,
       extraMeta
     });
 
     return ANSWERED(responsePayload);
   } catch (err) {
     console.error("🚨 [LLM BUG] Local LLM execution threw unexpected error:", err);
     return BUG(`llm_bug:${err.message}`,err);
   }
 }
 