// Webhook dispatch: signature + enqueue helpers.
// Called from spec-endpoint core modules when a domain event happens.
// Insertion uses whichever supabase client the caller passes (typically
// auth.supabase == supabaseAdmin, so RLS is bypassed).
import { createHmac } from "crypto";
import type { supabaseAdmin } from "@/integrations/supabase/client.server";

type SB = typeof supabaseAdmin;

export type WebhookEvent =
  | "account.connected"
  | "account.needs_attention"
  | "api_key.created"
  | "api_key.revoked"
  | "asset.ready"
  | "asset.failed"
  | "delivery.ready"
  | "delivery.accepted"
  | "delivery.issue_reported"
  | "member.invited"
  | "member.role_changed"
  | "order.paid"
  | "order.fulfilled"
  | "order.refunded"
  | "post.scheduled"
  | "post.publishing"
  | "post.published"
  | "post.failed"
  | "post.cancelled";

/**
 * Compute the signature header value for a delivery.
 * Format (Stripe-style): `t=<unix-ts>,v1=<hex-hmac-sha256(t + "." + rawBody)>`.
 * Receivers should:
 *   1. Reject if |now - t| > 300s.
 *   2. Recompute HMAC and timing-safe compare.
 */
export function signBody(secret: string, timestamp: number, rawBody: string): string {
  const payload = `${timestamp}.${rawBody}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/**
 * Enqueue a webhook event for delivery.
 * Fans out to every active subscription in the workspace that lists `event`
 * in its `events[]` array. Silently no-ops when no subscribers match, and
 * never throws — webhook failures must not break the originating request.
 */
export async function enqueueWebhookEvent(
  supabase: SB,
  workspaceId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: subs, error } = await supabase
      .from("webhooks")
      .select("id, events, status")
      .eq("workspace_id", workspaceId)
      .eq("status", "active");
    if (error || !subs || subs.length === 0) return;
    const matching = subs.filter((s) => Array.isArray(s.events) && s.events.includes(event));
    if (matching.length === 0) return;
    const rows = matching.map((s) => ({
      webhook_id: s.id,
      workspace_id: workspaceId,
      event,
      payload: { event, workspace_id: workspaceId, data: payload, ts: new Date().toISOString() },
      status: "pending",
      attempts: 0,
    }));
    await supabase.from("webhook_deliveries").insert(rows as never);
  } catch (err) {
    console.error("[webhooks] enqueue failed", { event, err: String(err) });
  }
}
