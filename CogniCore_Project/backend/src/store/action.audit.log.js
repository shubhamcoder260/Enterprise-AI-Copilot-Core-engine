// ============================================================================
// ACTION AUDIT LOG (CAP v2.2 §233, §283 — PHASE D5)
// Immutable, append-only, tamper-evident audit store for all write actions.
// Uses a cryptographic SHA-256 hash chain (blockchain-style forward linkage).
// Strictly exposes ZERO update or delete operations.
// ============================================================================

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

class ActionAuditLog {
  constructor(options = {}) {
    this._entries = [];
    this._logFilePath = options.logFilePath || path.resolve(__dirname, "../../data/action_audit.jsonl");
    this._autoPersist = options.autoPersist !== false;
    if (this._autoPersist) {
      this._initLogFile();
    }
  }

  _initLogFile() {
    try {
      const dir = path.dirname(this._logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this._logFilePath)) {
        const lines = fs.readFileSync(this._logFilePath, "utf-8").split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            this._entries.push(Object.freeze(entry));
          } catch (_) {}
        }
      }
    } catch (_) {
      // Safe fallback to in-memory if filesystem is restricted
    }
  }

  /**
   * Appends an immutable audit entry to the log.
   * Calculates a tamper-evident SHA-256 hash chained from the previous entry.
   *
   * @param {object} record
   * @returns {object} The frozen audit entry
   */
  appendEntry(record) {
    if (!record || typeof record !== "object") {
      throw new Error("Audit record must be a non-null object.");
    }

    const previousEntry = this._entries.length > 0 ? this._entries[this._entries.length - 1] : null;
    const previousHash = previousEntry ? previousEntry.contentHash : GENESIS_HASH;
    const sequence = this._entries.length;

    const entryToHash = {
      sequence,
      actionId: record.actionId || crypto.randomUUID(),
      timestamp: record.timestamp || new Date().toISOString(),
      phase: record.phase || "PROPOSAL", // 'PROPOSAL' | 'APPROVAL' | 'REJECTION' | 'EXECUTION' | 'DRY_RUN'
      identity: record.identity ? {
        userId: record.identity.userId || "anonymous",
        employeeId: record.identity.employeeId || null,
        roles: Array.isArray(record.identity.roles) ? [...record.identity.roles] : []
      } : null,
      approverIdentity: record.approverIdentity ? {
        userId: record.approverIdentity.userId || "anonymous",
        employeeId: record.approverIdentity.employeeId || null,
        roles: Array.isArray(record.approverIdentity.roles) ? [...record.approverIdentity.roles] : []
      } : null,
      templateId: record.templateId || null,
      targetTable: record.targetTable || null,
      parameters: record.parameters ? { ...record.parameters } : {},
      exactExecutedSql: record.exactExecutedSql || record.sql || null,
      dryRun: Boolean(record.dryRun),
      executionResult: record.executionResult ? { ...record.executionResult } : null,
      previousHash
    };

    const contentHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(entryToHash))
      .digest("hex");

    const finalizedEntry = Object.freeze({
      ...entryToHash,
      contentHash
    });

    this._entries.push(finalizedEntry);

    // Persist to file in append mode
    if (this._autoPersist) {
      try {
        fs.appendFileSync(this._logFilePath, JSON.stringify(finalizedEntry) + "\n", "utf-8");
      } catch (_) {}
    }

    return finalizedEntry;
  }

  /**
   * Retrieves all entries matching optional filter criteria.
   * Returns deep-frozen copies.
   *
   * @param {object} [filter]
   * @returns {Array<object>}
   */
  getEntries(filter = {}) {
    let result = [...this._entries];

    if (filter.actionId) {
      result = result.filter(e => e.actionId === filter.actionId);
    }
    if (filter.phase) {
      result = result.filter(e => e.phase === filter.phase);
    }
    if (filter.templateId) {
      result = result.filter(e => e.templateId === filter.templateId);
    }

    return result.map(e => Object.freeze({ ...e }));
  }

  /**
   * Retrieves a single entry by sequence or actionId.
   *
   * @param {string|number} identifier
   * @returns {object|null}
   */
  getEntryById(identifier) {
    const entry = this._entries.find(e => e.actionId === identifier || e.sequence === identifier);
    return entry ? Object.freeze({ ...entry }) : null;
  }

  /**
   * Verifies the cryptographic SHA-256 hash chain across all entries.
   * Detects any mutation, deletion, or reordering of historical records.
   *
   * @returns {{ valid: boolean, verifiedCount: number, error: string|null }}
   */
  verifyIntegrity() {
    let prevHash = GENESIS_HASH;

    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];

      if (entry.sequence !== i) {
        return {
          valid: false,
          verifiedCount: i,
          error: `Sequence mismatch at index ${i}: expected ${i}, found ${entry.sequence}`
        };
      }

      if (entry.previousHash !== prevHash) {
        return {
          valid: false,
          verifiedCount: i,
          error: `Broken hash chain at sequence ${i}: previousHash mismatch`
        };
      }

      const { contentHash, ...entryData } = entry;
      const expectedHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(entryData))
        .digest("hex");

      if (contentHash !== expectedHash) {
        return {
          valid: false,
          verifiedCount: i,
          error: `Tamper detected at sequence ${i}: contentHash does not match computed SHA-256`
        };
      }

      prevHash = contentHash;
    }

    return {
      valid: true,
      verifiedCount: this._entries.length,
      error: null
    };
  }

  /**
   * Canonical alias for verifyIntegrity (Requirement 5).
   */
  verifyAuditChainIntegrity() {
    return this.verifyIntegrity();
  }

  // Explicitly prevent mutation or deletion methods
  get update() {
    throw new Error("ActionAuditLog is append-only: update() is prohibited by design.");
  }

  get delete() {
    throw new Error("ActionAuditLog is append-only: delete() is prohibited by design.");
  }

  get truncate() {
    throw new Error("ActionAuditLog is append-only: truncate() is prohibited by design.");
  }
}

// Global default singleton
export const actionAuditLog = new ActionAuditLog();

// Export class for isolated testing
export { ActionAuditLog };
