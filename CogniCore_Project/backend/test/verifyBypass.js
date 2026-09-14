import { execSync } from "child_process";
const bad = execSync(`grep -rln "config/database\\|llm.client" src/core/links/ src/tools/ || true`, { encoding: "utf8" }).trim();
if (bad) { console.log(`❌ BYPASS — direct infra imports in:\n${bad}`); process.exit(1); }
console.log("✅ BYPASS: zero direct infra imports in handlers/tools");
