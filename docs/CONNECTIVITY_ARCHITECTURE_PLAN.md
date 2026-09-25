# COGNICORE CONNECTIVITY ARCHITECTURE PLAN — CAP v2.2 (FINAL, COMPLETE)
**Full Implementation Specification · All 10 Findings Resolved (A1–A10) · Call-Site Audited · Build-Ready**  
*Status: SPECIFICATION FINAL — receipts pending D0 execution · Header self-grading struck per A6 · This document supersedes v2.1-ratified and all prior drafts.*

---

## PART 0 — DOCUMENT LINEAGE (The Full Audit Trail)

| Version | Failures Found & Fixed |
|---|---|
| **v1.0 draft** | `ast.gate` dialect-edit contradiction; `gate.chain` branching unresolved; link scoping missing; single-active unreconciled; credentials undefined; prompt budget absent. |
| **v1.1** | Two-tier freeze doctrine introduced; dialect knob collapsed; factual error: *"postgresql gives backticks"* → corrected (backticks = MySQL/MariaDB family; Postgres is double-quoted ANSI). |
| **v1.2 / v2.0** | `ast.gate.js` re-pin protocol formalized; claimed computed ledger before it existed (claim-without-receipt) → honest method statement. |
| **v2.1-review** | 6-point audit: `config/database.js` missing from tiers; `sql.builder.js` wrongly Tier-1 (would block D3); `semantic.profile.js` ambiguous; + `fastIntent.js` self-caught (D1/D3 touches) → complete reclassification. |
| **v2.2 (this)** | Code inspection era: `capabilities` hard-import discovered (L-3 was half-true); `readonly-executor` falsely "universal" (SQLite-bound); 10 findings (F1–F10) resolved via amendments A1–A10 below. |

> **The Governing Lesson of all Seven Revisions:** Every error in every version was a claim made from memory about code or status that was never read, or an aspiration stated as an accomplished fact. CAP v2.2's rule: descriptions are labeled `[CURRENT]` or `[POST-D0x]`; receipts are pasted, not promised; the freeze ledger is enforced by a script, not asserted by prose.

---

## PART I — GOVERNING LAW & STATE

### 1.1 The Nine Laws (with Enforcement)

| Law | Invariant | Enforcement Mechanism |
|---|---|---|
| **L-1 Read-Only Heart** | Zero write capability to any external source | `cognicore_ro@'172.28.%.%'` `GRANT SELECT`-only; server-level refusal receipt; adapters expose no write method. |
| **L-2 Contract Stability** | `{ answer, source, data, meta, format? }` additive-only | Canonical battery re-proves per step. |
| **L-3 Handler Purity** | Links receive `{ ...ctx, capabilities }`; zero imports of drivers, `switch.orchestrator.js`, or singletons in `src/core/links/*` | `verifyBypass.js` (extended, D0c); engine receives capabilities via options (D0b re-pin). |
| **L-4 Gate Sees Full Schema** | Pruning is prompt-side only | `llm.link.js` grep receipt: unpruned schema → gate, pruned → prompt. |
| **L-5 SQLite Invariant** | Zero SQLite regressions | Canonical `verifyFullRegression.sh` (8/8) + all unit suites green every phase exit. |
| **L-6 Claims Match Reality** | Every freeze claim names tier + proof; every description labeled `[CURRENT]` / `[POST-D0x]` | `test/audit-freeze.js` + completeness assertion (A3). |
| **L-7 Kernel Governance** | `feat/fix(kernel)` prefix + full-file review BEFORE push | Standing rule since A2.1. |
| **L-8 Fail-Honest** | Verified-correct, flagged-uncertain, or abstained; fallbacks convert to clarify | D1 confidence ladder & grounding guards. |
| **L-9 Hybrid Doctrine** | LLM proposes; deterministic code disposes | Gate chain, AST structural verifier, sanity check, oracle harness. |

