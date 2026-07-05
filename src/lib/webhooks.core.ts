// Webhooks core — spec: docs/openapi.json → schemas.Webhook, WebhookDelivery.
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";

type WHRow = {
  id: string;
  workspace_id: string;
  url: string;
  description: string;
  events: string[];
  secret: string;
  status: string;
  created_at: string;
  updated_at: string;
};
type DRow = {
  id: string;
  webhook_id: string;
  workspace_id: string;
  event: string;
  payload: unknown;
  status: string;
  attempts: number;
  http_status: number | null;
  response_body: string | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookView = {
  id: string;
  object: "webhook";
  url: string;
  description: string;
  events: string[];
  status: string;
  secret_prefix: string;
  created_at: string;
  updated_at: string;
};

export type WebhookDeliveryView = {
  id: string;
  object: "webhook_delivery";
  webhook_id: string;
  event: string;
  status: string;
  attempts: number;
  http_status: number | null;
  response_body: string | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

function genSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "whsec_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toWH(r: WHRow): WebhookView {
  return {
    id: r.id,
    object: "webhook",
    url: r.url,
    description: r.description,
    events: r.events,
    status: r.status,
    secret_prefix: r.secret.slice(0, 10),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
function toD(r: DRow): WebhookDeliveryView {
  return {
    id: r.id,
    object: "webhook_delivery",
    webhook_id: r.webhook_id,
    event: r.event,
    status: r.status,
    attempts: r.attempts,
    http_status: r.http_status,
    response_body: r.response_body,
    next_attempt_at: r.next_attempt_at,
    delivered_at: r.delivered_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function ensureWH(auth: ApiAuth, id: string): Promise<WHRow> {
  const { data, error } = await auth.supabase
    .from("webhooks")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", auth.orgId)
    .maybeSingle();
  if (error) throw new SpecError("internal", error.message);
  if (!data) throw new SpecError("not_found", `Webhook ${id} not found`);
  return data as WHRow;
}

export async function listWebhooks(
  auth: ApiAuth,
  opts: { limit: number; cursor: ParsedCursor | null },
) {
  let q = auth.supabase
    .from("webhooks")
    .select("*")
    .eq("workspace_id", auth.orgId)
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
  const rows = (data ?? []) as unknown as WHRow[];
  const overflow = rows.length > opts.limit;
  const trimmed = overflow ? rows.slice(0, opts.limit) : rows;
  const last = trimmed[trimmed.length - 1];
  return {
    data: trimmed.map(toWH),
    page: {
      has_more: overflow,
      next_cursor: overflow && last ? encodeCursor(last.created_at, last.id) : null,
    },
  };
}

export async function getWebhook(auth: ApiAuth, id: string): Promise<WebhookView> {
  return toWH(await ensureWH(auth, id));
}

export async function createWebhook(
  auth: ApiAuth,
  input: { url: string; description?: string; events: string[] },
): Promise<WebhookView & { secret: string }> {
  if (!input.url || !/^https:\/\//.test(input.url))
    throw new SpecError("invalid_input", "url must be https", { url: "must start with https://" });
  if (!Array.isArray(input.events) || input.events.length === 0)
    throw new SpecError("invalid_input", "events required", { events: "must be a non-empty array" });
  const secret = genSecret();
  const { data, error } = await auth.supabase
    .from("webhooks")
    .insert({ 
      workspace_id: auth.orgId,
      url: input.url,
      description: input.description ?? "",
      events: input.events,
      secret,
    })
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return { ...toWH(data as WHRow), secret };
}

export async function updateWebhook(
  auth: ApiAuth,
  id: string,
  input: { url?: string; description?: string; events?: string[]; status?: string },
): Promise<WebhookView> {
  await ensureWH(auth, id);
  const patch: Record<string, unknown> = {};
  if (input.url) patch.url = input.url;
  if (input.description !== undefined) patch.description = input.description;
  if (input.events) patch.events = input.events;
  if (input.status) patch.status = input.status;
  if (Object.keys(patch).length === 0) return getWebhook(auth, id);
  const { data, error } = await auth.supabase
    .from("webhooks")
    .update(patch as never)
    .eq("id", id)
    .eq("workspace_id", auth.orgId)
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toWH(data as WHRow);
}

export async function deleteWebhook(auth: ApiAuth, id: string): Promise<void> {
  await ensureWH(auth, id);
  const { error } = await auth.supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", auth.orgId);
  if (error) throw new SpecError("internal", error.message);
}

export async function rotateSecret(
  auth: ApiAuth,
  id: string,
): Promise<WebhookView & { secret: string }> {
  await ensureWH(auth, id);
  const secret = genSecret();
  const { data, error } = await auth.supabase
    .from("webhooks")
    .update({ secret })
    .eq("id", id)
    .eq("workspace_id", auth.orgId)
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return { ...toWH(data as WHRow), secret };
}

export async function listDeliveries(
  auth: ApiAuth,
  webhookId: string,
  opts: { limit: number; cursor: ParsedCursor | null },
) {
  await ensureWH(auth, webhookId);
  let q = auth.supabase
    .from("webhook_deliveries")
    .select("*")
    .eq("webhook_id", webhookId)
    .eq("workspace_id", auth.orgId)
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
  const rows = (data ?? []) as unknown as DRow[];
  const overflow = rows.length > opts.limit;
  const trimmed = overflow ? rows.slice(0, opts.limit) : rows;
  const last = trimmed[trimmed.length - 1];
  return {
    data: trimmed.map(toD),
    page: {
      has_more: overflow,
      next_cursor: overflow && last ? encodeCursor(last.created_at, last.id) : null,
    },
  };
}

export async function replayDelivery(
  auth: ApiAuth,
  webhookId: string,
  deliveryId: string,
): Promise<WebhookDeliveryView> {
  await ensureWH(auth, webhookId);
  const { data: original, error: gErr } = await auth.supabase
    .from("webhook_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .eq("webhook_id", webhookId)
    .eq("workspace_id", auth.orgId)
    .maybeSingle();
  if (gErr) throw new SpecError("internal", gErr.message);
  if (!original) throw new SpecError("not_found", `Delivery ${deliveryId} not found`);
  const { data, error } = await auth.supabase
    .from("webhook_deliveries")
    .insert({ 
      webhook_id: webhookId,
      workspace_id: auth.orgId,
      event: (original as DRow).event,
      payload: (original as DRow).payload,
      status: "pending",
      attempts: 0,
    })
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toD(data as DRow);
}
