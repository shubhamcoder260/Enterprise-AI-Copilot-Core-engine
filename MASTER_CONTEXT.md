# COGNICORE — MASTER CONTEXT v1.1

> **How to use:** Paste as the *first message* of every new AI session, or point the agent
> at this file: "Read MASTER_CONTEXT.md and treat it as canonical." Anything not stated here
> must be asked about or marked *unverified* — never invented.

---

## 1. Identity

- **CogniCore** — on-premises natural-language-to-SQL analytics engine. Upload any SQLite file → ask questions in plain English → get answers with the exact SQL shown, computed by a local LLM that physically cannot modify data, with zero data egress.
- UG final-year academic project. Review 2 pending; publication targets an IEEE-indexed conference.
- Repo root: `~/Documents/project/cognicore/Cognicore/`; app in `CogniCore_Project/` (`backend/` with `src/` layout + `frontend/`).
- Status: **Phases 0–3 implemented and debugged. Part 1 performance upgrade (fast intent router + cascade reorder) implemented, acceptance-tested 6/6.** Phase 4 (feedback loop, full RAG) designed, not built — RAG-lite (`schema.notes.json`) only. **Part 2 (LLM intent-IR + corrective retry) designed, not built.**

---

## 2. Canonical Stack & Config

| Item | Value |
|---|---|
| Backend | Node.js + Express, port **5000** (`/health` verified) |
| Database | **SQLite only** — uploads land in `uploads/` with timestamped names |
| SQLite driver | `sqlite3` npm package + async wrapper — **NOT better-sqlite3** |
| LLM | Ollama `http://localhost:11434`, model `gemma3:4b`; model-agnostic seam (UI picker) |
| Frontend | React SPA (Vite), single `main.jsx`, dark theme, source badges, SQL panel |
| Config | `backend/.env`: `PORT=5000`, `ENABLE_LOCAL_LLM=true`, `LOCAL_LLM_URL=http://localhost:11434`, `LOCAL_LLM_MODEL=gemma3:4b` |
| Active DB pointer | `backend/active-database.json` (absolute path, persists across restarts) |
| Conversation memory | `backend/data/cognicore_history.db` — separate WAL-mode SQLite |
| Response contract | `{ answer, source, data, meta }`; `meta = { sessionId, engineMode, model, contextTurns, processingMs }` |
| Source values | `tool` \| `llm` \| `dynamic` \| `fallback` |
| Endpoints | `POST /api/ai/query` · `GET /api/llm/models` · `GET /api/history/:sessionId` · `POST /api/database/upload` · `POST /api/database/switch` · `GET /api/database/active` |

---

## 3. Architecture (compact canon)

```
Browser (main.jsx) ── POST /api/ai/query {question, sessionId, model}
        ▼
Express: server.js → ai.controller.js ──► history.store.js (WAL, fail-safe writes)
        ▼
core.engine.js — 4-LINK SOFT-CASCADE (ORDER FIXED IN PART 1)
  [1] tools:   intent.detector → tool.router → cgpa / foreign-student / cardiology
  [2] dynamic: fastIntent.js (deterministic NL router, FIRST)
               └─ null → existing sql.builder shapes → query.executor
               (distinct.cache.js feeds value filters; invalidated on switch hook)
  [3] LLM:     history(last 3) → sql.prompt → llm.client(Ollama)
               → sql.validator → executeReadOnlySql → llm.formatter
  [4] fallback: table list + suggested queries
        ▼
config/database.js — main conn + OPEN_READONLY conn · switchQueue · atomic config writes
schema.reader.js — RAM cache · MD5 drift check · switch-hook invalidation
External: Ollama daemon :11434
```

**Chain law:** expected failure = quiet log + cascade; real bug = loud `🚨 [TOOL BUG]` + cascade anyway. No link failure is user-visible. Router returns `null` on any doubt → cascades; never guesses.

---

## 4. Security Model — Two Independent Layers (the differentiator)

- **Layer 1 — `sql.validator.js` (FROZEN — never edit without audit):** strips `<think>` and markdown → must start SELECT/WITH → whole-word blocklist of 16 keywords → rejects comments and multi-statement `;` → allows `REPLACE()`, rejects `REPLACE INTO` → LIMIT missing, ≤0, or >100 forced to 50.
- **Layer 2 — physical:** fastIntent SQL executes via dynamic.query.engine.js:L83 → executeQueryPlan(readOnly: true) → getReadOnlyDatabase() (OPEN_READONLY). Executor supports a per-plan `readOnly` flag; all LLM SQL runs OPEN_READONLY; driver throws `SQLITE_READONLY`. Verified live by deliberately bypassing Layer 1 (earlier verification).
- **Infra hardening:** switchQueue serializes switches; atomic config writes; upload validation (magic header, basename sanitize, 50 MB, JSON error middleware).

---

## 5. Canonical Verified Numbers

| Metric | Value |
|---|---|
| Validator adversarial tests | **37/37**, verdicts <3 ms |
| Ground-truth DB accuracy | **UNRESOLVED(no benchmark script found — candidates examined: runPartBParityBenchmark.js, runPartDEcommerceBenchmark.js, verify_college_attendance.js, verifyLlm*.js)** |
| Fast-path latency (6-question acceptance) | **7–65 ms** (was ~15,000 ms via dead-LLM detour) |
| Dead-LLM cascade cost (Q4/Q6-type questions) | ~15 s — Part 2 will cap this |
| Failover (Ollama killed live) | **255 ms** |
| Deterministic tools | **4–11 ms** |
| LLM on CPU | 9–15 s typical, 4–45 s incl. cold start |
| Context injection | last 3 turns ≈ 227 tokens |
| Dynamic query shapes | **15 (8 sql.builder baseline + 7 fastIntent)** (resolves v1.0 §9.3) |
| Verification scripts | 40+ legacy + `verify_college_attendance.js` (6-question acceptance), `test_phase2_fast_intent_units.js` (9 cases), `test_phase3_distinct_cache.js`, `verifyConnLifecycle.js` — every claim must cite one |
| Schema cache | 0 DB calls after first read; staleness trap test passed |

