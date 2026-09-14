// ============================================================
// CORE ENGINE — the pure runner. Contains NO link logic.
// Pipeline is data (kernel/pipeline.config.js); the loop is law.
// Every link returns kernel vocabulary; every query carries ctx.
// ============================================================

import { detectIntent } from "./intent.detector.js";
import { DEFAULT_PIPELINE } from "../kernel/pipeline.config.js";
import { isHandlerResult } from "../kernel/handler-result.js";
import { capabilities } from "../kernel/capabilities.js";

export async function runCoreEngine(
  { query, organization = "college", role = "admin", sessionId, model },
  { pipeline } = {}
) {
  const startTime = Date.now();

  console.log("\n==============================");
  console.log("🧠 CORE ENGINE RECEIVED QUERY:");
  console.log(query);
  if (sessionId) console.log("🆔 SESSION ID:", sessionId);
  if (model) console.log("🤖 REQUESTED MODEL:", model);
  console.log("==============================");

  const intent = detectIntent(query, organization);
  console.log("🎯 DETECTED INTENT:", intent);

  const ctx = {
    query, organization, role, sessionId, model, intent, startTime,
    attempts: [],   // every { link, status, reason, ms } — step 5.5 routing feeds on this
    trace: []       // every decision — litmus #5 (trace test) evidence
  };

  const chain = pipeline || DEFAULT_PIPELINE;

  let lastReason = "";

  for (const link of chain) {
    const linkStart = Date.now();
    console.log(`🔗 Evaluating chain link: [${link.name}]`);
    const outcome = await link.execute({ ...ctx, capabilities });

    if (outcome == null) {
      console.error(`🚨 [ENGINE] Link [${link.name}] returned undefined/null — treating as BUG`);
      ctx.attempts.push({ link: link.name, status: "BUG", reason: "returned_nothing", ms: Date.now() - linkStart });
      ctx.trace.push({ link: link.name, event: "null_return" });
      lastReason = `${link.name}_returned_nothing`;
      continue;
    }

    if (!isHandlerResult(outcome)) {
      console.error(`🚨 [ENGINE] Link [${link.name}] violated the vocabulary contract`);
      ctx.attempts.push({ link: link.name, status: "BUG", reason: "contract_violation", ms: Date.now() - linkStart });
      ctx.trace.push({ link: link.name, event: "contract_violation" });
      lastReason = `${link.name}_contract_violation`;
      continue;
    }

    const { status, response, reason } = outcome;
    const ms = Date.now() - linkStart;

    ctx.attempts.push({ link: link.name, status, reason, ms });
    ctx.trace.push({ link: link.name, status, reason, ms });

    if (status === "ANSWERED" && response) {
      console.log(`✅ Handled by: [${link.name}] (source: ${response.source})`);
      response.meta = response.meta || {};
      response.meta.pipelineTrace = ctx.trace;
      return response;
    }
    if (status === "BUG") {
      console.error(`🚨 [ENGINE] Link [${link.name}] bug: ${reason}`);
    }
    if (outcome.extra) Object.assign(ctx, outcome.extra);
    if (reason) {
      lastReason = reason;
      console.log(`↪ Link [${link.name}] ${status}: ${reason}`);
    }
  }

  // Absolute safety catch-all (fallback always answers; belt-and-braces)
  return {
    answer: "Unable to process query.",
    source: "error",
    data: {},
    meta: {
      sessionId, organization, role,
      engineMode: "error",
      processingMs: Date.now() - startTime,
      pipelineTrace: ctx.trace
    }
  };
}