// Academic API client utility with persistent JWT authorization headers

export function getAuthToken() {
  try {
    return localStorage.getItem("cognicore_auth_token") || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem("cognicore_auth_token", token);
    } else {
      localStorage.removeItem("cognicore_auth_token");
    }
  } catch {}
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...extraHeaders
  };
}

export async function academicFetch(url, options = {}) {
  const headers = getAuthHeaders(options.headers || {});
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    console.warn("Session unauthorized or expired (HTTP 401).");
  }
  return res;
}
