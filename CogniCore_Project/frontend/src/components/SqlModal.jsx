import React, { useState } from "react";

export default function SqlModal({
  isOpen,
  onClose,
  sql,
  meta = {},
  source,
  error
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pipelineTrace = meta?.pipelineTrace || meta?.trace || null;

  function copyToClipboard() {
    if (sql) {
      navigator.clipboard.writeText(sql).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px"
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1e293b",
          color: "#f8fafc",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          overflow: "hidden"
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>🔍</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
              Pipeline &amp; SQL Inspector
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px"
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* TRACE CHIPS */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {source && (
              <span
                className={`source-badge badge-${source}`}
                style={{ fontSize: "11px", textTransform: "uppercase" }}
              >
                Source: {source}
              </span>
            )}
            {meta?.model && (
              <span
                style={{
                  background: "#334155",
                  color: "#cbd5e1",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontFamily: "monospace"
                }}
              >
                Model: {meta.model}
              </span>
            )}
            {meta?.processingMs !== undefined && (
              <span
                style={{
                  background: "#334155",
                  color: "#38bdf8",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11px"
                }}
              >
                ⏱ {meta.processingMs} ms
              </span>
            )}
            {meta?.gateCheck && (
              <span
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ade80",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11px"
                }}
              >
                🛡 AST Gate Passed
              </span>
            )}
          </div>

          {/* EXECUTED SQL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
                EXECUTED SQL
              </span>
              {sql && (
                <button
                  onClick={copyToClipboard}
                  style={{
                    background: copied ? "#10b981" : "#4338ca",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "0.2s"
                  }}
                >
                  {copied ? "✓ Copied" : "Copy SQL"}
                </button>
              )}
            </div>

            {sql ? (
              <pre
                style={{
                  background: "#0f172a",
                  color: "#38bdf8",
                  padding: "14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0
                }}
              >
                <code>{sql}</code>
              </pre>
            ) : (
              <div
                style={{
                  background: "#0f172a",
                  color: "#64748b",
                  padding: "14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontStyle: "italic"
                }}
              >
                No SQL executed for this response (fallback response, refusal, or direct scalar calculation).
              </div>
            )}
          </div>

          {/* PIPELINE TRACE / METADATA DETAILS */}
          {pipelineTrace ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
                PIPELINE EXECUTION TRACE
              </span>
              <pre
                style={{
                  background: "#0f172a",
                  color: "#a5b4fc",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  overflowX: "auto",
                  margin: 0
                }}
              >
                {JSON.stringify(pipelineTrace, null, 2)}
              </pre>
            </div>
          ) : meta && Object.keys(meta).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
                PIPELINE METADATA
              </span>
              <pre
                style={{
                  background: "#0f172a",
                  color: "#94a3b8",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  overflowX: "auto",
                  margin: 0
                }}
              >
                {JSON.stringify(meta, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* ERROR DISPLAY (IF APPLICABLE) */}
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "12px"
              }}
            >
              <strong>Error Trace:</strong> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
