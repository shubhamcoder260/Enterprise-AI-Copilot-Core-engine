import "dotenv/config";
import { generateSql } from "../src/llm/llm.client.js";

async function main() {
  console.log("\n================================================================================");
  console.log("🧪 TEST SUITE: verifyLlm2ClientContract.js");
  console.log("================================================================================\n");

  const originalUrl = process.env.LOCAL_LLM_URL || "http://localhost:11434";

  // Part 1: Dead-port call (Ollama offline simulation)
  console.log("▶️ [PART 1] Calling dead port http://localhost:59999 (Ollama offline simulation)...");
  process.env.LOCAL_LLM_URL = "http://localhost:59999";

  const offlineRes = await generateSql({
    prompt: "SELECT 1;",
    model: "gemma3:4b"
  });

  process.env.LOCAL_LLM_URL = originalUrl;

  console.log("Offline result:", offlineRes);
  const offlinePassed =
    offlineRes.success === false &&
    offlineRes.errorType === "llm_offline" &&
    offlineRes.durationMs < 2000;

  if (offlinePassed) {
    console.log("✅ Part 1 PASSED: Dead port classified as 'llm_offline' without throwing or hanging.\n");
  } else {
    console.error("❌ Part 1 FAILED:", offlineRes);
    process.exit(1);
  }

  // Part 2: Live Ollama call
  console.log(`▶️ [PART 2] Calling live Ollama at ${originalUrl}...`);
  const liveRes = await generateSql({
    prompt: "Output ONLY one SQLite query: SELECT id, name FROM students LIMIT 5;",
    model: "gemma3:4b"
  });

  console.log("Live result:", liveRes);
  const livePassed =
    liveRes.success === true &&
    typeof liveRes.sql === "string" &&
    liveRes.sql.length > 5 &&
    liveRes.errorType === null &&
    liveRes.durationMs > 0;

  if (livePassed) {
    console.log("✅ Part 2 PASSED: Live Ollama call succeeded with clean SQL and measured duration.\n");
  } else {
    console.error("❌ Part 2 FAILED:", liveRes);
    process.exit(1);
  }

  console.log("================================================================================");
  console.log("🎉 ALL CHECKS PASSED for verifyLlm2ClientContract.js");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Unexpected error in verifyLlm2ClientContract.js:", err);
  process.exit(1);
});
