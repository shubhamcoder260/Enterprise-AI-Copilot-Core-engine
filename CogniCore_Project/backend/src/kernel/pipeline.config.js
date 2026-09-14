// ============================================================
// PIPELINE CONFIG — the cascade ORDER is data, not code.
// Reorder / disable / add links = edit THIS array.
// Links must speak the kernel vocabulary (handler-result.js).
// ============================================================

import { executeToolLink } from "../core/links/tool.link.js";
import { executeDynamicLink } from "../core/links/dynamic.link.js";
import { executeLlmLink } from "../core/links/llm.link.js";
import { executeFallbackLink } from "../core/links/fallback.link.js";

export const DEFAULT_PIPELINE = [
  { name: "Configured Tools", execute: executeToolLink },
  { name: "Dynamic Query Engine", execute: executeDynamicLink },
  { name: "Local LLM", execute: executeLlmLink },
  { name: "Helpful Fallback", execute: executeFallbackLink }
];