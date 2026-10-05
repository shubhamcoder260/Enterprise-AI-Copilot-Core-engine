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

let cachedToken = null;

export async function getAuthHeaders() {
  if (cachedToken) {
    return { "Authorization": `Bearer ${cachedToken}` };
  }
  try {
    const saved = localStorage.getItem("cognicore_auth_token");
    if (saved) {
      cachedToken = saved;
      return { "Authorization": `Bearer ${cachedToken}` };
    }
  } catch {}

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        cachedToken = data.token;
        try { localStorage.setItem("cognicore_auth_token", cachedToken); } catch {}
        return { "Authorization": `Bearer ${cachedToken}` };
      }
    }
  } catch (err) {
    console.warn("Could not authenticate automatically:", err.message);
  }
  return {};
}

/**
 * Submits a natural language query to the AI query endpoint
 */
export async function sendQuery({ query, organization, sessionId, model }) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/ai/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
      ...auth
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
export async function switchDatabase(dbPath) {
  const res = await fetch(`${API_BASE}/api/database/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databasePath: dbPath })
  });
  return await res.json();
}

/**
 * Fetches all registered data sources and current active source
 */
export async function fetchSources() {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/database/sources`, {
    headers: { ...auth }
  });
  if (!res.ok) throw new Error("Failed to fetch sources");
  return await res.json();
}

/**
 * Switches the active source via orchestrator
 */
export async function switchSource(sourceId) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/database/sources/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ sourceId })
  });
  if (!res.ok) throw new Error("Failed to switch source");
  return await res.json();
}

/**
 * Test a database connection descriptor without persisting
 */
export async function testSourceConnection(descriptor) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/sources/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(descriptor)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, ...data };
  }
  return data;
}

/**
 * Generate DBA grant script
 */
export async function generateGrantScript(params) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/sources/generate-grant-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(params)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || "Failed to generate script");
  }
  return data;
}

/**
 * Auto-provision read-only user using temporary elevated credentials
 */
export async function autoProvisionSource(params) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/sources/auto-provision`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(params)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, ...data };
  }
  return data;
}

/**
 * Persist and register a new data source
 */
export async function createSource(sourceData) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(sourceData)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, ...data };
  }
  return data;
}

/**
 * Re-test an existing saved source
 */
export async function retestSource(sourceId) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/sources/${encodeURIComponent(sourceId)}/test`, {
    method: "POST",
    headers: { ...auth }
  });
  const data = await res.json().catch(() => ({}));
  return { success: res.ok && data.success, ...data };
}

/**
 * Delete a source and its vaulted credential
 */
export async function deleteSource(sourceId) {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
    headers: { ...auth }
  });
  const data = await res.json().catch(() => ({}));
  return { success: res.ok && data.success, ...data };
}

