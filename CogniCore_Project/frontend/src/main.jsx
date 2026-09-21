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
  sendQuery as apiSendQuery
} from "./lib/api.js";
import DatabaseSidebar from "./components/DatabaseSidebar.jsx";
import SqlModal from "./components/SqlModal.jsx";
import Visualizer from "./components/Visualizer.jsx";

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
  const [inspectorTarget, setInspectorTarget] = useState(null);

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

  function handleDatabaseActivated(dbName) {
    setMessages((previous) => [
      ...previous,
      {
        type: "ai",
        text: `Database "${dbName}" is now active. You can ask me questions about its data.`
      }
    ]);
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

      <DatabaseSidebar
        sessionId={sessionId}
        onNewChat={startNewChat}
        organization={organization}
        onSelectOrganization={setOrganization}
        selectedModel={selectedModel}
        availableModels={availableModels}
        llmOnline={llmOnline}
        onSelectModel={setSelectedModel}
        onDatabaseActivated={handleDatabaseActivated}
      />


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
                        <div
                          className="sql-card"
                          onClick={() => setInspectorTarget(message.result)}
                          style={{ cursor: "pointer" }}
                          title="Click to open Pipeline & SQL Inspector"
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className="sql-label">Executed SQL</span>
                            <span style={{ fontSize: "11px", color: "#6366f1" }}>🔍 Inspect</span>
                          </div>
                          <code>{message.result.data.sql}</code>
                        </div>
                      )}

                      {(message.result.source === "fallback" || message.error) && (
                        <div style={{ marginTop: "8px" }}>
                          <button
                            onClick={() => setInspectorTarget(message.result || { error: message.text })}
                            style={{
                              background: "rgba(244, 63, 94, 0.1)",
                              color: "#e11d48",
                              border: "1px solid rgba(244, 63, 94, 0.2)",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              cursor: "pointer"
                            }}
                          >
                            🔍 Inspect Fallback Trace
                          </button>
                        </div>
                      )}

                      <Visualizer
                        result={message.result}
                        onInspectSql={() => setInspectorTarget(message.result)}
                      />
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

      <SqlModal
        isOpen={Boolean(inspectorTarget)}
        onClose={() => setInspectorTarget(null)}
        sql={inspectorTarget?.data?.sql || inspectorTarget?.sql}
        meta={inspectorTarget?.meta}
        source={inspectorTarget?.source}
        error={inspectorTarget?.error}
      />

    </div>
  );
}


createRoot(
  document.getElementById("root")
).render(<App />);