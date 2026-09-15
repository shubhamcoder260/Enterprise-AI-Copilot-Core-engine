# Security Model — Two Independent Layers
**Layer 1 (logical):** frozen validator — SELECT/WITH only, 16-keyword blocklist, no comments,
no multi-statement, LIMIT clamped to 50 (SQLite LIMIT -1 trap), ReDoS-safe. 37/37 adversarial.
**Layer 2 (physical):** all dynamic/LLM SQL runs on a connection opened OPEN_READONLY —
the driver itself refuses writes even if Layer 1 is bypassed (verified live).
Infra: atomic config writes, serialized DB-switch queue, upload header validation, JSON errors.
Threat: "LLM writes DROP TABLE" → validator rejects; if bypassed → SQLITE_READONLY; data intact.
Every answer shows its exact SQL — nothing hidden.
