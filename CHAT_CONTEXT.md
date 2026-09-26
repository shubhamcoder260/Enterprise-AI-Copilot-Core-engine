# CogniCore Chat Context

This handoff summarizes the conversations and code review on 2026-09-23 so a later Codex chat can resume with the necessary context.

## Conversation history

1. The user greeted Codex and then indicated a project path as `cd/Documents/Cognicore`. That path did not exist in the environment.
2. The repository was located at `/home/shubh/Documents/project/cognicore`. The application is under `/home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project`.
3. The user asked for a full codebase analysis. Codex performed a static review and reported the architecture, high-priority security concerns, and review limits. No source files were changed for that analysis, and no tests were run.
4. The user asked whether Codex would remember the chat after closing and reopening. Codex explained that full chat context might not persist and offered to save a handoff.
5. The user asked for a detailed, understandable summary saved into the project. This document is that handoff.

## Repository location and working rules

- Repository root: `/home/shubh/Documents/project/cognicore`
- Main application: `/home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project`
- Project guidance: `/home/shubh/Documents/project/cognicore/AGENTS.md`
- Main project docs: `Cognicore/README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `GETTING_STARTED.md`, `TESTING.md`, `MASTER_CONTEXT.md`, and `ROADMAP.md`.
- The root `AGENTS.md` requires confirmation before destructive operations, edits outside `/home/shubh/Documents/project/cognicore/`, or changes to frozen files. It identifies `backend/src/llm/sql.validator.js` and `backend/src/kernel/ast.gate.js` as frozen examples.
- At review time, `git status --short` showed `.gitignore`, `AGENTS.md`, `Cognicore/`, and `student_erp.db` as untracked. There was no tracked baseline to compare the code against. Recheck current status before continuing; the workspace may have changed.

## Project structure and architecture

```text
/home/shubh/Documents/project/cognicore/
├── AGENTS.md
├── .gitignore
├── student_erp.db
└── Cognicore/
    ├── README.md
    ├── ARCHITECTURE.md
    ├── SECURITY.md
    ├── GETTING_STARTED.md
    ├── TESTING.md
    ├── MASTER_CONTEXT.md
    ├── ROADMAP.md
    ├── docs/
    │   ├── AUDIT_REPORT.md
    │   ├── PART_A_RECORD.md
    │   └── PART_B_RECORD.md
    ├── test/                         # top-level verification scripts
    └── CogniCore_Project/
        ├── frontend/                 # React + Vite client
        │   ├── src/main.jsx
        │   ├── src/style.css
        │   ├── src/lib/api.js
        │   ├── src/lib/formatRenderers.jsx
        │   └── src/components/
        │       ├── ChatWindow.jsx
        │       ├── DatabaseSidebar.jsx
        │       ├── SqlModal.jsx
        │       └── Visualizer.jsx
        └── backend/                  # Express + SQLite + local Ollama
            ├── src/server.js
            ├── src/controllers/
            │   ├── ai.controller.js
            │   └── database.controller.js
            ├── src/routes/
            │   ├── ai.routes.js
            │   └── database.routes.js
            ├── src/config/
            │   ├── database.js
            │   └── semantic.profile.js
            ├── src/core/             # query orchestration, schema, SQL, formatters
            │   ├── links/            # tool, dynamic, LLM, fallback handlers
            │   └── ...
            ├── src/kernel/           # pipeline, result contract, gates, format registry
            ├── src/llm/              # Ollama client, prompt, validator, formatter
            ├── src/store/history.store.js
            ├── src/tools/             # education and hospital domain handlers
            └── test/                  # many standalone verification scripts
