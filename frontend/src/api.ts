const BASE = (import.meta.env.VITE_API ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

let token = localStorage.getItem("token") ?? "";

type ApiResponse<T = any> = {
  data: T;
  status: number;
};

export class ApiError extends Error {
  response: {
    status: number;
    data: { detail: any };
  };

  constructor(status: number, detail: any) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.name = "ApiError";
    this.response = {
      status,
      data: { detail },
    };
  }
}

export function setToken(value: string) {
  token = value;

  if (value) {
    localStorage.setItem("token", value);
  } else {
    localStorage.removeItem("token");
  }
}

async function readResponse(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function authHeaders(): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await readResponse(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.detail ?? data?.message ?? response.statusText
    );
  }

  return {
    data,
    status: response.status,
  };
}

async function upload<T = any>(
  path: string,
  file: File,
  title = ""
): Promise<ApiResponse<T>> {
  const form = new FormData();
  form.append("file", file);

  if (title.trim()) {
    form.append("title", title.trim());
  }

  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      // Do not set Content-Type here. The browser adds the multipart boundary.
    },
    body: form,
  });

  const data = await readResponse(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.detail ?? data?.message ?? response.statusText
    );
  }

  return {
    data,
    status: response.status,
  };
}

const api = {
  get: <T = any>(path: string) =>
    request<T>(path, "GET"),

  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, "POST", body),

  patch: <T = any>(path: string, body?: unknown) =>
    request<T>(path, "PATCH", body),

  put: <T = any>(path: string, body?: unknown) =>
    request<T>(path, "PUT", body),

  delete: <T = any>(path: string) =>
    request<T>(path, "DELETE"),

  upload: <T = any>(path: string, file: File, title = "") =>
    upload<T>(path, file, title),
};

export default api;