### 1.2 The Two Bug Classes (Review Lens)
1. **Loose Matching:** Exact normalized comparison; audit what normalization destroys (40-vs-80; B−/B; new: `"tabSales Invoice"` string-literal trap under MariaDB default `sql_mode` — F1).
2. **Over-Declining:** Every guard names its sentinel (College Q5: *"lowest attendance top 5 by student id"*) and proves it live.

### 1.3 Operational Hazards
- **H1** `dotenv-at-boot` · **H2** one-server/`pgrep` · **H3** zombie queue · **H4** ctx reload · **H5** abort-log audit · **H9** generator paths authoritative · **H10** re-derive after fixture regeneration · **H11** ERP credential rotation per session · **H12** `tab*` names with spaces — verbatim-preserve + backtick-quote everywhere (A9).

### 1.4 Non-Goals
No cloud warehouses / replication · no LangChain/LlamaIndex · no LLM writes (D5+ action gateway) · no concurrent multi-source querying D0–D3 · no automatic semantics (draft → anchor → oracle).

---

## PART II — THE SEVEN LAYERS

```
┌─────────────────────────────────────────────────────────────────┐
│ L7  SOURCE EXPERIENCE      (UI source selector, dialect-aware UX)│
│ L6  TRUTH & SAFETY         (oracle harness, gate chains, RLS)    │
│ L5  SEMANTIC MAPPING       (profiles, concept layer, docstatus)  │
│ L4  SCHEMA INTROSPECTION   (per-engine metadata → ONE shape)     │
│ L3  DIALECT ENGINE         (per-engine SQL rules — ONE knob)     │
│ L2  PROTOCOL ADAPTERS      (per-engine connection + execution)   │
│ L1  SOURCE REGISTRY        (what exists, as whom, active which)  │
└─────────────────────────────────────────────────────────────────┘
```

### L1 — Source Registry & Identity
- **`src/config/sources.js` (NEW, STABLE):** Descriptor catalog:
  ```javascript
  { id, kind: "sqlite" | "mariadb" | "postgres", dialect, credentialRef, profileRef, status, identity? }
  ```
  SQLite uploads auto-register; `active-database.json` remains the SQLite descriptor (backward compatibility). One active source at a time; federation is D4+ unpromised. Handlers never import it.
- **`src/config/credentials.js` (NEW):** `credentialRef` → `process.env` at connect time. Secrets live ONLY in `backend/.env`: `ERPNEXT_DB_HOST/PORT/USER/PASSWORD/NAME`, `ERPNEXT_API_KEY/SECRET`. No-secret-logging invariant (tested in `verifyAdapters.js`). Read-only user = blast-radius control. Multi-tenant store deferred with D4+ trigger.

### L2 — Protocol Adapters
**`src/adapters/` (NEW):** Uniform contract, `deepFreeze`d on export:
```javascript
{ connect(sourceDescriptor), queryReadOnly(sql, params), executeReadOnlySql(sql, params), close(), meta() }
```
*(Note: `executeReadOnlySql` alias added per F1/Gap-2: keeps `llm.link.js` lines 211/236 call sites working across all dialects).*

| Adapter | Engine | Read-Only Mechanism | Key Detail |
|---|---|---|---|
| `sqlite.adapter.js` | SQLite | `OPEN_READONLY` | Composes `config/database.js` (Tier-1, zero edits); passthrough byte-equivalence proven. |
| `mariadb.adapter.js` | MariaDB / MySQL | `cognicore_ro@'172.28.%.%'` `GRANT SELECT`-only | `mysql2/promise`; no write method exists; `pool.on('connection', conn => conn.query("SET SESSION sql_mode=CONCAT(@@sql_mode, ',ANSI_QUOTES')"))` lifecycle hook (A1) ensuring every connection created by the pool carries ANSI_QUOTES so frozen `result.sanity.js` sampling never breaks; query timeout; error redaction. |
| `postgres.adapter.js` | PostgreSQL | read-only role | Catalog expansion (D3). |

