// ============================================================================
// ACTION GATEWAY (CAP v2.2 §233, §283 — PHASE D5)
// Secure proposal / approval state machine for database writes.
// Enforces:
//   1. Explicit allowlisted templates only (write.templates.js)
//   2. RLS write policy validation (rls.policy.js)
//   3. Separation of duties (requester !== approver unless selfApproveEligible)
//   4. Mandatory dry-run preview capability
//   5. Cryptographic append-only audit logging (action.audit.log.js)
//   6. Isolated write adapters (src/adapters/write/)
// ============================================================================

import crypto from "node:crypto";
import { getTemplate } from "./write.templates.js";
import { evaluateRlsWritePolicy, RLS_VERDICT } from "./rls.policy.js";
import { actionAuditLog } from "../store/action.audit.log.js";
import { getWriteAdapter } from "../adapters/write/index.js";

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class ActionGateway {
  constructor(options = {}) {
    this._actions = new Map();
    this._defaultTtlMs = options.ttlMs || DEFAULT_TTL_MS;
  }

  /**
   * Proposes a new write action.
   * If dryRun is true, validates and returns the preview without persisting a PENDING action.
   * If dryRun is false, creates a PENDING action awaiting approval.
   *
   * @param {object} input
   * @param {string} input.templateId - ID of registered template
   * @param {string} input.targetTable - Target database table
   * @param {object} input.params - Bound parameter values
   * @param {object} input.requesterIdentity - Identity proposing the action
   * @param {boolean} [input.dryRun=true] - Whether to perform a dry run only
   * @param {string} [input.dialect='mariadb'] - Target SQL dialect
   * @param {object} [input.sourceDescriptor={}] - Connection details if needed
   * @returns {Promise<object>}
   */
  async proposeAction({
    templateId,
    targetTable,
    params = {},
    requesterIdentity,
    dryRun = true,
    dialect = "mariadb",
    sourceDescriptor = {}
  }) {
    // 1. RLS write policy check
    const rlsRes = evaluateRlsWritePolicy({
      templateId,
      targetTable,
      identity: requesterIdentity,
      params
    });

    if (rlsRes.verdict !== RLS_VERDICT.ALLOW) {
      const err = new Error(rlsRes.reason || "Action rejected by enterprise RLS write policy.");
      err.code = rlsRes.error || "RLS_WRITE_REJECTED";
      err.verdict = rlsRes.verdict;
      throw err;
    }

    const template = getTemplate(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found.`);
    }

    // 2. Obtain write adapter and generate preview
    const adapter = getWriteAdapter(dialect);
    const preview = await adapter.executeWrite(template, params, true);

    const actionId = crypto.randomUUID();

    // 3. Dry-run mode: log and return preview without creating PENDING state
    if (dryRun) {
      actionAuditLog.appendEntry({
        actionId,
        phase: "DRY_RUN",
        identity: requesterIdentity,
        templateId,
        targetTable,
        parameters: params,
        dryRun: true,
        executionResult: { status: "PREVIEW_GENERATED", estimatedRows: preview.estimatedRows }
      });

      return {
        actionId,
        status: "DRY_RUN",
        templateId,
        targetTable,
        selfApproveEligible: Boolean(template.selfApproveEligible),
        preview: {
          sql: preview.sql,
          params: preview.params,
          estimatedRows: preview.estimatedRows
        }
      };
    }

    // 4. Actual proposal: store in PENDING state
    const now = Date.now();
    const action = {
      actionId,
      templateId,
      targetTable,
      params: { ...params },
      requesterIdentity: { ...requesterIdentity },
      status: "PENDING",
      createdAt: now,
      expiresAt: now + this._defaultTtlMs,
      dialect,
      sourceDescriptor,
      selfApproveEligible: Boolean(template.selfApproveEligible),
      preview
    };

    this._actions.set(actionId, action);

    actionAuditLog.appendEntry({
      actionId,
      phase: "PROPOSAL",
      identity: requesterIdentity,
      templateId,
      targetTable,
      parameters: params,
      dryRun: false
    });

    return {
      actionId,
      status: "PENDING",
      templateId,
      targetTable,
      expiresAt: new Date(action.expiresAt).toISOString(),
      selfApproveEligible: action.selfApproveEligible,
      preview: {
        sql: preview.sql,
        params: preview.params,
        estimatedRows: preview.estimatedRows
      }
    };
  }

  /**
   * Approves a PENDING action.
   * Enforces Separation of Duties: approver !== requester (unless selfApproveEligible).
   *
   * @param {object} input
   * @param {string} input.actionId - ID of action to approve
   * @param {object} input.approverIdentity - Identity approving the action
   * @param {boolean} [input.executeImmediately=true] - Whether to execute write immediately
   * @returns {Promise<object>}
   */
  async approveAction({ actionId, approverIdentity, executeImmediately = true }) {
    if (!approverIdentity || !approverIdentity.userId) {
      throw new Error("Approver identity is required.");
    }

    const action = this._actions.get(actionId);
    if (!action) {
      throw new Error(`Action '${actionId}' not found.`);
    }

    if (action.status !== "PENDING") {
      throw new Error(`Cannot approve action with status '${action.status}'.`);
    }

    if (Date.now() > action.expiresAt) {
      action.status = "EXPIRED";
      throw new Error(`Action '${actionId}' has expired.`);
    }

    // Separation of Duties check
    if (approverIdentity.userId === action.requesterIdentity.userId && !action.selfApproveEligible) {
      const err = new Error("Separation of duties violation: Requester cannot approve their own action.");
      err.code = "SEPARATION_OF_DUTIES_VIOLATION";
      throw err;
    }

    // Role check for approval
    const userRoles = new Set(approverIdentity.roles || []);
    const isExecutiveOrHr = userRoles.has("Executive") || userRoles.has("HR Manager");
    const isSalesManager = userRoles.has("Sales Manager");

    if (action.templateId === "UPDATE_ORDER_STATUS" && !isSalesManager && !isExecutiveOrHr) {
      const err = new Error("Approval requires Sales Manager or Executive role.");
      err.code = "APPROVAL_UNAUTHORIZED";
      throw err;
    }

    action.status = "APPROVED";
    action.approverIdentity = { ...approverIdentity };
    action.approvedAt = Date.now();

    actionAuditLog.appendEntry({
      actionId,
      phase: "APPROVAL",
      identity: approverIdentity,
      templateId: action.templateId,
      targetTable: action.targetTable,
      parameters: action.params,
      dryRun: false
    });

    if (executeImmediately) {
      return await this.executeAction({ actionId, executorIdentity: approverIdentity });
    }

    return {
      actionId,
      status: "APPROVED"
    };
  }

  /**
   * Rejects a PENDING action.
   *
   * @param {object} input
   * @param {string} input.actionId - ID of action to reject
   * @param {object} input.rejecterIdentity - Identity rejecting the action
   * @param {string} [input.reason] - Reason for rejection
   * @returns {object}
   */
  rejectAction({ actionId, rejecterIdentity, reason = "Administrative rejection" }) {
    if (!rejecterIdentity || !rejecterIdentity.userId) {
      throw new Error("Rejecter identity is required.");
    }

    const action = this._actions.get(actionId);
    if (!action) {
      throw new Error(`Action '${actionId}' not found.`);
    }

    if (action.status !== "PENDING") {
      throw new Error(`Cannot reject action with status '${action.status}'.`);
    }

    if (Date.now() > action.expiresAt) {
      action.status = "EXPIRED";
      throw new Error(`Action '${actionId}' has expired.`);
    }

    action.status = "REJECTED";
    action.rejecterIdentity = { ...rejecterIdentity };
    action.rejectReason = reason;
    action.rejectedAt = Date.now();

    actionAuditLog.appendEntry({
      actionId,
      phase: "REJECTION",
      identity: rejecterIdentity,
      templateId: action.templateId,
      targetTable: action.targetTable,
      parameters: action.params,
      executionResult: { reason },
      dryRun: false
    });

    return {
      actionId,
      status: "REJECTED",
      reason
    };
  }

  /**
   * Executes an APPROVED action through write adapter.
   *
   * @param {object} input
   * @param {string} input.actionId - ID of approved action
   * @param {object} [input.executorIdentity] - Identity executing the write
   * @returns {Promise<object>}
   */
  async executeAction({ actionId, executorIdentity }) {
    const action = this._actions.get(actionId);
    if (!action) {
      throw new Error(`Action '${actionId}' not found.`);
    }

    if (action.status !== "APPROVED") {
      throw new Error(`Cannot execute action with status '${action.status}'. Action must be APPROVED.`);
    }

    if (Date.now() > action.expiresAt) {
      action.status = "EXPIRED";
      throw new Error(`Action '${actionId}' has expired.`);
    }

    const template = getTemplate(action.templateId);
    const adapter = getWriteAdapter(action.dialect);

    const execRes = await adapter.executeWrite(template, action.params, false);

    action.status = "EXECUTED";
    action.executedAt = Date.now();
    action.executionResult = execRes;

    const auditEntry = actionAuditLog.appendEntry({
      actionId,
      phase: "EXECUTION",
      identity: executorIdentity || action.approverIdentity,
      templateId: action.templateId,
      targetTable: action.targetTable,
      parameters: action.params,
      executionResult: {
        status: "SUCCESS",
        affectedRows: execRes.affectedRows,
        durationMs: execRes.durationMs
      },
      dryRun: false
    });

    return {
      actionId,
      status: "EXECUTED",
      affectedRows: execRes.affectedRows,
      durationMs: execRes.durationMs,
      auditEntryId: auditEntry.contentHash
    };
  }

  /**
   * Retrieves an action by ID.
   *
   * @param {string} actionId
   * @returns {object|null}
   */
  getAction(actionId) {
    const action = this._actions.get(actionId);
    return action ? { ...action } : null;
  }

  /**
   * Lists actions with optional status filter.
   *
   * @param {object} [filter]
   * @returns {Array<object>}
   */
  listActions(filter = {}) {
    let result = Array.from(this._actions.values());
    if (filter.status) {
      result = result.filter(a => a.status === filter.status);
    }
    return result.map(a => ({ ...a }));
  }

  clear() {
    this._actions.clear();
  }
}

export const actionGateway = new ActionGateway();
