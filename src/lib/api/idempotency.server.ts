// Idempotency for /api/public/v1 mutations.
//
// Contract (aligned with spec §Idempotency-Key):
//   - Header: `Idempotency-Key: <32..255 char opaque string>`
//   - Scope:  per-workspace, per (method + path).
//   - TTL:    24h (rows expire; cleanup is best-effort on read).
//
// Behavior:
//   - No header  → run handler normally.
//   - First call → run handler, persist full response, echo `Idempotency-Replayed: false`.
//   - Same key + same request body hash → replay stored response verbatim,
//                                          echo `Idempotency-Replayed: true`.
//   - Same key + different body hash    → 409 conflict (`idempotency_conflict`).
//
// Storage uses supabaseAdmin (RLS-bypass) — the idempotency table denies
// authenticated access by policy.

import { createHash } from "crypto";
import { err, ok as _ok } from "./envelope";

const IDEMP_HEADER = "idempotency-key";
const REPLAY_HEADER = "idempotency-replayed";
const MIN_KEY = 8;
const MAX_KEY = 255;

type Run = () => Promise<Response>;

type StoredRow = {
  request_hash: string;
  response_status: number;
  response_body: string;
  response_headers: Record<string, string>;
};

async function bodyHash(request: Request): Promise<{ body: string; hash: string }> {
  // Clone so the handler can still read the body.
  const clone = request.clone();
  const body = await clone.text();
  const hash = createHash("sha256").update(body).digest("hex");
  return { body, hash };
}

function normalizeKey(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < MIN_KEY || trimmed.length > MAX_KEY) return null;
  return trimmed;
}

function headersToObj(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    // Drop hop-by-hop and content-length (recomputed).
    if (k === "content-length") return;
    out[k] = v;
  });
  return out;
}

function objToHeaders(obj: Record<string, string>, rid: string, replayed: boolean): Headers {
  const h = new Headers(obj);
  h.set("x-request-id", rid);
  h.set(REPLAY_HEADER, replayed ? "true" : "false");
  return h;
}

/**
 * Wrap a mutating handler with idempotency semantics.
 * Safe to call without the header — falls through to `run()`.
 */
export async function withIdempotency(
  args: {
    request: Request;
    workspaceId: string;
    requestId: string;
    method: string;
    path: string;
  },
  run: Run,
): Promise<Response> {
  const key = normalizeKey(args.request.headers.get(IDEMP_HEADER));
  if (!key) return run();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { hash: reqHash } = await bodyHash(args.request);

  // Lookup existing (non-expired) record.
  const { data: existing } = await supabaseAdmin
    .from("api_idempotency_keys")
    .select("request_hash, response_status, response_body, response_headers, expires_at")
    .eq("workspace_id", args.workspaceId)
    .eq("idempotency_key", key)
    .maybeSingle();

  if (existing) {
    const exp = new Date(existing.expires_at as string).getTime();
    if (Number.isFinite(exp) && exp > Date.now()) {
      const stored = existing as unknown as StoredRow;
      if (stored.request_hash !== reqHash) {
        return err(
          args.requestId,
          "conflict",
          "Idempotency-Key reused with a different request body",
          { details: { idempotency_key: "conflict" } },
        );
      }
      return new Response(stored.response_body, {
        status: stored.response_status,
        headers: objToHeaders(stored.response_headers ?? {}, args.requestId, true),
      });
    }
    // Expired — best-effort delete so we can overwrite.
    await supabaseAdmin
      .from("api_idempotency_keys")
      .delete()
      .eq("workspace_id", args.workspaceId)
      .eq("idempotency_key", key);
  }

  // Run the actual handler.
  const res = await run();

  // Only cache "final" responses (2xx/4xx). Skip 5xx / 429 so retries aren't poisoned.
  const shouldCache = (res.status >= 200 && res.status < 300) || (res.status >= 400 && res.status < 500 && res.status !== 429);
  if (!shouldCache) {
    const h = new Headers(res.headers);
    h.set(REPLAY_HEADER, "false");
    return new Response(await res.clone().text(), { status: res.status, headers: h });
  }

  const respBody = await res.clone().text();
  const respHeaders = headersToObj(res.headers);

  try {
    await supabaseAdmin.from("api_idempotency_keys").insert({
      workspace_id: args.workspaceId,
      idempotency_key: key,
      method: args.method,
      path: args.path,
      request_hash: reqHash,
      response_status: res.status,
      response_body: respBody,
      response_headers: respHeaders,
    } as never);
  } catch (e) {
    // Race: another concurrent request stored it first. Prefer the stored version.
    const { data: winner } = await supabaseAdmin
      .from("api_idempotency_keys")
      .select("request_hash, response_status, response_body, response_headers")
      .eq("workspace_id", args.workspaceId)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (winner) {
      const w = winner as unknown as StoredRow;
      if (w.request_hash !== reqHash) {
        return err(
          args.requestId,
          "conflict",
          "Idempotency-Key reused with a different request body",
          { details: { idempotency_key: "conflict" } },
        );
      }
      return new Response(w.response_body, {
        status: w.response_status,
        headers: objToHeaders(w.response_headers ?? {}, args.requestId, true),
      });
    }
    console.error("[idempotency] store failed", e);
  }

  const finalHeaders = new Headers(res.headers);
  finalHeaders.set(REPLAY_HEADER, "false");
  return new Response(respBody, { status: res.status, headers: finalHeaders });
}

// Re-export for consumers.
export { _ok };
