import React, { useState, useEffect } from "react";
import { MODEL_STORAGE_KEY, fetchActiveDatabase, uploadDatabase as apiUploadDatabase } from "../lib/api.js";

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

  // Check active database on mount
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
  }, []);

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
