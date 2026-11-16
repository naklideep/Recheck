const BASE = import.meta.env.VITE_API ?? "http://localhost:8000";
let token = localStorage.getItem("token") ?? "";

export function setToken(t: string) {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(typeof e.detail === "string" ? e.detail : "Request failed");
  }
  return r.json();
}