### L3 — Dialect Engine (The One-Knob Rule)
**`src/adapters/dialects/index.js` (NEW):**
```javascript
export const DIALECTS = deepFreeze({
  sqlite: {
    parser: "sqlite",
    quote: d => `"${d}"`,
    dateFn: "strftime",
    limitStyle: "LIMIT n",
    concat: "||",
    dateMath: "julianday",
    collateNOCASE: true,
    docs: "..."
  },
  mariadb: {
    parser: "MariaDB",
    quote: d => `\`${d}\``,
    dateFn: "DATE_FORMAT",
    limitStyle: "LIMIT n",
    concat: "CONCAT()",
    dateMath: "DATEDIFF",
    collateNOCASE: false, // Case-insensitive by default; line-211 recovery bypassed (Gap 2)
    docs: "docstatus=1 for submitted; tab* prefix backtick-quoted verbatim; prefer range predicates on date columns (e.g. col >= 'YYYY-01-01' AND col < 'YYYY+1-01-01') over YEAR() for index eligibility; DATE_FORMAT..."
  },
  postgres: { ... } // D3
});

export const getDialect = (key) => DIALECTS[key] || null;
```
Single knob: parser grammar + quoting + date functions + `collateNOCASE` all from one entry; consumed identically by `ast.gate.core.js`, `sql.prompt.js`, `gate.selector.js`, adapters, and `llm.link.js`. Parser smoke test first (D0c): `database: "MariaDB"`, backtick round-trip → `column_ref`.

### L4 — Schema Introspection
**`schema.reader.js` (STABLE, dialect-branched in D0d):**
- SQLite PRAGMA path untouched.
- MariaDB path queries `information_schema.TABLES`, `information_schema.COLUMNS`, `information_schema.KEY_COLUMN_USAGE` → identical enriched shape.
- Drift cache: SQLite MD5 of `sqlite_master` / MariaDB version + table-set hash.
- ERP annotations (A9 language): `tab*` detection; `docstatus` flag; `naming_series`; identifiers preserved **VERBATIM** (`tabSales Invoice` keeps its space) and backtick-quoted at every use — never "normalized away." Performance receipt: 200+ tables timed and cached.

### L5 — Semantic Mapping
- `semantic.profile.js` — **Tier-1 FROZEN**, untouched.
- Fragments live in NEW sibling files: `src/config/profiles/erpnext.profile.js` (aliases, labels, `docstatus` doctrine, module vocab), `src/config/profiles/sqlite.profile.js` (D1 temporal). Consumers import fragments directly.
- **Concept Layer (D2):** Canonical concepts (`customer`, `order`, `invoice`, `item`, `vendor`, `employee`, `payment`) mapped per source.
- **`erp.meta.js` (API-Key Channel):** DocType metadata → labels / link graphs / select options → draft → human approval → profile. D0 proves ONE doctype; D2 scales across modules.

### L6 — Truth & Safety
- **Oracle Harness (`test/oracle/oracle.harness.js`):** Pinned business question → ERP's own built-in report value = ground truth → assert match. Version-pinned per ERP release.
- **Gate Chains per Dialect via `gate.selector.js` (§III.3):** Universal slot contract, per-dialect backing (Gap 2).
- **RLS:** Identity from L1 → IR-injected predicates. D2 design-lock (identity = API-key user; enforcement = IR predicates; test spec = CEO-salary). D4 enforcement live. Single-tenant window D0–D3 documented and closed at D4.

### L7 — Source Experience
- `DatabaseSidebar.jsx` (STABLE) becomes source selector (📄 SQLite / 🏢 ERPNext-live badges, active indicator, serialized switch via orchestrator endpoints).
- `Visualizer.jsx`, `SqlModal.jsx`, `ChatWindow.jsx` remain completely unchanged.

---

## PART III — THE FREEZE LEDGER (14 Files = 10 Tier-1 + 4 Tier-2)

### III.0 Method & Status
Verified by full grep of every `STATUS:` line in the 60-file dossier in one pass. `test/audit-freeze.js` is a D0a deliverable — this table is its committed JSON seed (`test/golden/freeze_ledger.json`), not its output. From D0a forward, the ledger is machine-enforced.

### III.1 The Ledger

| # | File Path | Tier | Re-Pin Event / Receipt |
|---|---|---|---|
| 1 | `backend/src/llm/sql.validator.js` | **T1** | Empty diff per battery (Litmus #8 baseline). |
| 2 | `backend/src/kernel/gate.chain.js` | **T1** | Empty diff; `gateChainFor(sqlite) === GATE_CHAIN`. |
| 3 | `backend/src/kernel/pipeline.config.js` | **T1** | Empty diff; 4-link order immutable. |
| 4 | `backend/src/kernel/handler-result.js` | **T1** | Empty diff; status vocabulary immutable. |
| 5 | `backend/src/kernel/formatter.registry.js` | **T1** | Empty diff; presentation only. |
| 6 | `backend/src/core/result.sanity.js` | **T1** | Empty diff; MariaDB compatibility via A1 `ANSI_QUOTES`, no re-pin needed — pinned by test. |
| 7 | `backend/src/core/guard-markers.js` | **T1** | Empty diff; grouping regex markers. |
| 8 | `backend/src/llm/llm.client.js` | **T1** | Empty diff; Ollama client 75s budget (restored). |
| 9 | `backend/src/config/semantic.profile.js` | **T1** | Empty diff; fragments are sibling files. |
| 10 | `backend/src/config/database.js` | **T1** | Empty diff; generalization via `switch.orchestrator.js` composing it — orchestrator is the ONLY caller of `switchDatabase()`, SQLite targets only. |
| 11 | `backend/src/kernel/capabilities.js` | **T2** | D0b re-pin #1: extraction → `capabilities.core.js`; shim re-exports; + `createCapabilitiesForSource()`; golden `capabilities_golden.json`. |
| 12 | `backend/src/core/core.engine.js` | **T2** | D0b re-pin #2: signature + `{ capabilities }` option; golden CE-01..07 diff match. |
| 13 | `backend/src/kernel/ast.gate.js` | **T2** | D0d re-pin #3: extraction → `ast.gate.core.js` (dialect via L3); shim; `ast.gate.mariadb.js`; golden 35+ corpus. |
| 14 | `backend/src/core/fastIntent.js` | **T2** | D1 re-pin #4 (temporal family) + D3 re-pin #5 (MariaDB ratio/time-window port); `7f24d3b` retroactively documented as first informal re-pin. |

**STABLE / OPEN (Editable, Battery-Governed):**
`server.js` · `ai.controller.js` (lease wiring) · `database.controller.js` (source routing) · `schema.reader.js` · `schema.resolver.js` · `distinct.cache.js` · `sql.builder.js` (D3: consumes `DIALECTS.quote` — STABLE, zero ceremony) · `query.executor.js` · `response.formatter.js` · `dynamic.query.engine.js` · `intent.detector.js` · `tool.router.js` · `links/*` (`llm.link.js` gate-lookup wiring) · `routes/*` · `history.store.js` · `tools/*` · `presentation.intent.js` · `schema.pruner.js` · all new files (`sources.js`, `credentials.js`, `switch.orchestrator.js`, `gate.selector.js`, `ast.gate.core/mariadb.js`, `capabilities.core.js`, `adapters/*`, `dialects/*`, `profiles/*`, `erp.meta.js`) · frontend.

### III.2 The Re-Pin Protocol (Every Tier-2 Event)
1. Golden-corpus capture at current behavior (pre-commit) → `test/golden/<name>_golden.json`.
2. One governed commit (`fix(kernel)` or `feat(kernel)`, full-file inspection before push).
3. Equivalence proof: corpus re-run → 100% identical, diffed and pasted.
4. Permanent enforcement: integrity test re-asserts equivalence on every battery run.
5. Record update: re-pin hash and behavioral-ancestor noted in dossier.

### III.3 `gate.selector.js` + Gap-2 Harmonization
```javascript
export const GATE_CHAINS = deepFreeze({
  sqlite: GATE_CHAIN, // Identity equality: === GATE_CHAIN, untouched
  mariadb: [mariadbValidator, astGateMariadb, readonlyExecutorMariaDB]
});

export const gateChainFor = (sourceDescriptor) => {
  // Legacy / default SQLite invocation without source descriptor
  if (sourceDescriptor === undefined || sourceDescriptor === null) {
    return GATE_CHAINS.sqlite;
  }
  const dialect = sourceDescriptor.dialect;
  if (!dialect || typeof dialect !== "string") {
    throw new Error(`[Security Gate] Invalid source descriptor: missing or malformed dialect`);
  }
  const chain = GATE_CHAINS[dialect.toLowerCase()];
  if (!chain) {
    throw new Error(`[Security Gate] Unsupported dialect: "${dialect}". Refusing execution (fail-closed)`);
  }
  return chain;
};
```
- **Slot Contract Universal; Backing Per-Dialect:** Slot 3 name is strictly `"readonly-executor"` in every chain; `run` delegates to the descriptor's adapter (`sqliteAdapter` / `mariadbAdapter`). Rationale: `executeReadOnlySql` is bound to SQLite's singleton — a physical impossibility for MariaDB (`mysql2` socket).
- **A5 Binding Hazard:** Chains must NOT memoize adapter closures — `readonlyExecutorMariaDB` executes against the active adapter at call time; `verifyGateSelector.js` asserts that switching sources immediately routes execution to the new adapter.
- **`mariadbValidator` (NEW Sibling):** Frozen validator's rules + A2 additions (`INTO\s+OUTFILE|INTO\s+DUMPFILE` rejection; backtick-aware identifier checks). The frozen validator itself remains untouched.

### III.4 D0 Scope Law
ERP sources are **LLM-tier-only** in D0:
- `tool.link.js` soft-cascades on non-SQLite sources (`PASS("tools_unsupported_for_source:mariadb")`).
- `dynamic.query.engine.js` returns `PASS("source_dialect_unsupported:mariadb")` — loud, in `pipelineTrace`.
- `pipeline.config.js` is untouched. Dynamic-tier porting is Phase D3 work.

### III.5 `audit-freeze.js` (D0a Deliverable)
Four machine-enforced assertions:
1. Every Tier-1 file: `git diff <pin> -- <file>` is EMPTY.
2. Every Tier-2 file: touched ONLY in its named re-pin phase, equivalence proof present.
3. Completeness (A3): every tracked file modified appears in the manifest — absent OR tier-contradicted → RED.
4. `fastIntent.js` / `sql.builder.js` phase-gating enforced (D1 / D3 windows).

---

## PART IV — SECURITY, BUDGETS, RISK

- **Credentials:** Env-only (`backend/.env`); redaction tested; read-only user = blast-radius control; multi-tenant deferred (D4+ trigger). Subnet-pinned grant (D−1): `cognicore_ro@'172.28.%.%'` on the declared compose bridge subnet (`172.28.0.0/16`).
- **Prompt Budgets:** Dialect pack ≤ 300 tokens; ERP prompt ≤ 1.5× SQLite baseline (at equivalent table count). `verifyP3_6PromptOverhead.js` extended and run in every D-battery touching prompts.
- **Risk Register:** Full mitigations in place for MariaDB dialect habits, `docstatus` doctrine, Docker DevOps, 300+ table introspection, credential leakage, and ANSI quotes mode drift.

---

## PART V — THE PHASED EXECUTION PLAN (D−1 → D5)

### Phase D−1 — Contract Lock & Environment Pinning
1. Add `mysql2` to `CogniCore_Project/backend/package.json`; verify Node ≥ 20 and air-gapped installation protocol.
2. Deploy ERPNext v15 compose with pinned bridge subnet `172.28.0.0/16`; seed demo company; verify container health.
3. Apply subnet-scoped grant script:
   ```sql
   REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'cognicore_ro'@'172.28.%.%';
   GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'172.28.%.%';
   FLUSH PRIVILEGES;
   ```
4. Pin oracle queries: Q1 *"Total sales invoice amount for fiscal year 2024"* (vs General Ledger) · Q2 *"Count of active customers"* (vs Customer list). Exact seeded values extracted at D0e.
5. Record baseline SQLite battery receipts (`verifyFullRegression.sh`).
*Exit:* Pinned `.env.example`, scoped grant script, oracle questions documented, green baseline.

### Phase D0a — Freeze Enforcement & Golden Capture
1. Build `test/audit-freeze.js` seeded from §III.1 ledger (`test/golden/freeze_ledger.json`): 4 assertions (§III.5) — exits 0 on clean tree, 1 on synthetic Tier-1 touch (self-test verified).
2. Capture AST Golden Corpus: `test/golden/ast_gate_golden.json` — 35+ statements across standard queries, bare-column aggregations, composite PK-FD, CTEs, subqueries, ReDoS hostiles, and double-quoted identifiers.
*Exit:* Audit script green + self-test red-proven; golden JSON committed.

### Phase D0b — Capabilities Seam, Leases & Engine Golden
1. Capture CE Golden Corpus (pre-re-pin): `test/golden/core_engine_golden.json` — CE-01 (tool) · CE-02 (dynamic) · CE-03 (LLM-resolved via deterministic mock LLM/adapter per F4) · CE-04 (fallback) · CE-05 (no-options legacy path) · CE-06 (mock options) · CE-07 (`gateChainFor(undefined) === GATE_CHAIN`).
2. **Re-Pin #1 — `capabilities.js`:** Extraction → `capabilities.core.js`; shim re-exports `capabilities` + `createDefaultCapabilities()`; add `createCapabilitiesForSource(descriptor)`; verify golden `capabilities_golden.json`.
3. **Re-Pin #2 — `core.engine.js`:** Signature `runCoreEngine(params, { pipeline, capabilities } = {})`; line 41 `activeCaps = customCapabilities || capabilities`; assert CE-01..07 100% deep-equal diff match.
4. **`switch.orchestrator.js`:** `acquireQueryLease()` (blocks if switch in-flight) · `releaseQueryLease(handle)` · `switchTo(id)` (sets pending → drains leases → swap → invalidate caches → clear pending). Round-trip cache invalidation verified.
5. **`ai.controller.js` Wiring:** Lease acquire → source read → `createCapabilitiesForSource` → `runCoreEngine(..., { capabilities })` → `finally release`. Verified by Case SO-05 (forced throw releases lease; no deadlock).
*Exit:* CE-01..07 green · SO-05 green · `verifyPipelineOverride.js` green · `audit-freeze.js` passes D0b re-pins.

### Phase D0c — Adapters & Dialects
1. `src/adapters/dialects/index.js` per §L3; `deepFreeze`; `getDialect` exact lookup.
2. `sqlite.adapter.js` — composes `config/database.js`; contract `{ connect, queryReadOnly, executeReadOnlySql, close, meta }`; passthrough byte-equivalence receipt.
3. `mariadb.adapter.js` — `mysql2/promise` as `cognicore_ro`; pool-level lifecycle event `pool.on('connection', conn => conn.query("SET SESSION sql_mode=CONCAT(@@sql_mode, ',ANSI_QUOTES')"))` bound to every spawned/recycled connection (A1); no write method exists; server-receipt: `INSERT`/`DROP TABLE` → `ER_TABLEACCESS_DENIED_ERROR`; query timeouts; secret redaction.
4. `test/verifyDialects.js` — `deepFreeze` mutation attempts fail; parser smoke (backtick round-trip → `column_ref`); unknown dialect → null.
*Exit:* `verifyAdapters.js` + `verifyDialects.js` green.

### Phase D0d — Schema, Prompts, Gates (Call-Site Audited)
1. **Re-Pin #3 — `ast.gate.js`:** Extraction → `ast.gate.core.js` (dialect via L3 entry); shim; `ast.gate.mariadb.js` (backtick mode; A2: `INTO OUTFILE/DUMPFILE` rejection; extended function whitelist: `DATE_FORMAT`, `CONCAT`, `YEAR`, `MONTH`, `DAY`, `CURDATE`, `NOW`); golden corpus 100% identity diff match.
2. `gate.selector.js` per §III.3; `verifyGateSelector.js` asserts per-call adapter binding (no stale closures).
3. `schema.reader.js` dialect branch (`information_schema` → same shape contract; verbatim identifiers + backtick discipline per A9; `docstatus`/`tab*`/`naming_series` annotations; performance receipt on 200+ tables).
4. `sql.prompt.js` parameterization: dialect header (*"You are a strict MariaDB SQL generator."*), quoting rules (backticks, verbatim `tabSales Invoice`), dates (range predicates on date columns preferred over `YEAR()` for index eligibility), `docstatus` doctrine line — prompt budget pack ≤ 300 tokens (A3).
5. `llm.link.js` call-site wiring: `gateChainFor(ctx.capabilities.source)`; lines 99–118 & 152–174 execute via selected chain's `readonly-executor` slot; line 211 `COLLATE NOCASE` recovery gated on `DIALECTS[dialect].collateNOCASE` (bypassed on MariaDB); line 236 `db.executeReadOnlySql` executes via capabilities — zero driver/orchestrator imports.
*Exit:* Golden equivalence pasted; both dialect-mode matrices green; selector + binding assertions green; introspection same-shape + performance; budget receipt.

### Phase D0e — UI, Oracle & Compatibility Gate
1. UI: `DatabaseSidebar.jsx` source selector (badges, active indicator); `GET /api/database/sources` + `POST /api/database/sources/switch` (orchestrator-routed).
2. Live Oracle Demo: Pinned Q1/Q2 against live ERPNext — SQL shown in UI (clean backticks), values matched to seeded reports, S16 PINNED (A3): the failing *"last 5 years as graph"* question executed against live ERP GL — full JSON recorded as the honesty before-picture in `docs/PART_D_RECORD.md`.
3. Full Compatibility Battery: `verifyFullRegression.sh` (8/8) · validator (37/37) · `audit-freeze.js` green (10 Tier-1 empty diffs + registered D0 re-pins) · College (6/6, Q5 by name) · S13 (5,541) · P3.2 green · Formatter (14/14) · Pruner (P-U1..7) · Aliases (A-U1..6) · Intent units · Visualizer (V1–V7) · Prompt overhead ceilings · Parity M1–M10.
*Exit:* Every receipt recorded; `PART_D_RECORD.md` seeded; git ahead 0.

### Phase D1 — Honesty Spine (Co-requisite for GA)
- Intent-IR light (`{ entities, metric, filters, grain, confidence }`).
- Confidence ladder (`HIGH` / `MEDIUM` / `AMBIGUOUS` → clarify / `UNRESOLVABLE` → fallback).
- S16 guard (chart dimensions must exist in source column — distinct-cache-powered with `ANSI_QUOTES`).
- `fastIntent.js` **Re-Pin #4** (temporal family; golden = battery SQL assertions; equivalence pasted).
*Exit:* Failing question answers from real data OR asks one clarifying question — never fabricates; sentinels green.

### Phases D2–D5 Summary
- **Phase D2:** `erp.meta.js` across Accounting/Selling/Buying/Stock/HR; concept layer; `docstatus` doctrine; module suites oracle-verified; RLS design-lock (CEO-salary spec written).
- **Phase D3:** Postgres adapter + pack; onboarding-hours thesis receipt; `fastIntent.js` **Re-Pin #5** (ratio + time-window → MariaDB); `sql.builder.js` scheduled STABLE edit: `quoteIdentifier(name, dialect)` consuming `DIALECTS.quote`.
- **Phase D4:** Verification chain (`verify.chain.js`: grounding + arithmetic re-check); self-consistency sampling; RLS enforcement live (CEO-salary test green).
- **Phase D5+:** Action Gateway (parameterized mutation templates; human-in-the-loop approval; read-only heart sacred).

---

## PART VI — TEST ARSENAL (Additions)

| Test Script | Proves | Phase |
|---|---|---|
| `test/audit-freeze.js` | 4-assertion freeze ledger (empty diffs, phase-gating, completeness). | D0a |
| `test/golden/ast_gate_golden.json` | 35+ AST verdict corpus. | D0a |
| `test/golden/core_engine_golden.json` | Engine re-pin equivalence (CE-01..CE-07, deterministic mock LLM/adapter). | D0b |
| `test/golden/capabilities_golden.json` | Capabilities shim equivalence. | D0b |
| `test/verifyCoreEngineGolden.js` | CE deep-equal runner with structural diff printing. | D0b |
| `test/verifySwitchOrchestrator.js` | Lease lifecycle; SO-05 release-on-throw; no deadlock; cross-dialect cache clear. | D0b |
| `test/verifyAdapters.js` | Contract; SQLite passthrough; `ANSI_QUOTES` session mode (A1); server write refusal; redaction. | D0c |
| `test/verifyDialects.js` | `deepFreeze`; parser smoke (backtick round-trip); unknown → null. | D0c |
| `CogniCore_Project/backend/test/verify_mariadb_introspection.js` | Same-shape contract; PK/FK fidelity; performance. | D0d |
| `test/verifyGateSelector.js` | Chain integrity; A5 per-call adapter binding. | D0d |
| `test/golden/ast_gate_mariadb_matrix.json` | 9-case matrix in MariaDB mode. | D0d |
| `verifyP3_6PromptOverhead.js` (ext.) | Dialect pack ≤ 300 tok; ERP prompt ≤ 1.5× baseline. | D0d/e |
| `verifyBypass.js` (ext.) | Zero driver/orchestrator imports in links. | D0d |
| `verifyTest2SwitchInvalidation.js` (ext.) | Cross-dialect cache clearing (`sqlite → mariadb → sqlite`). | D0b |
| `test/oracle/oracle.harness.js` | Query answers = ERP's own built-in reports. | D0e |
| `test/verify_m1_m10_parity.js` (ext.) | Source selector UI parity. | D0e |
| Existing Full Battery | Compatibility receipt (`verifyFullRegression.sh` 8/8). | Every phase |

---

## PART VII — SIGN-OFF & IMMEDIATE NEXT ACTION

| # | Architectural Decision | Status |
|---|---|---|
| 1 | ERPNext v15 Target (Docker, demo company seeded) | ✅ LOCKED |
| 2 | D1 Co-requisite (Unrestricted ERP answering gated on D1 honesty spine) | ✅ LOCKED |
| 3 | Demo / Oracle Questions (Q1 FY2024 sales · Q2 active customers) | ✅ LOCKED |
| 4 | Freeze Doctrine (10 Tier-1 Textual, 4 Tier-2 Behavioral Re-Pins) | ✅ LOCKED |
| 5 | Amendments A1–A10 (Call-site audited and incorporated) | ✅ LOCKED |

---
*End of CAP v2.2 Specification — Ready to begin Phase D−1.*
