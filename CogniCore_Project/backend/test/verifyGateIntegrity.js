import { GATE_CHAIN } from "../src/kernel/gate.chain.js";
import * as validator from "../src/llm/sql.validator.js";
const ok1 = GATE_CHAIN[0].name === "validator" && GATE_CHAIN[0].run === validator.validateAndSanitizeSql;
const okAst = GATE_CHAIN[1].name === "ast";
const ok2 = GATE_CHAIN.at(-1).name === "readonly-executor";
console.log(`GATE CHAIN: [${GATE_CHAIN.map((g, i) => `${g.name} (pos ${i + 1})`).join(", ")}]`);
console.log(`${ok1 && okAst && ok2 ? "✅" : "❌"} GATE INTEGRITY: validator (pos 1), ast (middle), readonly-executor (last)`);
process.exit(ok1 && okAst && ok2 ? 0 : 1);
