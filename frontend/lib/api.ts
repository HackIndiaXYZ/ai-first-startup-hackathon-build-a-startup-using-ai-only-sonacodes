const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = {
  token?: string | null;
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export async function api<T>(path: string, { token, method = "GET", body, query }: Options = {}): Promise<T> {
  const url = new URL(path, API_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), init);
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/pdf")) {
    if (!res.ok) throw new ApiError(res.status, "PDF_ERROR", "Could not download the bill.");
    return (await res.blob()) as T;
  }

  const data = contentType.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code || "ERROR", err?.message || "Something went wrong.");
  }
  return data as T;
}

export function apiUrl(path: string) {
  return new URL(path, API_URL).toString();
}
