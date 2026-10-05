// ============================================================
// PIPELINE CONFIG — the cascade ORDER is data, not code.
// Graduation event: domain tools retired. Pipeline is schema-driven. 3 links replace 4.
// Reorder / disable / add links = edit THIS array.
// Links must speak the kernel vocabulary (handler-result.js).
// ============================================================

import { executeDynamicLink } from "../core/links/dynamic.link.js";
import { executeLlmLink } from "../core/links/llm.link.js";
import { executeFallbackLink } from "../core/links/fallback.link.js";

export const DEFAULT_PIPELINE = [
  { name: "Dynamic Query Engine", execute: executeDynamicLink },
  { name: "Local LLM", execute: executeLlmLink },
  { name: "Helpful Fallback", execute: executeFallbackLink }
];