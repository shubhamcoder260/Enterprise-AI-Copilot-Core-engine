import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import {
  SESSION_STORAGE_KEY,
  MODEL_STORAGE_KEY,
  generateSessionId,
  getInitialSessionId,
  getInitialModel,
  fetchModels as apiFetchModels,
  fetchSessionHistory as apiFetchSessionHistory,
  sendQuery as apiSendQuery,
  uploadDatabase as apiUploadDatabase
} from "./lib/api.js";

function App() {

  const [sessionId, setSessionId] = useState(getInitialSessionId);
  const [organization, setOrganization] = useState("college");
  const [query, setQuery] = useState("");

  const [selectedModel, setSelectedModel] = useState(getInitialModel);
  const [availableModels, setAvailableModels] = useState(["gemma3:4b"]);
  const [llmOnline, setLlmOnline] = useState(true);

  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Hello! I'm CogniCore, your AI analytics assistant. Ask me anything about your organization data."
    }
  ]);

  const [loading, setLoading] = useState(false);

  // DATABASE UPLOAD STATES
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await apiFetchModels();
        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
          setLlmOnline(data.available !== false);
          if (!data.models.includes(selectedModel)) {
            const fallback = data.current || data.models[0];
            setSelectedModel(fallback);
            try {
              localStorage.setItem(MODEL_STORAGE_KEY, fallback);
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn("Could not reach LLM models endpoint:", err);
        setLlmOnline(false);
      }
    }
    loadModels();
  }, []);

  // Hydrate conversation history on mount
  useEffect(() => {
    async function hydrateHistory() {
      const activeSession = getInitialSessionId();
      if (!activeSession) return;
      try {
        const data = await apiFetchSessionHistory(activeSession);
        const exchangeList = data.exchanges || data.history;
        if (Array.isArray(exchangeList) && exchangeList.length > 0) {
          const hydrated = [];
          for (const ex of exchangeList) {
            if (ex.question) {
              hydrated.push({
                type: "user",
                text: ex.question
              });
            }
            if (ex.answer || ex.sql) {
              hydrated.push({
                type: "ai",
                text: ex.answer || (ex.sql ? "Query executed successfully." : ""),
                result: {
                  source: ex.source || "unknown",
                  meta: { model: ex.model },
                  data: ex.sql ? { sql: ex.sql } : null
                }
              });
            }
          }
          if (hydrated.length > 0) {
            setMessages(hydrated);
          }
        }
      } catch (err) {
        console.warn("Could not hydrate conversation history:", err);
      }
    }
    hydrateHistory();
  }, []);


  // ==========================================
  // ASK COGNICORE
  // ==========================================

  async function askCogniCore(customQuery = null) {
    const question = customQuery || query;

    if (!question.trim() || loading) return;

    const userMessage = {
      type: "user",
      text: question
    };

    setMessages((previous) => [...previous, userMessage]);

    setQuery("");
    setLoading(true);

    try {
      const result = await apiSendQuery({
        query: question,
        organization,
        sessionId,
        model: selectedModel
      });

      const respSessionId = result.meta?.sessionId || result.sessionId;
      if (respSessionId && respSessionId !== sessionId) {
        setSessionId(respSessionId);
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, respSessionId);
        } catch (e) {}
      }

      setMessages((previous) => [
        ...previous,
        {
          type: "ai",
          text: result.answer || "I could not generate an answer.",
          result
        }
      ]);

    } catch (error) {
      console.error(error);

      setMessages((previous) => [
        ...previous,
        {
          type: "ai",
          text: "Cannot connect to the backend. Please make sure the backend server is running.",
          error: true
        }
      ]);

    } finally {
      setLoading(false);
    }
  }


  // ==========================================
  // UPLOAD DATABASE
  // ==========================================

  async function uploadDatabase() {
    if (!selectedDatabase || uploading) return;

    setUploading(true);
    setUploadStatus("Uploading database...");

    try {
      const result = await apiUploadDatabase(selectedDatabase);

      if (result.success) {

        setUploadStatus(
          `✅ ${selectedDatabase.name} uploaded and activated successfully!`
        );

        setMessages((previous) => [
          ...previous,
          {
            type: "ai",
            text: `Database "${selectedDatabase.name}" is now active. You can ask me questions about its data.`
          }
        ]);

        setSelectedDatabase(null);

      } else {

        setUploadStatus(
          `❌ Upload failed: ${result.message || "Unknown error"}`
        );

      }

    } catch (error) {
      console.error(error);

      setUploadStatus(
        "❌ Cannot connect to the backend. Make sure the backend is running."
      );

    } finally {
      setUploading(false);
    }
  }


  // ==========================================
  // KEYBOARD HANDLER
  // ==========================================

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askCogniCore();
    }
  }


  // ==========================================
  // NEW CHAT
  // ==========================================

  function startNewChat() {
    const newSessionId = generateSessionId();
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    } catch (e) {}
    setSessionId(newSessionId);

    setMessages([
      {
        type: "ai",
        text: "New conversation started. What would you like to know?"
      }
    ]);

    setQuery("");
  }


  // ==========================================
  // USE EXAMPLE
  // ==========================================

  function useExample(example) {
    setQuery(example);
  }


  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="logo">
          <div className="logo-icon">C</div>

          <div>
            <h2>CogniCore</h2>
            <span>AI Analytics Engine</span>
          </div>
        </div>


        <button
          className="new-chat"
          onClick={startNewChat}
        >
          + New Chat
        </button>

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



        {/* DATABASE UPLOAD */}

        <div className="database-upload">

          <p className="sidebar-title">
            DATABASE
          </p>


          <input
            type="file"
            accept=".db,.sqlite,.sqlite3"
            id="database-file"
            style={{ display: "none" }}
            onChange={(event) => {

              if (
                event.target.files &&
                event.target.files[0]
              ) {

                setSelectedDatabase(
                  event.target.files[0]
                );

                setUploadStatus("");
              }
            }}
          />


          <label
            htmlFor="database-file"
            className="upload-select-button"
          >
            📁 Choose Database
          </label>


          {selectedDatabase && (
            <div className="selected-file">
              📄 {selectedDatabase.name}
            </div>
          )}


          <button
            className="upload-button"
            onClick={uploadDatabase}
            disabled={
              !selectedDatabase || uploading
            }
          >
            {uploading
              ? "Uploading..."
              : "⬆ Upload Database"}
          </button>


          {uploadStatus && (
            <p className="upload-status">
              {uploadStatus}
            </p>
          )}

        </div>


        {/* ORGANIZATION */}

        <div className="sidebar-section">

          <p className="sidebar-title">
            ORGANIZATION
          </p>


          <button
            className={`organization-button ${
              organization === "college"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrganization("college")
            }
          >
            🎓 Education
          </button>


          <button
            className={`organization-button ${
              organization === "hospital"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrganization("hospital")
            }
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
              setSelectedModel(m);
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



        <div className="sidebar-bottom">

          <div className="status">
            <span className="status-dot"></span>
            System Online
          </div>

          <p>CogniCore AI v1.0</p>

        </div>

      </aside>


      {/* MAIN CHAT AREA */}

      <main className="chat-container">


        {/* HEADER */}

        <header className="chat-header">

          <div>

            <h1>CogniCore AI</h1>

            <p>
              {organization === "college"
                ? "Education Analytics Workspace"
                : "Hospital Analytics Workspace"}
            </p>

          </div>


          <div className="header-status">

            <span className="status-dot"></span>

            Connected

          </div>

        </header>


        {/* MESSAGES */}

        <div className="messages">

          {messages.map((message, index) => (

            <div
              key={index}
              className={`message-row ${message.type}`}
            >

              <div className="avatar">
                {message.type === "ai"
                  ? "AI"
                  : "YOU"}
              </div>


              <div className="message-content">

                <div className="message-label">

                  {message.type === "ai"
                    ? "CogniCore"
                    : "You"}

                </div>


                <div
                  className={`message-bubble ${
                    message.error
                      ? "error-message"
                      : ""
                  }`}
                >

                  <p>{message.text}</p>


                  {message.result && (

                    <div className="result-card">

                      <div className="result-grid">


                        <div className="result-item">
                          <span>Source</span>
                          <strong>
                            <span className={`source-badge badge-${message.result.source || "tool"}`}>
                              {message.result.source === "tool"
                                ? (message.result.meta?.tool || "Configured Tool")
                                : message.result.source === "dynamic"
                                ? "Dynamic Query"
                                : message.result.source === "fallback"
                                ? "Fallback"
                                : message.result.source === "llm"
                                ? `Local LLM (${message.result.meta?.model || "gemma3:4b"})`
                                : message.result.source || "N/A"}
                            </span>
                          </strong>
                        </div>

                        {message.result.meta?.processingMs !== undefined && (
                          <div className="result-item">
                            <span>Latency</span>
                            <strong>
                              {message.result.meta.processingMs} ms
                            </strong>
                          </div>
                        )}

                        {message.result.data?.value !== undefined && (
                          <div className="result-item highlight">
                            <span>Result</span>
                            <strong>
                              {message.result.data.value}
                            </strong>
                          </div>
                        )}
                      </div>

                      {message.result.data?.sql && (
                        <div className="sql-card">
                          <span className="sql-label">Executed SQL</span>
                          <code>{message.result.data.sql}</code>
                        </div>
                      )}

                      {message.result.data?.records &&
                        message.result.data.records.length > 0 && (
                          <details open className="table-wrapper">
                            <summary>
                              Matching records ({message.result.data.records.length})
                            </summary>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  {Object.keys(message.result.data.records[0]).map((col) => (
                                    <th key={col}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {message.result.data.records.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {Object.keys(message.result.data.records[0]).map((col) => (
                                      <td key={col}>{String(row[col] ?? "")}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        )}
                    </div>

                  )}

                </div>

              </div>

            </div>

          ))}


          {loading && (

            <div className="message-row ai">

              <div className="avatar">
                AI
              </div>


              <div className="message-content">

                <div className="message-label">
                  CogniCore
                </div>


                <div className="message-bubble thinking">

                  <span></span>
                  <span></span>
                  <span></span>

                </div>

              </div>

            </div>

          )}

        </div>


        {/* EXAMPLES */}

        <div className="examples-container">

          <p>Try asking:</p>


          <div className="examples">

            <button
              onClick={() =>
                useExample(
                  "How many students are there?"
                )
              }
            >
              How many students are there?
            </button>


            <button
              onClick={() =>
                useExample(
                  "Show students from Nepal"
                )
              }
            >
              Show students from Nepal
            </button>


            <button
              onClick={() =>
                useExample(
                  "Show students with CGPA above 8.5"
                )
              }
            >
              CGPA above 8.5
            </button>


            <button
              onClick={() =>
                useExample(
                  "How many patients visited cardiology in September 2026?"
                )
              }
            >
              Cardiology visits
            </button>

          </div>

        </div>


        {/* INPUT */}

        <div className="input-area">

          <div className="input-box">

            <textarea
              placeholder="Ask CogniCore about your organization data..."
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              onKeyDown={handleKeyDown}
            />


            <button
              className="send-button"
              onClick={() => askCogniCore()}
              disabled={
                loading || !query.trim()
              }
            >

              {loading ? "..." : "➤"}

            </button>

          </div>


          <p className="input-hint">

            Press Enter to send • Shift + Enter for a new line

          </p>

        </div>

      </main>

    </div>
  );
}


createRoot(
  document.getElementById("root")
).render(<App />);