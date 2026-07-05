// Typed REST client for /api/public/v1/* — used by browser UI.
// Attaches Clerk bearer + X-Request-Id, unwraps { data } envelope, throws
// with a spec code/message on non-2xx.
//
// Two response shapes are handled transparently:
//   1. Modern envelope: { data, meta }         (envelope.ok / okList)
//   2. Legacy jsonResponse: { data }           (api-auth.server jsonResponse)
// Both expose `body.data`, so the extractor is identical.
//
// Error shapes handled:
//   1. Envelope error: { code, message, status, request_id, docs_url }
//   2. Legacy error:   { error: { code, message } }

import { useAuth } from "@clerk/tanstack-react-start";
import { useCallback, useMemo } from "react";

export class ApiClientError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  if (!query) return path;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === "") continue;
    usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${path}?${qs}` : path;
}

async function parseError(res: Response): Promise<never> {
  const rid = res.headers.get("x-request-id") ?? undefined;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    // Envelope form
    if (typeof b.code === "string" && typeof b.message === "string") {
      throw new ApiClientError(res.status, b.code, b.message, rid);
    }
    // Legacy form
    if (b.error && typeof b.error === "object") {
      const e = b.error as Record<string, unknown>;
      throw new ApiClientError(
        res.status,
        typeof e.code === "string" ? e.code : "internal",
        typeof e.message === "string" ? e.message : res.statusText || "Request failed",
        rid,
      );
    }
  }
  throw new ApiClientError(res.status, "internal", res.statusText || "Request failed", rid);
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) return parseError(res);
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as { data?: T };
  return body.data as T;
}

export type ApiClient = {
  get: <T>(path: string, query?: Query) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  del: <T>(path: string, body?: unknown) => Promise<T>;
};

export function useApiClient(): ApiClient {
  const { getToken } = useAuth();

  const request = useCallback(
    async <T>(method: string, path: string, query?: Query, body?: unknown): Promise<T> => {
      const token = await getToken();
      if (!token) throw new ApiClientError(401, "unauthenticated", "Not signed in");
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (body !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(buildUrl(`/api/public/v1${path}`, query), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return unwrap<T>(res);
    },
    [getToken],
  );

  return useMemo<ApiClient>(
    () => ({
      get: (path, query) => request("GET", path, query),
      post: (path, body) => request("POST", path, undefined, body),
      patch: (path, body) => request("PATCH", path, undefined, body),
      del: (path, body) => request("DELETE", path, undefined, body),
    }),
    [request],
  );
}
