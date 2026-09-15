# CogniCore — Enterprise AI Copilot Core Engine

On-premises conversational analytics engine. Upload any SQLite database, ask
questions in plain English, get grounded answers with the exact SQL shown —
computed by a locally-hosted LLM (Ollama). **Zero data egress. Physically
read-only execution.**

## Why
Choose between brittle BI dashboards and cloud-LLM tools that leak data.
CogniCore is the third option: all intelligence local, mathematically grounded,
structurally safe.

## Features
- 🗄️ Any SQLite DB — upload & runtime switch, no restart
- 🧠 Local LLM via Ollama (model-agnostic seam)
- 🛡️ Dual-layer safety: frozen SQL validator (37/37 adversarial) + driver-enforced read-only
- 🔗 4-link soft-cascade: tools → dynamic router → LLM → schema-aware fallback (255ms failover)
- 💬 Conversation memory: multi-turn context, session persistence, history hydration
- 🔍 Transparency: every answer ships its SQL, source badge, latency
- 🧪 Evidence-driven: 36+ verification scripts, 8-suite canonical regression

## Quick Start
See [GETTING_STARTED.md](GETTING_STARTED.md) · Architecture: [ARCHITECTURE.md](ARCHITECTURE.md) ·
Safety: [SECURITY.md](SECURITY.md) · Testing: [TESTING.md](TESTING.md)

## Status
v1.5 — kernel base complete (4 enforced seams: handler vocabulary, pipeline-as-config,
gate chain, capabilities). Feature era in progress.
