// ============================================================
// SOURCE CONTROLLER (PART 5)
// Endpoints for Source CRUD, Pre-Flight Testing, DBA Script Generation, and Auto-Provisioning.
// Invariant:
//   - Raw passwords NEVER appear in any response payload or log.
//   - Reuses switch.orchestrator.js lease system for active source management.
// ============================================================

import { testConnection } from "../services/connection.tester.js";
import { generateDbaScript } from "../services/grant.script.generator.js";
import { autoProvisionReadOnlyUser } from "../services/auto.provisioner.js";
import { storeCredential, deleteCredential, resolveCredential } from "../security/credential.vault.js";
import { resolveCredentials } from "../config/credentials.js";
import {
  getRegisteredSources,
  getSourceById,
  registerSource,
  removeSource,
  syncSourcesFromStore
} from "../config/sources.js";
import { getActiveSource } from "../kernel/switch.orchestrator.js";
import { updateSourceStatus } from "../store/source.store.js";

function sanitizeSource(s) {
  if (!s) return null;
  const { password, apiKey, apiSecret, ...safe } = s;
  return safe;
}

export async function handleTestSource(req, res) {
  try {
    const { kind, dialect, host, port, user, password, database, path } = req.body || {};
    const result = await testConnection({
      kind,
      dialect,
      host,
      port,
      user,
      password,
      database,
      path
    });

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      errorCategory: "server_error",
      message: err.message
    });
  }
}

export async function handleGenerateScript(req, res) {
  try {
    const { kind, databaseName, readOnlyUsername, cognicoreServerIp } = req.body || {};
    const generated = generateDbaScript({
      kind,
      databaseName,
      readOnlyUsername,
      cognicoreServerIp
    });
    return res.status(200).json({
      success: true,
      ...generated
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

export async function handleAutoProvision(req, res) {
  // S17/VULN-07: Deprecated root privilege escalation endpoint
  if (process.env.ENABLE_AUTO_PROVISION !== "true") {
    return res.status(410).json({
      error: "deprecated",
      message: "Use the Connection Doctor grant script generator instead"
    });
  }

  try {
    const result = await autoProvisionReadOnlyUser(req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

export async function handleCreateSource(req, res) {
  try {
    const {
      name,
      kind,
      dialect: rawDialect,
      host,
      port,
      user,
      password,
      database,
      path
    } = req.body || {};

    const dialect = (rawDialect || kind || "").toLowerCase().trim();
    if (!name || !dialect) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name and kind/dialect are required."
      });
    }

    // 1. Mandatory Pre-Flight Verification
    const testRes = await testConnection({
      kind: dialect,
      host,
      port,
      user,
      password,
      database,
      path
    });

    if (!testRes.success) {
      return res.status(400).json({
        success: false,
        message: `Pre-flight connection test failed: ${testRes.message}`,
        errorCategory: testRes.errorCategory,
        driverCode: testRes.driverCode
      });
    }

    // 2. Vault credentials if password/user provided
    const sourceId = `src_${dialect}_${Date.now()}`;
    if (password || user) {
      await storeCredential(sourceId, {
        host: host || "127.0.0.1",
        port: port ? Number(port) : (dialect === "mariadb" ? 3306 : 5432),
        user: user || "",
        password: password || "",
        database: database || ""
      });
    }

    // 3. Register and persist source descriptor
    const descriptor = {
      id: sourceId,
      name,
      kind: dialect,
      dialect,
      credentialRef: (password || user) ? `vault:${sourceId}` : "env:sqlite",
      profileRef: dialect === "mariadb" ? "erpnext" : dialect,
      path: path || null,
      host: host || null,
      port: port ? Number(port) : null,
      database: database || null,
      status: "connected"
    };

    await registerSource(descriptor, { persist: true });

    return res.status(201).json({
      success: true,
      message: "Source created and verified successfully.",
      source: sanitizeSource(descriptor)
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to create source: " + err.message
    });
  }
}

export async function handleListSources(req, res) {
  try {
    await syncSourcesFromStore();
    const sources = getRegisteredSources().map(sanitizeSource);
    const active = sanitizeSource(getActiveSource());
    return res.status(200).json({
      success: true,
      activeSource: active,
      sources
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

export async function handleGetSource(req, res) {
  try {
    await syncSourcesFromStore();
    const { id } = req.params;
    const source = getSourceById(id);
    if (!source) {
      return res.status(404).json({ success: false, message: `Source "${id}" not found.` });
    }
    return res.status(200).json({
      success: true,
      source: sanitizeSource(source)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleRetestSource(req, res) {
  try {
    await syncSourcesFromStore();
    const { id } = req.params;
    const source = getSourceById(id);
    if (!source) {
      return res.status(404).json({ success: false, message: `Source "${id}" not found.` });
    }

    let creds = {};
    if (source.credentialRef?.startsWith("vault:")) {
      creds = resolveCredential(source.credentialRef.slice(6)) || {};
    } else {
      creds = resolveCredentials(source.credentialRef);
    }

    const testRes = await testConnection({
      kind: source.kind || source.dialect,
      host: source.host || creds.host,
      port: source.port || creds.port,
      user: creds.user,
      password: creds.password,
      database: source.database || creds.database,
      path: source.path
    });

    const newStatus = testRes.success ? "connected" : "error";
    await updateSourceStatus(id, newStatus);
    source.status = newStatus;

    return res.status(200).json({
      success: testRes.success,
      status: newStatus,
      testResult: testRes
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function handleDeleteSource(req, res) {
  try {
    const { id } = req.params;
    const source = getSourceById(id);
    if (!source) {
      return res.status(404).json({ success: false, message: `Source "${id}" not found.` });
    }

    // 1. Purge credentials from vault
    if (source.credentialRef?.startsWith("vault:")) {
      await deleteCredential(source.credentialRef.slice(6));
    }

    // 2. Remove source permanently from store and catalog
    await removeSource(id);

    return res.status(200).json({
      success: true,
      message: `Source "${id}" permanently deleted.`
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
}
