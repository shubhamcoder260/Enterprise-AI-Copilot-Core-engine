// LITMUS #2 + #3: reorder via config; kill links; contract survives.
import { runCoreEngine } from "../src/core/core.engine.js";
import { ANSWERED, PASS } from "../src/kernel/handler-result.js";

const results = [];
const rec = (id, pass, detail) => { results.push({id, pass}); console.log(`${pass?"✅":"❌"} [${id}] ${detail}`); };

const fakeA = { name: "FakeA", execute: () => PASS("fake_a_pass") };
const fakeB = { name: "FakeB", execute: () => ANSWERED({ answer: "fake answered", source: "fallback", data: {}, meta: {} }) };

{
  const r = await runCoreEngine({ query: "t", sessionId: "po-1" }, { pipeline: [fakeA, fakeB] });
  rec("REORDER", r?.answer === "fake answered", `custom pipeline answered: "${r?.answer}"`);
}
{
  const r = await runCoreEngine({ query: "t", sessionId: "po-2" }, { pipeline: [fakeA] });
  rec("KILL", r && r.answer && r.meta?.pipelineTrace?.length >= 1,
      `all-pass pipeline → contract intact: source=${r?.source}, trace=${r?.meta?.pipelineTrace?.length} entries`);
}

const p = results.filter(r=>r.pass).length;
console.log(`SCORE: ${p}/${results.length}`);
process.exit(p === results.length ? 0 : 1);
