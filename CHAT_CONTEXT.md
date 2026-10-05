# CogniCore Chat Context

This is the continuity note for the project. It is meant to preserve the current working understanding of the repo without relying on stale memory or historical narrative.

## 1. Workspace

Repository root:

- /home/shubh/Documents/project/cognicore

Application root:

- /home/shubh/Documents/project/cognicore/Cognicore/CogniCore_Project

Relevant files for context:

- [Cognicore/MASTER_CONTEXT.md](Cognicore/MASTER_CONTEXT.md)
- [Cognicore/ARCHITECTURE.md](Cognicore/ARCHITECTURE.md)
- [Cognicore/SECURITY.md](Cognicore/SECURITY.md)
- [Cognicore/CogniCore_Project/PROJECT_CONTEXT.md](Cognicore/CogniCore_Project/PROJECT_CONTEXT.md)
- [AGENTS.md](AGENTS.md)

## 2. What the codebase currently contains

The repo contains a backend API and a frontend interface for database-related queries.

The main project structure is:

- Express-based backend
- React/Vite frontend
- SQLite-oriented data access and switching logic
- route and controller logic for query handling
- validation modules for generated SQL
- local LLM integration hooks

## 3. Working interpretation

The current implementation appears designed to:

- accept queries from a frontend or API client
- route those queries through backend logic
- use model-based assistance when configured
- validate generated SQL before execution
- return answers along with visible SQL and result context

This is the working interpretation supported by the actual source structure, not a polished product claim.

## 4. Source of truth

Use the implementation as the authority:

1. active source files in backend/ and frontend/
2. project architecture notes
3. continuity notes
4. historical or generated narrative

If a document and the code disagree, the code wins.

## 5. Practical guidance

When continuing work:

- start with the server and route files
- verify assumptions against the implementation
- avoid reading historical docs as absolute fact
- keep language precise and evidence-based

## 6. Summary

This project is an active engineering codebase with a layered backend/frontend structure, query handling logic, and guardrail code. It should be treated as a working implementation, not as a final product narrative or a guaranteed hardened system.
