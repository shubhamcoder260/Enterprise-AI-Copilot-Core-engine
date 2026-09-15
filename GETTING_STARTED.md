# Getting Started
## Prerequisites
- Node.js ≥ 20 (ES Modules) · Ollama (ollama.com) · SQLite CLI
## Install
1. `ollama pull gemma3:4b` then `ollama serve`
2. Backend: `cd CogniCore_Project/backend && npm install && cp .env.example .env`
3. Frontend: `cd ../frontend && npm install`
## Run
- Terminal 1: `cd CogniCore_Project/backend && npm start`  → :5000
- Terminal 2: `cd CogniCore_Project/frontend && npm run dev` → open shown URL
## First Query
Upload any .db via the sidebar (or use bundled fixtures/), ask: "How many records are in <table>?"
## Config (.env)
PORT=5000 · ENABLE_LOCAL_LLM=true · LOCAL_LLM_URL=http://localhost:11434 ·
LOCAL_LLM_MODEL=gemma3:4b · LOCAL_LLM_TIMEOUT_MS=15000 · LOCAL_LLM_KEEP_ALIVE=30m
## Testing
cd CogniCore_Project/backend && npm start (server) then: bash test/verifyFullRegression.sh
CPU inference: 9–15s per LLM query; deterministic router <100ms. GPU recommended for large schemas.
