// Fixed-window rate limiter for /api/public/v1.
//
// ⚠️ Backend gap: the platform has no standard rate-limiting primitive.
// This is an ad-hoc DB-backed limiter (fixed windows, single-region Postgres).
// Tradeoffs vs. proper edge rate limiting:
//   - Every check is an extra DB round-trip.
//   - No cross-region coordination (fine today — single Postgres instance).
//   - Fixed-window means burstiness at window boundaries.
//   - Not resilient to Postgres outages: `checkRateLimit` returns `{ allowed: true }`
//     when the RPC errors so a database blip does not lock out the API.
//
// Wired into: (opt-in per handler; nothing global today).
//
// Usage:
//   const rl = await checkRateLimit({
//     workspaceId: auth.orgId,
//     bucket: "webhooks.create",
//     limit: 30,
//     windowSeconds: 60,
//   });
//   if (!rl.allowed) throw new SpecError("rate_limited", "Try again in 60s");
//
// The returned `remaining` / `reset_at` are also written to response headers
// via `applyRateLimitHeaders` for clients that surface `RateLimit-*`.

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: string; // ISO
  window_seconds: number;
};

export async function checkRateLimit(opts: {
  workspaceId: string;
  bucket: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitDecision> {
  const { workspaceId, bucket, limit, windowSeconds } = opts;
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs).toISOString();

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("api_rate_limit_hit", {
      _workspace_id: workspaceId,
      _bucket: bucket,
      _window_start: windowStart,
      _window_seconds: windowSeconds,
      _limit: limit,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: Boolean(row?.allowed),
      limit,
      remaining: Number(row?.remaining ?? 0),
      reset_at:
        typeof row?.reset_at === "string"
          ? row.reset_at
          : new Date(new Date(windowStart).getTime() + windowMs).toISOString(),
      window_seconds: windowSeconds,
    };
  } catch (err) {
    console.error("[rate-limit] fail-open", { bucket, workspaceId, err: String(err) });
    return {
      allowed: true,
      limit,
      remaining: limit,
      reset_at: new Date(nowMs + windowMs).toISOString(),
      window_seconds: windowSeconds,
    };
  }
}

/** Apply IETF draft-ietf-httpapi-ratelimit-headers-08 headers. */
export function applyRateLimitHeaders(response: Response, d: RateLimitDecision): Response {
  const h = new Headers(response.headers);
  h.set("ratelimit-limit", String(d.limit));
  h.set("ratelimit-remaining", String(d.remaining));
  h.set("ratelimit-reset", String(Math.max(0, Math.floor((new Date(d.reset_at).getTime() - Date.now()) / 1000))));
  h.set("ratelimit-policy", `${d.limit};w=${d.window_seconds}`);
  if (!d.allowed) {
    h.set("retry-after", String(Math.max(1, Math.floor((new Date(d.reset_at).getTime() - Date.now()) / 1000))));
  }
  return new Response(response.body, { status: response.status, headers: h });
}
