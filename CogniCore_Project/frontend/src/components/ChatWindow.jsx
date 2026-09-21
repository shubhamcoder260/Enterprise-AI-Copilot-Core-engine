import React, { useRef, useEffect } from "react";
import Visualizer from "./Visualizer.jsx";

export default function ChatWindow({
  organization = "college",
  messages = [],
  loading = false,
  query = "",
  onQueryChange,
  onSendQuery,
  onUseExample,
  onInspectSql
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages or loading
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSendQuery();
    }
  }

  const examples = [
    "How many students are there?",
    "Show students from Nepal",
    "Show students with CGPA above 8.5",
    "How many patients visited cardiology in September 2026?"
  ];

  return (
    <main className="chat-container">
      {/* CHAT HEADER */}
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

      {/* MESSAGES LIST */}
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className={`message-row ${message.type}`}>
            <div className="avatar">
              {message.type === "ai" ? "AI" : "YOU"}
            </div>

            <div className="message-content">
              <div className="message-label">
                {message.type === "ai" ? "CogniCore" : "You"}
              </div>

              <div
                className={`message-bubble ${
                  message.error ? "error-message" : ""
                }`}
              >
                <p>{message.text}</p>

                {message.result && (
                  <div className="result-card">
                    <div className="result-grid">
                      <div className="result-item">
                        <span>Source</span>
                        <strong>
                          <span
                            className={`source-badge badge-${
                              message.result.source || "tool"
                            }`}
                          >
                            {message.result.source === "tool"
                              ? message.result.meta?.tool || "Configured Tool"
                              : message.result.source === "dynamic"
                              ? "Dynamic Query"
                              : message.result.source === "fallback"
                              ? "Fallback"
                              : message.result.source === "llm"
                              ? `Local LLM (${
                                  message.result.meta?.model || "gemma3:4b"
                                })`
                              : message.result.source || "N/A"}
                          </span>
                        </strong>
                      </div>

                      {message.result.meta?.processingMs !== undefined && (
                        <div className="result-item">
                          <span>Latency</span>
                          <strong>{message.result.meta.processingMs} ms</strong>
                        </div>
                      )}

                      {message.result.data?.value !== undefined && (
                        <div className="result-item highlight">
                          <span>Result</span>
                          <strong>{message.result.data.value}</strong>
                        </div>
                      )}
                    </div>

                    {message.result.data?.sql && (
                      <div
                        className="sql-card"
                        onClick={() => onInspectSql && onInspectSql(message.result)}
                        style={{ cursor: "pointer" }}
                        title="Click to open Pipeline & SQL Inspector"
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <span className="sql-label">Executed SQL</span>
                          <span style={{ fontSize: "11px", color: "#6366f1" }}>
                            🔍 Inspect
                          </span>
                        </div>
                        <code>{message.result.data.sql}</code>
                      </div>
                    )}

                    {(message.result.source === "fallback" || message.error) && (
                      <div style={{ marginTop: "8px" }}>
                        <button
                          onClick={() =>
                            onInspectSql &&
                            onInspectSql(message.result || { error: message.text })
                          }
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

                    {/* POLYMORPHIC VISUALIZER (KPI / TABLE / CHARTSPEC / REPORT / CSV) */}
                    <Visualizer
                      result={message.result}
                      onInspectSql={onInspectSql}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-row ai">
            <div className="avatar">AI</div>
            <div className="message-content">
              <div className="message-label">CogniCore</div>
              <div className="message-bubble thinking">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* EXAMPLES CONTAINER */}
      <div className="examples-container">
        <p>Try asking:</p>
        <div className="examples">
          {examples.map((ex, idx) => (
            <button key={idx} onClick={() => onUseExample && onUseExample(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="input-area">
        <div className="input-box">
          <textarea
            placeholder="Ask CogniCore about your organization data..."
            value={query}
            onChange={(e) => onQueryChange && onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="send-button"
            onClick={onSendQuery}
            disabled={loading || !query.trim()}
          >
            {loading ? "..." : "➤"}
          </button>
        </div>
        <p className="input-hint">
          Press Enter to send • Shift + Enter for a new line
        </p>
      </div>
    </main>
  );
}
