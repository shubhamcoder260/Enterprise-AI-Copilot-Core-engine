import React, { useState } from "react";
import { retestSource, deleteSource, switchSource } from "../lib/api.js";

export default function SourceManagerModal({
  isOpen,
  onClose,
  sources = [],
  activeSource,
  onSourceSwitched,
  onRefreshSources,
  onOpenWizard
}) {
  if (!isOpen) return null;

  const [testingId, setTestingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  const BUILTIN_IDS = ["sqlite_default", "erpnext_prod", "erpnext_v16", "postgres_default"];

  async function handleRetest(sourceId) {
    setTestingId(sourceId);
    setErrorMsg("");
    try {
      const res = await retestSource(sourceId);
      setStatusMap((prev) => ({
        ...prev,
        [sourceId]: {
          success: res.success,
          status: res.status || (res.success ? "connected" : "error"),
          message: res.message || (res.success ? "Connection OK" : "Failed")
        }
      }));
      if (onRefreshSources) onRefreshSources();
    } catch (err) {
      setStatusMap((prev) => ({
        ...prev,
        [sourceId]: {
          success: false,
          status: "error",
          message: err.message
        }
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(sourceId, sourceName) {
    if (BUILTIN_IDS.includes(sourceId)) {
      alert("Built-in system sources cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to remove connection "${sourceName}"? Its encrypted credentials will be permanently erased.`
    );
    if (!confirmed) return;

    setDeletingId(sourceId);
    setErrorMsg("");
    try {
      const res = await deleteSource(sourceId);
      if (res.success) {
        if (onRefreshSources) onRefreshSources();
      } else {
        setErrorMsg(res.message || "Failed to remove source");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to remove source");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSelectActive(sourceId) {
    try {
      const res = await switchSource(sourceId);
      if (res && res.activeSource) {
        if (onSourceSwitched) onSourceSwitched(res.activeSource);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to activate source");
    }
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
          maxWidth: "720px",
          maxHeight: "85vh",
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
              Manage Data Connections
            </h2>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "2px 0 0 0" }}>
              Active and registered ERP databases with encrypted vault credentials
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => {
                onClose();
                if (onOpenWizard) onOpenWizard();
              }}
              style={{
                background: "#6366f1",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              + Add Connection
            </button>
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
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(239, 68, 68, 0.15)",
              borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: "12px"
            }}
          >
            ❌ {errorMsg}
          </div>
        )}

        {/* Source List */}
        <div style={{ padding: "16px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          {sources.map((s) => {
            const isActive = activeSource?.id === s.id;
            const isBuiltin = BUILTIN_IDS.includes(s.id);
            const liveStatus = statusMap[s.id]?.status || s.status || "untested";
            const isTesting = testingId === s.id;
            const isDeleting = deletingId === s.id;

            const dialectIcons = {
              mariadb: "🏢",
              postgres: "🐘",
              sqlite: "📄"
            };

            const statusColors = {
              connected: "#10b981",
              error: "#ef4444",
              untested: "#94a3b8",
              active: "#6366f1"
            };

            return (
              <div
                key={s.id}
                style={{
                  background: isActive ? "rgba(99, 102, 241, 0.08)" : "rgba(255, 255, 255, 0.03)",
                  border: isActive ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "20px" }}>{dialectIcons[s.dialect] || "🗄️"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: "600", fontSize: "14px", color: "#f8fafc" }}>
                        {s.name}
                      </span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#6366f1",
                            color: "#ffffff",
                            fontWeight: "600"
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                      {isBuiltin && (
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "#94a3b8"
                          }}
                        >
                          Built-in
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                      Dialect: <code>{s.dialect}</code>
                      {s.database && <span> • DB: <code>{s.database}</code></span>}
                      {s.host && <span> • {s.host}:{s.port || "default"}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: `${statusColors[liveStatus] || "#94a3b8"}20`,
                      color: statusColors[liveStatus] || "#94a3b8",
                      border: `1px solid ${statusColors[liveStatus] || "#94a3b8"}40`
                    }}
                  >
                    {liveStatus}
                  </span>

                  <button
                    disabled={isTesting}
                    onClick={() => handleRetest(s.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#cbd5e1",
                      fontSize: "11px",
                      cursor: isTesting ? "wait" : "pointer"
                    }}
                  >
                    {isTesting ? "Testing..." : "🔄 Test"}
                  </button>

                  {!isActive && (
                    <button
                      onClick={() => handleSelectActive(s.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "rgba(99, 102, 241, 0.2)",
                        border: "1px solid rgba(99, 102, 241, 0.4)",
                        color: "#a5b4fc",
                        fontSize: "11px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Use
                    </button>
                  )}

                  {!isBuiltin && (
                    <button
                      disabled={isDeleting}
                      onClick={() => handleDelete(s.id, s.name)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#fca5a5",
                        fontSize: "11px",
                        cursor: isDeleting ? "wait" : "pointer"
                      }}
                    >
                      {isDeleting ? "..." : "🗑️"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
