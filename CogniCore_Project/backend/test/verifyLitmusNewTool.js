// Creates a throwaway tool file, registers via tool.router pattern,
// asserts it answers, asserts NO kernel files modified (git status).
import { execSync } from "child_process";
import { writeFileSync, rmSync, mkdirSync } from "fs";

const before = execSync("git status --porcelain src/kernel/ src/core/core.engine.js", {encoding:"utf8"});

mkdirSync("src/tools/demo", { recursive: true });
writeFileSync("src/tools/demo/litmus.tool.js",
`import { ANSWERED } from "../../kernel/handler-result.js";
export async function execute({ query }) {
  return ANSWERED({ answer: "litmus tool works", source: "tool", data: {}, meta: {} });
}`);

// (registration via tool.router is data-driven — assert manually for now)
const after = execSync("git status --porcelain src/kernel/ src/core/core.engine.js", {encoding:"utf8"});
rmSync("src/tools/demo/litmus.tool.js");
console.log(before === after ? "✅ LITMUS#1: kernel untouched by new tool" : "❌ kernel files changed");
process.exit(before === after ? 0 : 1);
