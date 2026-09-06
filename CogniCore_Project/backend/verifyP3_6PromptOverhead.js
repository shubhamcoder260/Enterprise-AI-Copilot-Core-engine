// ==========================================
// VERIFICATION TEST P3.6: PROMPT OVERHEAD BENCHMARK
// ==========================================

import path from "path";
import { fileURLToPath } from "url";
import { buildSqlPrompt } from "./src/llm/sql.prompt.js";
import { readDatabaseSchema } from "./src/core/schema.reader.js";
import { switchDatabase } from "./src/config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  console.log("==========================================");
  console.log("VERIFY P3.6: PROMPT TOKEN OVERHEAD ANALYSIS");
  console.log("==========================================\n");

  const chinookPath = path.resolve(__dirname, "chinook.db");
  await switchDatabase(chinookPath);
  const schema = await readDatabaseSchema();

  const query = "What are the top 5 albums by total tracks?";

  // Scenario A: 0 history turns (first turn)
  const prompt0 = buildSqlPrompt({ query, schema, history: [] });

  // Scenario B: 3 history turns (maximum conversational context)
  const history3 = [
    {
      question: "Which artists have the highest track count?",
      sql: "SELECT artists.Name, COUNT(tracks.TrackId) AS track_count FROM artists JOIN albums ON artists.ArtistId = albums.ArtistId JOIN tracks ON albums.AlbumId = tracks.AlbumId GROUP BY artists.ArtistId ORDER BY track_count DESC LIMIT 5"
    },
    {
      question: "How many customers are located in Brazil?",
      sql: "SELECT COUNT(*) AS total FROM customers WHERE Country = 'Brazil' LIMIT 50"
    },
    {
      question: "Show total invoices per country",
      sql: "SELECT BillingCountry, COUNT(*) AS count FROM invoices GROUP BY BillingCountry ORDER BY count DESC LIMIT 10"
    }
  ];

  const prompt3 = buildSqlPrompt({ query, schema, history: history3 });

  // Character lengths
  const chars0 = prompt0.length;
  const chars3 = prompt3.length;
  const charDelta = chars3 - chars0;

  // Approximate token length (standard LLM rule of thumb ~4 chars per token)
  const approxTokens0 = Math.round(chars0 / 4);
  const approxTokens3 = Math.round(chars3 / 4);
  const approxTokenDelta = approxTokens3 - approxTokens0;

  console.log(`[0 Turns] Prompt Chars: ${chars0} (~${approxTokens0} tokens)`);
  console.log(`[3 Turns] Prompt Chars: ${chars3} (~${approxTokens3} tokens)`);
  console.log(`[Delta] Added Chars: ${charDelta}, Added Tokens: ~${approxTokenDelta}`);

  console.log("\n--- Injected History Section in 3-Turn Prompt ---");
  const contextIndex = prompt3.indexOf("### Previous Conversation Context:");
  const taskIndex = prompt3.indexOf("### Actual Task:");
  if (contextIndex !== -1 && taskIndex !== -1) {
    console.log(prompt3.substring(contextIndex, taskIndex).trim());
  }

  let passed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passed = false;
    }
  }

  // Verification assertions
  assert(!prompt0.includes("### Previous Conversation Context:"), "0-turn prompt omits context section completely (zero overhead)");
  assert(prompt3.includes("### Previous Conversation Context:"), "3-turn prompt includes Previous Conversation Context");
  assert(prompt3.includes("### Context Resolution Instruction:"), "3-turn prompt includes Context Resolution Instruction");
  assert(
    approxTokenDelta <= 250,
    `Overhead for 3 turns is compact and tightly bounded <= 250 tokens (got ~${approxTokenDelta} tokens)`
  );

  console.log("\n------------------------------------------");
  console.log(passed ? "🎉 VERIFY P3.6 PASSED" : "💥 VERIFY P3.6 FAILED");
  console.log("------------------------------------------");
  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
