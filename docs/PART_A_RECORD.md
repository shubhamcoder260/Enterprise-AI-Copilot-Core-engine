# CogniCore — Part A Measurement & Verification Record

> **Status:** Canonical & Locked  
> **Phase:** Part A (Base Completion — The Bedrock)  
> **Scope:** Empirical measurements, structural guarantees, failure-class eliminations, and open edges.

---

## T1. Refusal Latency (O15 Fast-Refusal Verification)

Under the baseline architecture, unresolvable structural failures cascaded through the full LLM timeout budget (12s–45s). Under O15 fast-refusal guards, unresolvable table and column declines are identified upstream and refused immediately without invoking the local model.

| Specimen / Question | Baseline Latency | Guarded Latency | Post-A3 Live Today | Verdict |
|---|---|---|---|---|
| **"Delete all patients"** (Hostile mutation) | 12,518 ms | **5 ms** | < 10 ms | Fast refusal via Layer 1 validator |
| **College Q6** (*"Average no. of student absent > 10 days"*) | 15,049 ms (cold) / 13,201 ms (warm) | **7 ms – 34 ms** | 23 ms | Upstream derivation veto → clean fallback |
| **College Q4** (*"Average absent percentage"*) | 45,102 ms (cold) | **141 ms** (cold) / **20 ms** (warm) | 19 ms | Derived deterministic SQL `(100.0 - AVG(...))` |
| **"How many nurses are employed here?"** | 12,988 ms | **21 ms** | < 30 ms | Fast refusal on schema column missing |
| **Part D Q4** (*"Average product price per category, highest first"*) | 23,250 ms | 19,522 ms | **57,588 ms** | Corrective retry fired (attempt 2/2) → exhausted to fallback |

---

## T2. Corrective Retry Machinery (A3 Execution)

The one-shot corrective retry mechanism (`llm.link.js`) activates strictly upon Layer 2 AST Gate rejection (`ast_*` or `group_by_required`), providing the LLM with the exact rule violated and schema hints. Retries are structurally capped at a maximum of 2 total LLM attempts per query.

| Specimen | Initial Failure Reason | Retry Attempt Outcome | Total ProcessingMs | Within 2× Normal Budget? | Recovery Status |
|---|---|---|---|---|---|
| **S1 (Part D Q4)** | `ast_table_not_in_schema:categories` | `ast_table_not_in_schema:categories` | 19,536 ms | **YES** (19.5s ≤ 24s) | 0/1 (Exhausted cleanly to fallback) |
| **S5 (Chinook)** | `ast_column_not_in_schema:T1.Country` | `ast_column_not_in_schema:T1.Country` | 76,103 ms | **NO** (Exceeded 2× budget due to cold 11-table DDL CPU prefill) | 0/1 (Exhausted cleanly to fallback) |

*Summary:*
- **Firing Rate:** 2/2 live (100% activation on structural gate rejection).
- **Recovery Rate:** 0/2 in-sample (0% — LLM repeated schema hallucination).
- **Honesty Guarantee:** Zero silent-wrong output; 2/2 escalated to honest fallback refusal (`corrective_retry_exhausted`).

---

## T3. Empirical Benchmark Scores

| Suite / Benchmark | Baseline Cold | Baseline Warm | Guarded / Post-A3 | Notes |
|---|---|---|---|---|
| **Part D Cross-Domain E-Commerce (9Q)** | 2/9 (22%) | 5/9 (55%) | **8/9 (89%)** | Q4 cleanly abstains via retry exhaustion; zero silent-wrong queries |
| **Hospital Realm Full Battery (19Q)** | 13/19 (68%) | 13/19 (68%) | **15/19 (79%)** | +2 gain; stable baselines, zero drift beyond noise |
| **SQL Security & Validator Matrix** | 37/37 | 37/37 | **37/37 (100%)** | Layer 1 frozen; ReDoS protected (<0.05ms on 10k chars) |
| **College Attendance Suite** | 6/6 | 6/6 | **6/6 (100%)** | Q5 sentinel (*"lowest attendance top 5"*) green by name |
| **S13 Categorical Precision** | Fail (5,800+) | 5,541 | **5,541 (Exact)** | Disambiguates `B` vs `B-` strictly |

---

## T4. Architectural Decision O6: Local LLM Timeout Policy

