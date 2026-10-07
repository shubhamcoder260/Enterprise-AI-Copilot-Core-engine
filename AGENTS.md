# Agent Operational Guidelines & Autonomous Execution Policy

## 1. Autonomous Execution Principles
When working in this repository, operate autonomously on routine engineering workflows:
- **Proactive Implementation:** Proceed with file edits, code refactoring, and additions directly without asking conversational permission for routine steps.
- **Dependency & Build Management:** Run package installations (`npm install`), builds, and linters directly when needed.
- **Verification & Testing:** Automatically execute relevant test suites (e.g., `backend/test/` verification scripts) to validate changes before reporting completion.
- **End-to-End Problem Solving:** Diagnose errors, inspect logs, and apply fixes iteratively without pausing to ask intermediate confirmation questions.

## 2. Mandatory Human Approval Gates (Safety Stops)
Always pause and request explicit user confirmation before executing:
1. **Destructive Git Actions:** `git reset --hard`, `git push --force`, deleting unmerged branches, or discarding uncommitted user changes.
2. **Permanent Data Deletion:** Deleting databases, storage volumes, or recursive deletions (`rm -rf` / `Remove-Item -Recurse`) of existing project code directories.
3. **Cryptographically Frozen Files:** Modifying Tier-1 frozen files monitored by `backend/test/audit-freeze.js` without architectural consensus.
4. **Breaking Production Architectural Changes:** Changing core security invariants (such as fail-closed RLS policies or Action Gateway governance) without user agreement.

## 3. Project Architecture & Standards
- **7-Layer CAP Stack:** Respect layer separation (L1 Source Registry, L2 Protocol Adapters, L3 Dialect Engine, L4 Schema Introspection, L5 Semantic Mapping, L6 Truth & Safety Gates, L7 Source Experience).
- **Fail-Closed Security:** All security evaluations (RLS, AST validation, dialect matching) must fail closed.
- **Documentation Integrity:** Preserve all existing comments, docstrings, and architectural references unless explicitly requested to update them.