---

## 6. Demo Canon (ground truth — memorize)

**erp_demo.db:** Tariq Patel = 7 direct reports · 3 VIP clients · 9 clients with no invoices · avg salary per department = 6 rows · "Top 3 projects by budget" → "and their status?" = context follow-up (`contextTurns` badge) · "Delete all VIP clients" → refused, rows unchanged · `ollama stop gemma3:4b` → 255 ms failover.

**college_attendance upload (Part 1 acceptance DB):** 80 students · attendance is long-format (one row per student per date) · student_id 80 → 8 rows `status='Absent'`, 60 `present` · 75 of 80 students have `attendance_percentage > 80` · acceptance set = the six verbatim user questions in `verify_college_attendance.js` (typos included).

---

## 7. Bug History — FIXED, do not re-report as open

1. Tools assumed hardcoded columns → soft-cascade on "no such column" added.
2. Benchmark scripts left `active-database.json` repointed — symptom fixed; root cause open (§9.4).
3. Shared singleton closed in `finally` → `SQLITE_MISUSE` under concurrency. Part 1 removed the executor's residual close; lifecycle now: singleton cached — config/database.js:L148 (db) & L231 (readOnlyDb), recycled only on switch (L195-207).
4. Multer HTML 500 → JSON error middleware + header validation + filename sanitization.
5. intent.detector "education" vs UI "college" — aligned.
6. sql.prompt false-joined any `id` to any `id` — generic `id` excluded.
7. Duplicate "+ New Chat" buttons — removed.
8. **(Part 1)** fastIntent value-match fuzzy-matched filler words to cached distinct values → filtered COUNT answered **40** instead of 80. Fix: stopword/tokenizer hardening + numeric coverage guard (every number in the question must be consumed by the command, else cascade). Root cause: fastIntent substring match loosely matched single-letter section 'A' from students.section in 'how many students are there', injecting WHERE "section" = 'A' (40 rows); fixed by exact token matching and stopword hardening (verify_college_attendance.js Q1). Regression locked by `verify_college_attendance.js` Q1.

---

## 8. Canonical Limitations (own before reviewers ask)

- **L1** model can drop a GROUP BY → SQL panel exposes it; *structurally mitigated for single-table shapes by the router (GROUP-by-capable shapes deferred to Part 2)*.
- **L2** surrogate mapping of missing nouns → Phase 4 RAG territory.
- **L3** SQLite-only (Postgres = additive future). *(numbering ratified v1.1)*
- **L4** No auth — deliberate for a local single-user tool. *(numbering ratified v1.1)*
- **L5** CPU-only, effectively single-user → the price of zero data egress.
- **L6** ambiguous follow-ups may take another valid reading → resolution logged in meta.
- **L7** Router covers single-table shapes only; computed columns (e.g., absent% = 100 − attendance_percentage) are not derivable → honest cascade to LLM (~15 s) until Part 2. "average absent percentage" currently correctly declines rather than fabricate.

---

## 9. Discrepancies — status after v1.1

1. ~~7/9 vs 8/9~~ **RESOLVED v1.1:** frozen at UNRESOLVED(no benchmark script found — candidates examined: runPartBParityBenchmark.js, runPartDEcommerceBenchmark.js, verify_college_attendance.js, verifyLlm*.js).
2. ~~L3/L4 gap~~ **RESOLVED v1.1:** numbered as L3/L4 above.
3. ~~Shape count 6 vs 8~~ **RESOLVED v1.1:** 15 (8 sql.builder baseline + 7 fastIntent).
4. **OPEN:** benchmark/scripts can mutate `active-database.json`. Mitigation: every script snapshots + restores it (`verify_college_attendance.js` is the reference pattern). Env-var override (`COGNICORE_ACTIVE_DB`, read-only) proposed for Part 2.

---

## 10. Explicitly NOT in the System — never claim these exist

No Postgres/MySQL/non-SQLite backend · no cloud LLM calls (seam only) · no auth/multi-user · no streaming · no CSV/Excel ingestion · no Phase 4 feedback loop or full RAG · no GPU offload · **no Part 2 intent-IR / JSON-mode LLM / retry loop / LLM latency cap yet** · router does not do joins or GROUP BY.

---

## 11. Rules for Any AI Working on This Project

1. §2, §4, §5 are canonical. Conflicting number from the user → flag, don't adopt silently.
2. Never invent filenames, endpoints, metrics, or features — ask or mark *unverified*.
3. Changes must respect the `{answer, source, data, meta}` contract, soft-cascade, the FROZEN validator, parameterized values, and read-only execution for all generated SQL.
4. New features ship with a new `verify*.js` script — that's the evidence culture.
5. Every new/modified script snapshots and restores `active-database.json`.
6. Vocabulary: Link 1–4, soft-cascade, contract, source badge, fast path, numeric coverage guard, values cache, switch hook, staleness trap, ground-truth key.

---

*End of Master Context v1.1 — Part 1 frozen. Next: Part 2 (intent-IR).*
