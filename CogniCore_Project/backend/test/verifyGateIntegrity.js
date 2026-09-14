import { GATE_CHAIN } from "../src/kernel/gate.chain.js";
import * as validator from "../src/llm/sql.validator.js";
const ok1 = GATE_CHAIN[0].name === "validator" && GATE_CHAIN[0].run === validator.validateAndSanitizeSql;
const ok2 = GATE_CHAIN.at(-1).name === "readonly-executor";
console.log(`${ok1 && ok2 ? "✅" : "❌"} GATE INTEGRITY: first=${GATE_CHAIN[0].name}, last=${GATE_CHAIN.at(-1).name}`);
process.exit(ok1 && ok2 ? 0 : 1);