```

The frontend sends a natural-language question and session ID to Express. The backend runs the query through a four-link cascade: domain-specific tools, the deterministic/dynamic query engine, a local Ollama model, and a schema-based fallback. The LLM path builds a prompt from schema and recent conversation history, validates generated SQL, checks SQL structure against schema, executes it on a read-only SQLite connection, checks result plausibility, and formats a response. The app also supports database uploads, database switching, persistent chat history, and table/KPI/CSV/chart/report renderers.

There are numerous standalone backend verification scripts. `package.json` does not define a conventional test script; the project docs describe invoking tests manually. The previous review did not run them.

## Code inspected during the review

The review covered project guidance and overview/security/architecture documentation; backend route and controller flow; database connection and switch lifecycle; core pipeline and handler contracts; dynamic query routing, planning, and execution; SQL validation and AST gate; LLM client and link; schema reading and result sanity checks; history storage; and frontend API, session handling, database upload UI, chat UI, and chart rendering. It also consulted the existing `docs/AUDIT_REPORT.md` and `MASTER_CONTEXT.md` as project claims and known-issue records, not as independent proof that every claim is current.

## Findings from the static review

These are code-inspection findings. Their runtime impact depends partly on deployment and network exposure.

### 1. High priority: API operations have no authentication and CORS is permissive

`backend/src/server.js` uses `app.use(cors())` and mounts query, history, upload, and database-switch endpoints without an authentication layer. It calls `app.listen(PORT)` without an explicit host restriction. If the backend is reachable from other devices or browser origins, those callers may be able to query the active database, read histories, upload files, or switch databases. Verify actual network exposure before assessing deployment impact, but the routes themselves have no authentication checks.

Relevant files: `backend/src/server.js`, `backend/src/routes/ai.routes.js`, `backend/src/routes/database.routes.js`.

### 2. High priority: callers can request a database switch to an arbitrary existing path

`switchActiveDatabase` accepts `databasePath` from the request and sends it to `switchDatabase`; it does not restrict the path to the upload directory or check that it is a usable SQLite database before the switch. The active-database endpoint returns the full path. Combined with an unauthenticated API, this can expose local database contents through later query requests.

Relevant file: `backend/src/controllers/database.controller.js`, especially `switchActiveDatabase` and `getActiveDatabase`; route registration is in `backend/src/routes/database.routes.js`.

### 3. Medium priority: physical read-only execution is not consistent across all dynamic paths

Fast-intent query plans set `readOnly: true`, and the LLM path uses the gate chain’s read-only executor. The heuristic plans returned from `sql.builder.js` do not set that flag. `query.executor.js` therefore uses the ordinary `connectDatabase()` connection for those plans. The builder constructs SQL internally, so this is not evidence of a direct user-SQL injection path; it is a discrepancy with the broad claim that all dynamic SQL is protected by the SQLite read-only driver.

Also, `dynamic.query.engine.js` runs `validateAndSanitizeSql(fastPlan.sql)` but then executes and reports `fastPlan.sql` rather than `validation.sql`. The fast router appears to produce internally shaped SQL, but the sanitizer’s output is not the statement passed onward.

Relevant files: `backend/src/core/dynamic.query.engine.js`, `backend/src/core/query.executor.js`, `backend/src/core/sql.builder.js`, `backend/src/kernel/gate.chain.js`.

### 4. Medium priority: a failed database switch can leave the app without a working connection

`doSwitchDatabase` closes existing connections and changes the active path before it tries to connect to the new database. Upload checks the SQLite magic header but does not prove that the database can be opened and queried before committing the switch. If connection fails, the former connection is already closed and the active path already changed. In addition, `saveActiveDatabasePath` catches and suppresses persistence errors, so a switch may appear successful even if the config was not written.

Relevant files: `backend/src/config/database.js`, `backend/src/controllers/database.controller.js`.

### 5. Medium priority: history has no ownership or authentication check

The query endpoint accepts a session ID supplied by the client, and `/api/history/:sessionId` returns up to 100 records for the requested ID. There is no login or ownership association. Session IDs are identifiers, not authorization credentials, in this implementation. Anyone who can reach the endpoint and obtain/guess an ID can request that session’s history.

Relevant files: `backend/src/controllers/ai.controller.js`, `backend/src/store/history.store.js`, and `frontend/src/lib/api.js`.

### 6. Low/conditional priority: chart error UI uses an HTML injection sink

`frontend/src/lib/formatRenderers.jsx` places `err.message` into a string assigned to `containerRef.current.innerHTML`. If an exception message includes attacker-controlled content, this could permit DOM injection. The review did not establish a concrete exploit path through Vega’s errors. Rendering the message as text instead of HTML would remove the unsafe sink.

Relevant file: `frontend/src/lib/formatRenderers.jsx`, in `VegaLiteChart`’s synchronous compilation catch handler.

## Project claims and caveats to retain

- `MASTER_CONTEXT.md` documents known AST gate limitations, including softened CTE column checks and expression bare-column edge cases. Do not describe the SQL gate as proving all possible SQL behavior safe.
- The docs broadly claim physical read-only execution for dynamic/LLM SQL; compare that claim with finding 3 above.
- `sql.validator.js` and `ast.gate.js` are marked frozen by project instructions. Do not edit those files unless the user explicitly authorizes the change and applicable review requirements are met.
- The project docs report historical test metrics and closed issues. The prior review did not independently reproduce those results.

## Review limits and how to continue

- The review was static. No tests, benchmarks, production build, server launch, HTTP requests, or live Ollama checks were run.
- No code fixes were made during the review.
- At the beginning of a later chat, inspect current `git status`, reread the applicable `AGENTS.md`, and verify that findings still match the current source.
- If asked to implement fixes, first handle API/network exposure and database-path constraints, then make switching transactional and make read-only execution consistent. Add or run targeted regression checks when requested. Keep the frozen-file rule in mind and only claim checks that were actually run.
