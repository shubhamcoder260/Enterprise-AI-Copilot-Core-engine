# CogniCore

CogniCore is a local analytics project built around a Node.js backend and a React frontend. The app is organized around natural-language database querying, LLM-assisted SQL generation, validation, and structured result presentation.

The repository contains:

- an Express API in the backend
- a Vite + React frontend for chat and output rendering
- SQLite database switching and configuration handling
- local LLM integration hooks
- validation and routing logic for generated SQL
- project docs and verification scripts

## Current project layout

The active application code lives under:

- [CogniCore_Project/backend](CogniCore_Project/backend)
- [CogniCore_Project/frontend](CogniCore_Project/frontend)
- [CogniCore_Project/docs](CogniCore_Project/docs)
- [CogniCore_Project/test](CogniCore_Project/test)

## Main project docs

- [MASTER_CONTEXT.md](MASTER_CONTEXT.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SECURITY.md](SECURITY.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [TESTING.md](TESTING.md)

## What the codebase currently does

- accepts user queries over HTTP
- routes requests through backend logic and pipeline modules
- sends query tasks to local model infrastructure when configured
- validates generated SQL before execution
- renders SQL and result data in the UI
- allows switching the active database at runtime

## Status

This is an active engineering project with a defined architecture and a working prototype structure. It is not presented here as a fully hardened production system.
