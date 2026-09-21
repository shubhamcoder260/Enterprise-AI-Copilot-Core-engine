// ==========================================
// COGNICORE FRONTEND API CLIENT (lib/api.js)
// Centralized network layer for all backend communications
// ==========================================

export const API_BASE = "http://localhost:5000";

export const SESSION_STORAGE_KEY = "cognicore_session_id";
export const MODEL_STORAGE_KEY = "cognicore_selected_model";

export function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "session_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
}

export function getInitialSessionId() {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
    const created = generateSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return generateSessionId();
  }
}

export function getInitialModel() {
  try {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {}
  return "gemma3:4b";
}

/**
 * Fetches available LLM models from backend
 */
export async function fetchModels() {
  const res = await fetch(`${API_BASE}/api/llm/models`);
  if (!res.ok) throw new Error("Failed to fetch models");
  return await res.json();
}

/**
 * Hydrates conversation history for a given session
 */
export async function fetchSessionHistory(sessionId) {
  if (!sessionId) return { exchanges: [] };
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`Failed to fetch history for session ${sessionId}`);
  return await res.json();
}

/**
 * Submits a natural language query to the AI query endpoint
 */
export async function sendQuery({ query, organization, sessionId, model }) {
  const res = await fetch(`${API_BASE}/api/ai/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    },
    body: JSON.stringify({
      query,
      organization,
      role: "admin",
      sessionId,
      model
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || errBody.message || `Request failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Uploads a database file (.db, .sqlite, .sqlite3)
 */
export async function uploadDatabase(file) {
  const formData = new FormData();
  formData.append("database", file);

  const res = await fetch(`${API_BASE}/api/database/upload`, {
    method: "POST",
    body: formData
  });

  return await res.json();
}

/**
 * Fetches currently active database info
 */
export async function fetchActiveDatabase() {
  const res = await fetch(`${API_BASE}/api/database/active`);
  if (!res.ok) throw new Error("Failed to fetch active database");
  return await res.json();
}

/**
 * Switches the active database
 */
export async function switchDatabase(dbName) {
  const res = await fetch(`${API_BASE}/api/database/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database: dbName })
  });
  return await res.json();
}
