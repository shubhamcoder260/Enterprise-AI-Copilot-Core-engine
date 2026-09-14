import { runCoreEngine } from "../src/core/core.engine.js";
const r = await runCoreEngine({ query: " Students with CGPA above 8.5", sessionId: "litmus5" });
const t = r.meta?.pipelineTrace;
const ok = Array.isArray(t) && t.length >= 1 && t.every(e => e.link && e.status);
console.log(`${ok ? "✅" : "❌"} LITMUS#5: trace=${JSON.stringify(t)}`);
process.exit(ok ? 0 : 1);
