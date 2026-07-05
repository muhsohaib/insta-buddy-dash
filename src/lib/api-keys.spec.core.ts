// API keys spec core — bridges `api_keys` → spec ApiKey.
// `scopes` doesn't yet exist on the DB row; treated as [] until schema adds it.
import type { ApiAuth } from "./api-auth.server";
import { generateApiKey } from "./api-auth.server";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";
import { enqueueWebhookEvent } from "./webhooks-dispatch.server";

type Row = {
  id: string;
  org_id: string;
  created_by_user_id: string | null;
  label: string | null;
  prefix: string | null;
  scopes: string[] | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type ApiKeyView = {
  id: string;
  object: "api_key";
  label: string;
  prefix: string;
  scopes: string[];
  status: "active" | "revoked" | "expired";
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
};

function status(r: Row): ApiKeyView["status"] {
  if (r.revoked_at) return "revoked";
  if (r.expires_at && new Date(r.expires_at) < new Date()) return "expired";
  return "active";
}

function toView(r: Row): ApiKeyView {
  return {
    id: r.id,
    object: "api_key",
    label: r.label ?? "",
    prefix: r.prefix ?? "",
    scopes: r.scopes ?? [],
    status: status(r),
    last_used_at: r.last_used_at,
    expires_at: r.expires_at,
    created_at: r.created_at,
    created_by: r.created_by_user_id,
  };
}

export async function listApiKeys(
  auth: ApiAuth,
  opts: { limit: number; cursor: ParsedCursor | null },
) {
  let q = auth.supabase
    .from("api_keys")
    .select("*")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);
  if (opts.cursor) {
    q = q.or(
      `created_at.lt.${opts.cursor.ts},and(created_at.eq.${opts.cursor.ts},id.lt.${opts.cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw new SpecError("internal", error.message);
  const rows = (data ?? []) as unknown as Row[];
  const overflow = rows.length > opts.limit;
  const trimmed = overflow ? rows.slice(0, opts.limit) : rows;
  const last = trimmed[trimmed.length - 1];
  return {
    data: trimmed.map(toView),
    page: {
      has_more: overflow,
      next_cursor: overflow && last ? encodeCursor(last.created_at, last.id) : null,
    },
  };
}

export async function getApiKey(auth: ApiAuth, id: string): Promise<ApiKeyView> {
  const { data, error } = await auth.supabase
    .from("api_keys")
    .select("*")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (error) throw new SpecError("internal", error.message);
  if (!data) throw new SpecError("not_found", `API key ${id} not found`);
  return toView(data as unknown as Row);
}

export async function createApiKey(
  auth: ApiAuth,
  input: { label: string; scopes?: string[]; expires_at?: string | null },
): Promise<ApiKeyView & { token: string }> {
  if (!input.label) throw new SpecError("invalid_input", "label required", { label: "required" });
  if (!auth.userId) throw new SpecError("forbidden", "Machine callers cannot create API keys");
  const { raw, prefix, hash } = generateApiKey();
  const insertPayload = {
    org_id: auth.orgId,
    created_by_user_id: auth.userId,
    label: input.label,
    prefix,
    token_hash: hash,
    expires_at: input.expires_at ?? null,
  };
  const { data, error } = await auth.supabase
    .from("api_keys")
    .insert(insertPayload as never)
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  const view = toView(data as unknown as Row);
  await enqueueWebhookEvent(auth.supabase, auth.orgId, "api_key.created", {
    api_key: { id: view.id, label: view.label, prefix: view.prefix },
  });
  return { ...view, token: raw };
}

export async function deleteApiKey(auth: ApiAuth, id: string): Promise<void> {
  const existing = await getApiKey(auth, id);
  const { error } = await auth.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", auth.orgId);
  if (error) throw new SpecError("internal", error.message);
  await enqueueWebhookEvent(auth.supabase, auth.orgId, "api_key.revoked", {
    api_key: { id: existing.id, label: existing.label, prefix: existing.prefix },
  });
}
