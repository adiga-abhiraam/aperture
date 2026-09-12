/**
 * Thin fetch wrapper for the Aperture processing API (FastAPI, port 8000).
 *
 * The base URL comes from NEXT_PUBLIC_API_URL; the default matches
 * start-local.ps1. Errors carry the HTTP status and the server's `detail`
 * so the UI can show something more useful than "Failed to fetch".
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the server itself could not be reached (down, wrong port, CORS). */
  get isNetwork() {
    return this.status === 0;
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
  } catch (err) {
    throw new ApiError(`Could not reach the Aperture API at ${API_BASE}`, 0, err);
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text().catch(() => undefined);
    }
    const message =
      typeof detail === "object" && detail && "detail" in detail && typeof (detail as { detail: unknown }).detail === "string"
        ? (detail as { detail: string }).detail
        : `${response.status} ${response.statusText}`;
    throw new ApiError(message, response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
