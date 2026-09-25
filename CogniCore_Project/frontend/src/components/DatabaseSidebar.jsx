import React, { useState, useEffect } from "react";
import {
  MODEL_STORAGE_KEY,
  fetchActiveDatabase,
  uploadDatabase as apiUploadDatabase,
  fetchSources,
  switchSource
} from "../lib/api.js";

export default function DatabaseSidebar({
  sessionId,
  onNewChat,
  organization,
  onSelectOrganization,
  selectedModel,
  availableModels = ["gemma3:4b"],
  llmOnline = true,
  onSelectModel,
  onDatabaseActivated
}) {
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeDbName, setActiveDbName] = useState("");
  const [sources, setSources] = useState([
    { id: "sqlite_default", name: "SQLite (Local)", dialect: "sqlite" },
    { id: "erpnext_prod", name: "ERPNext v15 (MariaDB)", dialect: "mariadb" }
  ]);
  const [activeSource, setActiveSource] = useState({ id: "sqlite_default", dialect: "sqlite" });
  const [switchingSource, setSwitchingSource] = useState(false);

  async function loadSources() {
    try {
      const data = await fetchSources();
      if (data && data.sources) {
        setSources(data.sources);
        if (data.activeSource) {
          setActiveSource(data.activeSource);
        }
      }
    } catch (e) {
      // Non-critical
    }
  }

  // Check active database and sources on mount
  useEffect(() => {
    async function loadActiveDb() {
      try {
        const info = await fetchActiveDatabase();
        if (info && info.activeDatabase) {
          const name = info.activeDatabase.split("/").pop();
          setActiveDbName(name);
        }
      } catch (e) {
        // Non-critical
      }
    }
    loadActiveDb();
    loadSources();
  }, []);

  async function handleSourceSwitch(sourceId) {
    if (switchingSource || activeSource?.id === sourceId) return;
    setSwitchingSource(true);
    try {
      const res = await switchSource(sourceId);
      if (res && res.activeSource) {
        setActiveSource(res.activeSource);
        if (typeof onDatabaseActivated === "function") {
          onDatabaseActivated(res.activeSource.name || sourceId);
        }
      }
    } catch (err) {
      console.error("Failed to switch source:", err);
    } finally {
      setSwitchingSource(false);
    }
  }

  function handleFileSelection(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["db", "sqlite", "sqlite3"].includes(ext)) {
      setUploadStatus("❌ Only .db, .sqlite, and .sqlite3 files are supported.");
      return;
    }
    setSelectedDatabase(file);
    setUploadStatus("");
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }

  async function handleUpload() {
    if (!selectedDatabase || uploading) return;

    setUploading(true);
    setUploadStatus("Uploading database...");

    try {
      const result = await apiUploadDatabase(selectedDatabase);

      if (result.success) {
        const name = selectedDatabase.name;
        setUploadStatus(`✅ ${name} uploaded and activated successfully!`);
        setActiveDbName(name);
        if (typeof onDatabaseActivated === "function") {
          onDatabaseActivated(name);
        }
        setSelectedDatabase(null);
      } else {
        setUploadStatus(`❌ Upload failed: ${result.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error(error);
      setUploadStatus("❌ Cannot connect to backend server.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <aside className="sidebar">
      {/* BRAND / LOGO */}
      <div className="logo">
        <div className="logo-icon">C</div>
        <div>
          <h2>CogniCore</h2>
          <span>AI Analytics Engine</span>
        </div>
      </div>

      {/* NEW CHAT BUTTON */}
      <button className="new-chat" onClick={onNewChat}>
        + New Chat
      </button>

      {/* SESSION BADGE */}
      <div
        className="session-tag"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          padding: "4px 8px",
          fontSize: "11px",
          color: "#94a3b8",
          marginTop: "6px",
          marginBottom: "16px"
        }}
        title={`Active Session ID: ${sessionId}`}
      >
        <span>Session:</span>
        <code style={{ color: "#818cf8", fontFamily: "monospace" }}>
          {sessionId && sessionId.length > 12 ? `${sessionId.slice(0, 8)}...` : sessionId}
        </code>
      </div>

      {/* ACTIVE DATABASE BADGE (IF KNOWN) */}
      {activeDbName && (
        <div
          className="active-db-badge"
          style={{
            fontSize: "11px",
            color: "#34d399",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "6px",
            padding: "4px 8px",
            marginBottom: "12px",
            wordBreak: "break-all"
          }}
          title={`Active Database: ${activeDbName}`}
        >
          <span style={{ color: "#9ca3af", marginRight: "4px" }}>DB:</span>
          <strong>{activeDbName}</strong>
        </div>
      )}

      {/* DATA SOURCE SELECTOR (CAP v2.2 L7) */}
      <div className="sidebar-section" style={{ marginBottom: "16px" }}>
        <p className="sidebar-title">DATA SOURCE</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {sources.map((src) => {
            const isActive = activeSource?.id === src.id;
            const isMariaDb = src.dialect === "mariadb";
            return (
              <button
                key={src.id}
                disabled={switchingSource}
                onClick={() => handleSourceSwitch(src.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: isActive ? "600" : "400",
                  background: isActive
                    ? (isMariaDb ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.15)")
                    : "rgba(255, 255, 255, 0.03)",
                  border: isActive
                    ? (isMariaDb ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(99, 102, 241, 0.4)")
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  cursor: switchingSource ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{isMariaDb ? "🏢" : "📄"}</span>
                  <span>{src.name}</span>
                </div>
                {isActive && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: isMariaDb ? "#f59e0b" : "#6366f1",
                      color: "#ffffff"
                    }}
                  >
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* DATABASE UPLOAD (DRAG & DROP + FILE PICKER) */}
      <div
        className="database-upload"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? "2px dashed #6366f1" : "none",
          borderRadius: "10px",
          padding: isDragging ? "6px" : "0"
        }}
      >
        <p className="sidebar-title">DATABASE</p>

        <input
          type="file"
          accept=".db,.sqlite,.sqlite3"
          id="database-file"
          style={{ display: "none" }}
          onChange={(event) => {
            if (event.target.files && event.target.files[0]) {
              handleFileSelection(event.target.files[0]);
            }
          }}
        />

        <label htmlFor="database-file" className="upload-select-button">
          {isDragging ? "📥 Drop Database Here" : "📁 Choose Database"}
        </label>

        {selectedDatabase && (
          <div className="selected-file">📄 {selectedDatabase.name}</div>
        )}

        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!selectedDatabase || uploading}
        >
          {uploading ? "Uploading..." : "⬆ Upload Database"}
        </button>

        {uploadStatus && <p className="upload-status">{uploadStatus}</p>}
      </div>

      {/* ORGANIZATION SWITCH */}
      <div className="sidebar-section">
        <p className="sidebar-title">ORGANIZATION</p>

        <button
          className={`organization-button ${organization === "college" ? "active" : ""}`}
          onClick={() => onSelectOrganization("college")}
        >
          🎓 Education
        </button>

        <button
          className={`organization-button ${organization === "hospital" ? "active" : ""}`}
          onClick={() => onSelectOrganization("hospital")}
        >
          🏥 Hospital
        </button>
      </div>

      {/* MODEL SELECTOR */}
      <div className="sidebar-section">
        <p className="sidebar-title">
          LLM MODEL {!llmOnline && <span className="model-offline-tag">(offline)</span>}
        </p>

        <select
          className="model-select"
          value={selectedModel}
          disabled={!llmOnline && availableModels.length <= 1}
          onChange={(e) => {
            const m = e.target.value;
            onSelectModel(m);
            try {
              localStorage.setItem(MODEL_STORAGE_KEY, m);
            } catch (err) {}
          }}
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* FOOTER */}
      <div className="sidebar-bottom">
        <div className="status">
          <span className="status-dot"></span>
          System Online
        </div>
        <p>CogniCore AI v1.0</p>
      </div>
    </aside>
  );
}
