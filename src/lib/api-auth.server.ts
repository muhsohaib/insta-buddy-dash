// Authenticates incoming requests to /api/public/v1/*.
// Accepts either:
//   - a Clerk session JWT (browser callers), OR
//   - an opaque workspace API key ("sk_live_..." issued via Settings → API Keys).
//
// Both paths resolve to a single { orgId, userId, actor } tuple that mirrors
// exactly what requireClerkOrg produces for the website — the API is just
// another authenticated caller of the same core order logic.
import { verifyToken } from "@clerk/backend";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ApiActor = "user" | "machine";
export type ApiAuth = {
  orgId: string;
  userId: string | null;
  actor: ApiActor;
  supabase: typeof supabaseAdmin;
};

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Format: sk_live_<48 char base62>. Prefix stored for display.
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let body = "";
  for (const b of bytes) body += alphabet[b % alphabet.length];
  const raw = `sk_live_${body}`;
  return { raw, prefix: raw.slice(0, 14), hash: hashApiKey(raw) };
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function apiError(err: unknown): Response {
  if (err instanceof ApiError) {
    return jsonResponse(err.status, { error: { code: err.code, message: err.message } });
  }
  console.error("[api] internal", err);
  return jsonResponse(500, {
    error: { code: "internal", message: "Internal server error" },
  });
}

export function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export async function authenticateApiRequest(request: Request): Promise<ApiAuth> {
  const header = request.headers.get("authorization") ?? "";
  if (!header) throw new ApiError(401, "unauthorized", "Missing Authorization header");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError(401, "unauthorized", "Empty bearer token");

  // API key path: opaque secret issued by the workspace.
  if (token.startsWith("sk_live_") || token.startsWith("sk_test_")) {
    const hash = hashApiKey(token);
    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, org_id, created_by_user_id, revoked_at, expires_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (error) throw new ApiError(500, "internal", error.message);
    if (!data) throw new ApiError(401, "invalid_api_key", "API key not recognized");
    if (data.revoked_at) throw new ApiError(401, "revoked", "API key has been revoked");
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      throw new ApiError(401, "expired", "API key has expired");
    }
    // Fire-and-forget usage stamp — never block the request on it.
    void supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
    return {
      orgId: data.org_id,
      userId: data.created_by_user_id,
      actor: "machine",
      supabase: supabaseAdmin,
    };
  }

  // Session JWT path (browser callers).
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new ApiError(500, "misconfigured", "Auth not configured");
  let claims: {
    sub?: string;
    org_id?: string;
  } & Record<string, unknown>;
  try {
    claims = (await verifyToken(token, { secretKey })) as typeof claims;
  } catch {
    throw new ApiError(401, "invalid_token", "Invalid session token");
  }
  if (!claims.sub) throw new ApiError(401, "invalid_token", "No subject in token");
  const orgId = claims.org_id ?? `personal:${claims.sub}`;
  return {
    orgId,
    userId: claims.sub,
    actor: "user",
    supabase: supabaseAdmin,
  };
}
