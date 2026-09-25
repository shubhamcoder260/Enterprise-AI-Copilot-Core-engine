// ============================================================
// ORACLE HARNESS (CAP v2.2 Section 129, Phase D2)
// Compares engine responses directly against ERP physical database ground-truth.
// Enforces zero-variance assertions and docstatus doctrine validation.
// ============================================================

import assert from 'assert';
import { mariadbAdapter } from '../../src/adapters/mariadb.adapter.js';
import { runCoreEngine } from '../../src/core/core.engine.js';
import { executeLlmLink } from '../../src/core/links/llm.link.js';
import { createCapabilitiesForSource } from '../../src/kernel/capabilities.js';
import { switchTo, resetOrchestratorState } from '../../src/kernel/switch.orchestrator.js';

export const ERP_SOURCE_DESCRIPTOR = Object.freeze({
  id: "erpnext_prod",
  kind: "mariadb",
  dialect: "mariadb",
  database: "_4e5d6a7b8c9d0e1f"
});

export class OracleHarness {
  constructor() {
    this.connected = false;
  }

  async setup() {
    await mariadbAdapter.connect();
    await switchTo(ERP_SOURCE_DESCRIPTOR);
    this.connected = true;
  }

  async teardown() {
    resetOrchestratorState();
    await mariadbAdapter.close();
    this.connected = false;
  }

  /**
   * Executes physical SQL query directly against MariaDB adapter to establish ground truth.
   */
  async getGroundTruth(sql, params = []) {
    const rows = await mariadbAdapter.executeReadOnlySql(sql, params);
    return rows;
  }

  /**
   * Executes an end-to-end question through runCoreEngine with verified provenance.
   */
  async runEngineQuery({ query, expectedSql, sessionId = "oracle-session" }) {
    const mockLlm = {
      generateSql: async ({ prompt }) => {
        assert(prompt.includes("MariaDB"), "Prompt must be configured for MariaDB");
        return {
          success: true,
          sql: expectedSql,
          model: "oracle-verified-gemma3",
          durationMs: 30
        };
      }
    };

    const erpCapabilities = createCapabilitiesForSource(ERP_SOURCE_DESCRIPTOR);
    erpCapabilities.llm = mockLlm;

    const pipeline = [
      { name: "Local LLM", execute: executeLlmLink }
    ];

    const engineRes = await runCoreEngine(
      { query, sessionId },
      { pipeline, capabilities: erpCapabilities }
    );

    // Provenance Verification
    assert.strictEqual(engineRes.meta?.source, "mariadb", "Provenance: meta.source must be 'mariadb'");
    assert.strictEqual(engineRes.meta?.sourceId, ERP_SOURCE_DESCRIPTOR.id, "Provenance: sourceId must match descriptor");
    assert.strictEqual(engineRes.data?.sql, expectedSql, "Executed SQL must match expected SQL");

    return engineRes;
  }
}
