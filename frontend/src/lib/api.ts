type ApiError = {
  status: number;
  message: string;
};

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function parseError(res: Response): Promise<ApiError> {
  let message = "Request failed";
  try {
    const data = (await res.json()) as { detail?: string };
    if (data?.detail) message = data.detail;
  } catch {
    // ignore JSON parse errors
  }
  return { status: res.status, message };
}

/**
 * Small API helper for this app.
 *
 * Why we do it this way:
 * - We use a session cookie (httpOnly) for auth.
 * - That means every request must send cookies using `credentials: "include"`.
 * - Centralizing fetch logic avoids mistakes and makes the app faster to build.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "GET",
    credentials: "include"
  });

  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}
