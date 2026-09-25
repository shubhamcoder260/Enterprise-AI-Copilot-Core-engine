import { execSync } from "child_process";
const bad = execSync(`grep -rln "config/database\\|llm.client\\|switch.orchestrator\\|adapters/mariadb\\|adapters/sqlite\\|mysql2" src/core/links/ src/tools/ || true`, { encoding: "utf8" }).trim();
if (bad) { console.log(`❌ BYPASS — direct infra/driver/orchestrator imports in:\n${bad}`); process.exit(1); }
console.log("✅ BYPASS: zero direct infra/driver/orchestrator imports in handlers/tools");
