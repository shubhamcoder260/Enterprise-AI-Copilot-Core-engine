// ============================================================================
// ACTION CONTROLLER (CAP v2.2 §233, §283 — PHASE D5)
// HTTP endpoints for propose, approve, reject write actions.
// Enforces that writes CANNOT bypass ActionGateway.
// ============================================================================

import { actionGateway } from "../security/action.gateway.js";
import { actionAuditLog } from "../store/action.audit.log.js";
import { listTemplates, getTemplate } from "../security/write.templates.js";

function resolveIdentity(req) {
  if (req.body?.identity && typeof req.body.identity === "object") {
    return req.body.identity;
  }
  const userId = req.headers["x-user-id"] || req.headers["x-cognicore-user"];
  const rolesHeader = req.headers["x-user-roles"] || req.headers["x-cognicore-roles"];
  const employeeId = req.headers["x-employee-id"] || req.headers["x-cognicore-employee"];

  if (userId) {
    return {
      userId: String(userId),
      employeeId: employeeId ? String(employeeId) : null,
      roles: rolesHeader ? String(rolesHeader).split(",").map(r => r.trim()).filter(Boolean) : []
    };
  }

  return null;
}

export async function proposeAction(req, res) {
  try {
    const { templateId, targetTable, params, dryRun = true, dialect = "mariadb" } = req.body || {};
    const requesterIdentity = resolveIdentity(req);

    if (!requesterIdentity) {
      return res.status(401).json({
        success: false,
        error: "rls_write_unauthenticated:missing_identity",
        message: "Authentication context is required for write proposals."
      });
    }

    const result = await actionGateway.proposeAction({
      templateId,
      targetTable,
      params,
      requesterIdentity,
      dryRun: Boolean(dryRun),
      dialect
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    const isRls = err.verdict || err.code?.startsWith("rls_write") || err.code?.startsWith("RLS");
    const status = isRls ? 403 : 400;

    return res.status(status).json({
      success: false,
      error: err.code || "PROPOSAL_FAILED",
      message: err.message
    });
  }
}

export async function approveAction(req, res) {
  try {
    const actionId = req.params.id;
    const { executeImmediately = true } = req.body || {};
    const approverIdentity = resolveIdentity(req);

    if (!approverIdentity) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHENTICATED",
        message: "Authentication context is required to approve actions."
      });
    }

    const result = await actionGateway.approveAction({
      actionId,
      approverIdentity,
      executeImmediately: Boolean(executeImmediately)
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    if (err.code === "SEPARATION_OF_DUTIES_VIOLATION" || err.code === "APPROVAL_UNAUTHORIZED") {
      return res.status(403).json({
        success: false,
        error: err.code,
        message: err.message
      });
    }

    if (err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: err.message
      });
    }

    if (err.message.includes("expired")) {
      return res.status(410).json({
        success: false,
        error: "ACTION_EXPIRED",
        message: err.message
      });
    }

    return res.status(400).json({
      success: false,
      error: err.code || "APPROVAL_FAILED",
      message: err.message
    });
  }
}

export async function rejectAction(req, res) {
  try {
    const actionId = req.params.id;
    const { reason = "Administrative rejection" } = req.body || {};
    const rejecterIdentity = resolveIdentity(req);

    if (!rejecterIdentity) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHENTICATED",
        message: "Authentication context is required to reject actions."
      });
    }

    const result = actionGateway.rejectAction({
      actionId,
      rejecterIdentity,
      reason
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: err.message
      });
    }

    return res.status(400).json({
      success: false,
      error: err.code || "REJECTION_FAILED",
      message: err.message
    });
  }
}

export async function listActionTemplates(req, res) {
  return res.status(200).json({
    success: true,
    data: listTemplates()
  });
}

export async function getActionAuditLog(req, res) {
  const integrity = actionAuditLog.verifyIntegrity();
  const entries = actionAuditLog.getEntries();

  return res.status(200).json({
    success: true,
    integrity,
    entriesCount: entries.length,
    entries
  });
}
