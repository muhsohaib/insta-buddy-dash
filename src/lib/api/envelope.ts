// Shared response envelope helpers for /api/public/v1/*.
// Every route emits: { data, meta? }  on success (spec §Envelope)
// Every error emits: { code, message, status, request_id, docs_url, details? }
// Header contract: X-Request-Id echoed on every response.
//
// See docs/openapi.json → components.schemas.{Meta, PageMeta, Error, ErrorCode}.

export type SpecErrorCode =
  | "invalid_input"
  | "invalid_filter"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "precondition_failed"
  | "unsupported_media"
  | "rate_limited"
  | "payment_required"
  | "internal"
  | "service_unavailable";

// Canonical HTTP status per ErrorCode (spec §12 error table).
const CODE_TO_STATUS: Record<SpecErrorCode, number> = {
  invalid_input: 400,
  invalid_filter: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  precondition_failed: 412,
  unsupported_media: 415,
  rate_limited: 429,
  payment_required: 402,
  internal: 500,
  service_unavailable: 503,
};

const DOCS_BASE = "https://insta-buddy-dash.lovable.app/docs/errors";
const API_VERSION = "1.0.0";

export function statusForCode(code: SpecErrorCode): number {
  return CODE_TO_STATUS[code];
}

export function docsUrlForCode(code: SpecErrorCode): string {
  return `${DOCS_BASE}#${code}`;
}

// Extract an incoming request id (from caller) or mint a new one.
export function getOrMintRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  if (incoming && incoming.length <= 128) return incoming;
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export type PageMeta = { has_more: boolean; next_cursor: string | null };
export type EnvelopeMeta = {
  request_id: string;
  api_version: string;
  page?: PageMeta;
};

function baseHeaders(requestId: string, extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  h.set("x-request-id", requestId);
  return h;
}

export function ok<T>(
  requestId: string,
  data: T,
  opts: { status?: number; headers?: HeadersInit } = {},
): Response {
  const meta: EnvelopeMeta = { request_id: requestId, api_version: API_VERSION };
  return new Response(JSON.stringify({ data, meta }), {
    status: opts.status ?? 200,
    headers: baseHeaders(requestId, opts.headers),
  });
}

export function okList<T>(
  requestId: string,
  data: T[],
  page: PageMeta,
  opts: { headers?: HeadersInit } = {},
): Response {
  const meta: EnvelopeMeta = {
    request_id: requestId,
    api_version: API_VERSION,
    page,
  };
  return new Response(JSON.stringify({ data, meta }), {
    status: 200,
    headers: baseHeaders(requestId, opts.headers),
  });
}

export function err(
  requestId: string,
  code: SpecErrorCode,
  message: string,
  opts: { details?: Record<string, string>; headers?: HeadersInit } = {},
): Response {
  const status = statusForCode(code);
  const body = {
    code,
    message,
    status,
    request_id: requestId,
    docs_url: docsUrlForCode(code),
    ...(opts.details ? { details: opts.details } : {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(requestId, opts.headers),
  });
}

// Typed thrown error carrying a spec code + optional details.
export class SpecError extends Error {
  code: SpecErrorCode;
  details?: Record<string, string>;
  constructor(code: SpecErrorCode, message: string, details?: Record<string, string>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Centralized error → Response.  Catches anything a handler throws.
export function toErrorResponse(requestId: string, e: unknown): Response {
  if (e instanceof SpecError) {
    return err(requestId, e.code, e.message, { details: e.details });
  }
  // Legacy ApiError from src/lib/api-auth.server.ts — best-effort translate.
  if (e && typeof e === "object" && "status" in e && "code" in e && "message" in e) {
    const legacy = e as { status: number; code: string; message: string };
    const map: Record<number, SpecErrorCode> = {
      400: "invalid_input",
      401: "unauthenticated",
      402: "payment_required",
      403: "forbidden",
      404: "not_found",
      409: "conflict",
      412: "precondition_failed",
      415: "unsupported_media",
      429: "rate_limited",
      500: "internal",
      503: "service_unavailable",
    };
    const code = map[legacy.status] ?? "internal";
    return err(requestId, code, legacy.message || code);
  }
  console.error("[api] unhandled", e);
  return err(requestId, "internal", "Internal server error");
}
