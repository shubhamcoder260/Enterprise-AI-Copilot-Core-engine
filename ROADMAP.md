# CogniCore Engineering Roadmap

## Overview
CogniCore is developed under an evidence-driven architecture where reliability, structural honesty, and deterministic guarantees precede expressiveness.

- **Part A (Base Completion — The Bedrock):** Structural hygiene, honesty guards, AST gate, orphaned specimen resolution (S1–S11, S13–S15).
- **Part B (Additions & Expressiveness):** Polymorphic formatters, schema extension hooks, generative visualization, and frontend componentization.

---

## Deferred Specimen Ownership

### Specimen S12 — The Synonym Wall (Abbreviated Enterprise Schemas)
- **Specimen ID:** S12
- **Description:** Queries targeting legacy or heavily abbreviated enterprise schemas where table and column names use non-standard contractions or domain abbreviations.
- **Representative Examples:**
  - `stus` → `students`
  - `enrs` → `enrollments`
  - `mcs` → `machines`
  - `rst` → `restaurants`
  - `accts` → `accounts`
- **Resolution Strategy:** Formally **DEFERRED** to **Part B Step 6 (Schema Extension Hook & Sub-Schema Pruner)**.
- **Architectural Rationale:**
  - Ad-hoc regex aliases or fuzzy token matching in the core parsing engine introduce dangerous false positives, schema pollution, and potential security boundary bypasses.
  - Correct enterprise handling requires an explicit, structured `schemaExtensions` configuration hook in `schema.reader.js`, allowing administrators to supply authoritative synonym dictionaries and business entity mappings alongside top-K sub-schema pruning for 300+ table schemas.
  - S12 is tracked as an intentional architectural handoff to Part B Step 6, not an unaddressed defect.