- **Policy:** `LOCAL_LLM_TIMEOUT_MS=75000` (75 seconds).
- **Verification Evidence:** `⏱️ [LLM Client] Call aborted after 75013.84 ms (timeout: 75000 ms)` captured live during chinook schema execution.
- **Process Lesson:** The timeout was adjusted in two stages during CPU load optimization (45s → 60s → 75s). Setting the policy in `.env` without documenting the architectural decision created a temporary verification discrepancy. Formally recorded as Decision O6 in `ROADMAP.md`.

---

## T5. Known Open Edges (Execution-Backstopped)

The following edge cases remain open at the end of Part A, backstopped by physical read-only execution and Layer 1 validator invariants:

1. **CTE Column-Check Softening:** CTE column references inside subqueries bypass strict table-existence validation if aliased dynamically.
2. **Expression Bare-Column Escape:** Arithmetic expressions wrapping non-grouped bare columns (`AVG(price) + category`) can evade naive AST node aggregation checks.
3. **ORDER BY Bare-Column Unchecked:** Unaggregated non-PK columns projected in `ORDER BY` without appearing in `GROUP BY` are permitted by SQLite's relaxed engine if not explicitly flagged.
4. **Cross-Table PK-Name Collision:** Unqualified `GROUP BY id` across multi-table joins where both tables define `id` relies on driver resolution rather than qualified schema enforcement.
5. **`a/an` STOP-Word Gap:** Tokenizer stripping the article `a` creates ambiguity for letter-grade queries (*"received an A grade"*). Dormant for existing pinned test suites, but active for free-text input.
6. **Retry Recovery Rate (0/2 in-sample):** The corrective retry mechanism structurally fires and prevents silent failure, but small models (`gemma3:4b`) frequently repeat their initial hallucination across retries.
7. **AST Whitelist Over-Decline Risk:** Whitelist currently enforces `COUNT, SUM, AVG, MIN, MAX, ROUND, LOWER, UPPER, strftime`. Valid functions like `CAST()` or SQLite `date()` are structurally rejected by AST gate until added to whitelist.

---

## T6. Final Specimen Disposition Ledger

| Specimen | Category / Question | Disposition | Resolution Mechanism |
|---|---|---|---|
| **S1** | Average price per category | **CLOSED** | AST Gate rejects bare column; corrective retry exhausts to fallback (no fake global average). |
| **S1-LLM** | Double-quoted category AVG | **CLOSED** | AST Gate CASE 3 rejects bare column projection. |
| **S2** | Top 5 suppliers by count | **CLOSED** | `COUNT_BY_MARKER_REGEX` blocks false scalar plans. |
| **S3** | Multi-attribute grouping | **CLOSED** | Preposition guards block single-row aggregation. |
| **S4** | Filter dropping (VIP status) | **CLOSED** | b2(a) bind-or-decline rejects unbound filters across both tiers. |
| **S5** | Chinook revenue per country | **CLOSED (Safety)** | Silent-wrong eliminated via AST Gate (`ast_column_not_in_schema:T1.Country`); recovery open (0/2). |
| **S6** | Unhandled join relations | **OPEN** | Documented open edge; execution backstop prevents data corruption. |
| **S9** | Non-sensical boolean SUM | **CLOSED** | `result.sanity.js` intercepts scalar aggregate over `{0, 1}` flag columns. |
| **S10** | Semantic ranking without GROUP BY | **CLOSED** | A2 AST Gate provides structural check; M1 corrective retry provides recovery path. |
| **S11** | Order cancellation percentage | **CLOSED** | `fastIntent.js` compiles single-table ratio `ROUND(COUNT(...) * 100.0 / COUNT(*), 2)`. |
| **S12** | Abbreviated enterprise aliases (`stus`, `enrs`) | **DEFERRED** | Formally owned by **Part B Step 6 (Schema Extension Hook & Sub-Schema Pruner)**. |
| **S13** | Grade B categorical precision | **CLOSED & LOCKED** | Exact normalization preserves hyphen distinction (`B` = 5,541 vs `B-` = 265). |
| **S14** | Follow-up context alignment | **CLOSED** | Reclassified test-authoring bug; verified live in `verifyP3_2FollowUp.js`. |
| **S15** | Chinook track counts | **CLOSED** | Composite-PK functional dependency validated in AST Gate CASE 9c/9d. |
