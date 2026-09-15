# Architecture — 4-Link Soft-Cascade + Enforced Kernel
Response contract (frozen): { answer, source: tool|dynamic|llm|fallback, data{sql,...}, meta }
Links (pipeline-as-config — order is data): 1 Tools (4-7ms domain fast-path) →
2 Dynamic (NLP router: 15 shapes, 2-35ms) → 3 Local LLM (schema-injected prompt, Ollama) →
4 Fallback (schema-aware suggestions). Never crashes; expected misses cascade quietly.
Kernel seams (enforced): handler-result vocabulary (ANSWERED/PASS/ABSTAIN/BUG) ·
pipeline.config.js (run(input,{pipeline}) override) · gate.chain.js (validation-before-
execution, AST slot reserved) · capabilities.js (db/llm seam — zero direct infra imports).
Safety: validator FROZEN + OPEN_READONLY physical + atomic config + serialized switches.
Infra: RAM schema cache w/ MD5 drift, WAL history (per-session, survives switches),
COGNICORE_ACTIVE_DB env override, upload magic-header validation.
