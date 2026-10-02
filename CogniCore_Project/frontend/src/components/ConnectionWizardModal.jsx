import React, { useState } from "react";
import {
  testSourceConnection,
  generateGrantScript,
  autoProvisionSource,
  createSource
} from "../lib/api.js";

export default function ConnectionWizardModal({ isOpen, onClose, onSourceAdded }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState("direct"); // 'direct' | 'autoprovision' | 'script'
  const [dialect, setDialect] = useState("mariadb"); // 'mariadb' | 'postgres' | 'sqlite'
  const [name, setName] = useState("");

  // Direct Credential Fields
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("3307");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("cognicore_ro");
  const [password, setPassword] = useState("");
  const [pathVal, setPathVal] = useState("");

  // Auto-provision fields
  const [adminUser, setAdminUser] = useState("root");
  const [adminPassword, setAdminPassword] = useState("");
  const [roUser, setRoUser] = useState("cognicore_ro");
  const [roPassword, setRoPassword] = useState("");

  // Script Generator fields
  const [scriptDbName, setScriptDbName] = useState("");
  const [scriptUser, setScriptUser] = useState("cognicore_ro");
  const [serverIp, setServerIp] = useState("%");
  const [generatedScript, setGeneratedScript] = useState("");

  // State & Feedback
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function handleDialectChange(d) {
    setDialect(d);
    setTestResult(null);
    setErrorMsg("");
    setSuccessMsg("");
    if (d === "mariadb") {
      setPort("3307");
      setUser("cognicore_ro");
    } else if (d === "postgres") {
      setPort("5432");
      setUser("postgres");
    } else if (d === "sqlite") {
      setPathVal("./data/local.db");
    }
  }

  async function handleTestConnection() {
    setLoading(true);
    setTestResult(null);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        kind: dialect,
        dialect,
        host,
        port: port ? Number(port) : undefined,
        database,
        user,
        password,
        path: pathVal
      };

      const result = await testSourceConnection(payload);
      setTestResult(result);
      if (result.success) {
        setSuccessMsg(`Connection successful! Introspected tables: ${result.tables?.join(", ") || "verified"}`);
      } else {
        setErrorMsg(result.message || "Connection failed");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to test connection");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDirectSource() {
    if (!name.trim()) {
      setErrorMsg("Please enter a name for this connection.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        name: name.trim(),
        kind: dialect,
        dialect,
        host,
        port: port ? Number(port) : undefined,
        database,
        user,
        password,
        path: pathVal
      };

      const res = await createSource(payload);
      if (res.success) {
        setSuccessMsg(`Source "${res.source?.name}" added and encrypted successfully!`);
        if (onSourceAdded) onSourceAdded(res.source);
        setTimeout(() => onClose(), 1200);
      } else {
        setErrorMsg(res.message || "Failed to create source");
        if (res.errorCategory) {
          setTestResult(res);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to create source");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunAutoProvision() {
    if (!name.trim()) {
      setErrorMsg("Please enter a connection name.");
      return;
    }
    if (!database.trim()) {
      setErrorMsg("Please enter the target database name.");
      return;
    }
    if (!adminPassword.trim()) {
      setErrorMsg("Admin/Root password is required for one-time provisioning.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        kind: dialect,
        dialect,
        host,
        port: port ? Number(port) : undefined,
        databaseName: database,
        database,
        adminUser,
        adminPassword,
        readOnlyUsername: roUser || "cognicore_ro",
        readOnlyPassword: roPassword || undefined,
        name: name.trim()
      };

      const res = await autoProvisionSource(payload);
      if (res.success) {
        setSuccessMsg(`User "${res.user}" provisioned and source "${res.source?.name}" saved!`);
        if (onSourceAdded) onSourceAdded(res.source);
        setTimeout(() => onClose(), 1500);
      } else {
        setErrorMsg(res.error || res.message || "Auto-provisioning failed");
      }
    } catch (err) {
      setErrorMsg(err.message || "Auto-provisioning failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateScript() {
    if (!scriptDbName.trim()) {
      setErrorMsg("Please enter the database name for the grant script.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await generateGrantScript({
        kind: dialect,
        databaseName: scriptDbName.trim(),
        readOnlyUsername: scriptUser.trim() || "cognicore_ro",
        cognicoreServerIp: serverIp.trim() || "%"
      });
      setGeneratedScript(res.script || "");
    } catch (err) {
      setErrorMsg(err.message || "Failed to generate script");
    } finally {
      setLoading(false);
    }
  }

  function renderCategoryBadge(category) {
    if (!category) return null;
    const colors = {
      network_unreachable: "#ef4444",
      auth_failed: "#f59e0b",
      insufficient_privileges: "#8b5cf6",
      database_not_found: "#ec4899",
      unknown_dialect: "#64748b"
    };
    const labels = {
      network_unreachable: "Network Unreachable (Check Host/Port)",
      auth_failed: "Authentication Failed (Check User/Pass)",
      insufficient_privileges: "Insufficient Privileges (SELECT required)",
      database_not_found: "Database Not Found",
      unknown_dialect: "Unsupported Dialect"
    };

    return (
      <span
        style={{
          display: "inline-block",
          fontSize: "11px",
          fontWeight: "600",
          padding: "3px 8px",
          borderRadius: "6px",
          background: `${colors[category] || "#ef4444"}20`,
          border: `1px solid ${colors[category] || "#ef4444"}`,
          color: colors[category] || "#ef4444",
          marginTop: "6px"
        }}
      >
        {labels[category] || category}
      </span>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}
    >
      <div
        style={{
          background: "#131622",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          color: "#f8fafc",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
              Connect Database / ERP
            </h2>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "2px 0 0 0" }}>
              Securely register and encrypt database connections at rest
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            background: "rgba(255, 255, 255, 0.03)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
          }}
        >
          <button
            onClick={() => setActiveTab("direct")}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === "direct" ? "rgba(99, 102, 241, 0.15)" : "transparent",
              border: "none",
              borderBottom: activeTab === "direct" ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === "direct" ? "#818cf8" : "#94a3b8",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            ⚡ Direct Credentials (Wizard)
          </button>
          <button
            onClick={() => setActiveTab("autoprovision")}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === "autoprovision" ? "rgba(99, 102, 241, 0.15)" : "transparent",
              border: "none",
              borderBottom: activeTab === "autoprovision" ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === "autoprovision" ? "#818cf8" : "#94a3b8",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            🪄 Auto-Provisioning (Approach 4)
          </button>
          <button
            onClick={() => setActiveTab("script")}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === "script" ? "rgba(99, 102, 241, 0.15)" : "transparent",
              border: "none",
              borderBottom: activeTab === "script" ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === "script" ? "#818cf8" : "#94a3b8",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            📜 DBA Script Generator
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {/* Dialect Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
              Database Dialect
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => handleDialectChange("mariadb")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  background: dialect === "mariadb" ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.04)",
                  border: dialect === "mariadb" ? "1px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.1)",
                  color: dialect === "mariadb" ? "#fbbf24" : "#94a3b8"
                }}
              >
                🏢 MariaDB / ERPNext
              </button>
              <button
                type="button"
                onClick={() => handleDialectChange("postgres")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  background: dialect === "postgres" ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.04)",
                  border: dialect === "postgres" ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.1)",
                  color: dialect === "postgres" ? "#60a5fa" : "#94a3b8"
                }}
              >
                🐘 PostgreSQL
              </button>
              {activeTab === "direct" && (
                <button
                  type="button"
                  onClick={() => handleDialectChange("sqlite")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    background: dialect === "sqlite" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: dialect === "sqlite" ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.1)",
                    color: dialect === "sqlite" ? "#34d399" : "#94a3b8"
                  }}
                >
                  📄 SQLite
                </button>
              )}
            </div>
          </div>

          {/* Connection Name */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
              Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. ERPNext Production v16"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                fontSize: "13px"
              }}
            />
          </div>

          {/* TAB 1: DIRECT CREDENTIALS */}
          {activeTab === "direct" && (
            <div>
              {dialect === "sqlite" ? (
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                    SQLite Database File Path
                  </label>
                  <input
                    type="text"
                    value={pathVal}
                    onChange={(e) => setPathVal(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                        Host / IP
                      </label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="127.0.0.1 or db.internal"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "rgba(0, 0, 0, 0.25)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#ffffff",
                          fontSize: "13px"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                        Port
                      </label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "rgba(0, 0, 0, 0.25)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#ffffff",
                          fontSize: "13px"
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                      Database Name
                    </label>
                    <input
                      type="text"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      placeholder="e.g. _210a92d8bfbfc131"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.25)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#ffffff",
                        fontSize: "13px"
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                        Read-Only User
                      </label>
                      <input
                        type="text"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="cognicore_ro"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "rgba(0, 0, 0, 0.25)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#ffffff",
                          fontSize: "13px"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "rgba(0, 0, 0, 0.25)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#ffffff",
                          fontSize: "13px"
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleTestConnection}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: loading ? "wait" : "pointer"
                  }}
                >
                  {loading ? "Testing..." : "🔍 Test Connection"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveDirectSource}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    background: "#6366f1",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: loading ? "wait" : "pointer"
                  }}
                >
                  💾 Save & Vault Source
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AUTO-PROVISIONING */}
          {activeTab === "autoprovision" && (
            <div>
              <div
                style={{
                  background: "rgba(99, 102, 241, 0.1)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "16px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: "#cbd5e1"
                }}
              >
                🔒 <strong>Zero Credential Retention Guarantee:</strong> CogniCore connects once using
                temporary elevated credentials to create a dedicated read-only role with SELECT
                privileges only. The admin password is used in memory for this single operation and is
                <strong> NEVER saved, logged, or cached</strong>.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                    Host / IP
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                  Target Database Name
                </label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="e.g. _210a92d8bfbfc131"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#ffffff",
                    fontSize: "13px"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#f87171" }}>
                    Admin / Root User
                  </label>
                  <input
                    type="text"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#f87171" }}>
                    Admin Password (One-Time)
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                    New Read-Only Username
                  </label>
                  <input
                    type="text"
                    value={roUser}
                    onChange={(e) => setRoUser(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                    Password (Optional — Auto-generated if blank)
                  </label>
                  <input
                    type="password"
                    value={roPassword}
                    onChange={(e) => setRoPassword(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleRunAutoProvision}
                style={{
                  width: "100%",
                  marginTop: "16px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#10b981",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: loading ? "wait" : "pointer"
                }}
              >
                {loading ? "Provisioning..." : "🪄 Auto-Provision & Save Read-Only User"}
              </button>
            </div>
          )}

          {/* TAB 3: SCRIPT GENERATOR */}
          {activeTab === "script" && (
            <div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                  Database Name
                </label>
                <input
                  type="text"
                  value={scriptDbName}
                  onChange={(e) => setScriptDbName(e.target.value)}
                  placeholder="e.g. _210a92d8bfbfc131"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#ffffff",
                    fontSize: "13px"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                    Read-Only Username
                  </label>
                  <input
                    type="text"
                    value={scriptUser}
                    onChange={(e) => setScriptUser(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                    CogniCore Host / IP (% for any)
                  </label>
                  <input
                    type="text"
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px"
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGenerateScript}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "#4f46e5",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: loading ? "wait" : "pointer",
                  marginBottom: "16px"
                }}
              >
                {loading ? "Generating..." : "Generate Least-Privilege Script"}
              </button>

              {generatedScript && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>SQL Script (Run as root/admin):</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedScript)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        background: "rgba(255, 255, 255, 0.1)",
                        border: "none",
                        borderRadius: "4px",
                        color: "#ffffff",
                        cursor: "pointer"
                      }}
                    >
                      📋 Copy SQL
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "#0a0c14",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#38bdf8",
                      fontSize: "12px",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {generatedScript}
                  </pre>
                  <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                    💡 Replace <code>&lt;ENTER_STRONG_PASSWORD_HERE&gt;</code> with your desired password when executing.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Feedback & Error category */}
          {errorMsg && (
            <div
              style={{
                marginTop: "16px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
                fontSize: "12px"
              }}
            >
              <div>❌ {errorMsg}</div>
              {testResult?.errorCategory && renderCategoryBadge(testResult.errorCategory)}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginTop: "16px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#6ee7b7",
                fontSize: "12px"
              }}
            >
              ✅ {successMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
