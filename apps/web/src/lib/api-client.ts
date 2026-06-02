const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api" : "http://localhost:3010");

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data?.accessToken) {
      localStorage.setItem("accessToken", json.data.accessToken);
      return json.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = doRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

function logoutAndRedirect() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
  if (!publicPaths.includes(window.location.pathname)) {
    window.location.href = "/login";
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(res.statusText || `HTTP ${res.status}`);
  }

  if (!res.ok || !json.success) {
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry original request once with new token
        const retryRes = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
            ...options?.headers,
          },
        });
        let retryJson: any;
        try {
          retryJson = await retryRes.json();
        } catch {
          throw new Error(retryRes.statusText || `HTTP ${retryRes.status}`);
        }
        if (retryRes.ok && retryJson.success) {
          return retryJson.data;
        }
      }
      logoutAndRedirect();
    }
    throw new Error(json.error || res.statusText || `HTTP ${res.status}`);
  }

  return json.data;
}
