import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Whop webhook endpoint. Signature is HMAC-SHA256 of the raw body with the
// webhook secret, sent as X-Whop-Signature. The checkout URL includes the
// active Clerk organization id in `metadata[org_id]` (plus `user_id` of the
// purchaser for audit) so the webhook can provision resources under the
// correct organization/workspace.
export const Route = createFileRoute("/api/public/webhooks/whop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WHOP_WEBHOOK_SECRET;
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const sigHeader =
          request.headers.get("x-whop-signature") ||
          request.headers.get("whop-signature") ||
          "";
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(sigHeader.replace(/^sha256=/, ""));
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        type WhopEvent = {
          action?: string;
          type?: string;
          data?: Record<string, unknown>;
        };
        const event = JSON.parse(raw) as WhopEvent;
        const kind = event.action || event.type || "";
        const payload = (event.data ?? {}) as Record<string, unknown>;
        const meta = (payload.metadata ?? payload.user_metadata ?? {}) as {
          org_id?: string;
          user_id?: string;
          quantity?: number;
          order_id?: string;
        };
        const orderId = meta.order_id ?? null;

        const orgId = meta.org_id;
        const userId = meta.user_id ?? null;
        const quantity = Number(
          (payload.quantity as number | undefined) ?? meta.quantity ?? 1,
        );
        const membershipId = (payload.id as string | undefined) ?? null;
        const subscriptionId = (payload.subscription_id as string | undefined) ?? membershipId;
        const periodEnd = (payload.expires_at as number | undefined)
          ? new Date((payload.expires_at as number) * 1000).toISOString()
          : null;

        if (!orgId) {
          console.warn("[whop-webhook] no org_id in metadata; ignoring");
          return new Response("ok");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Ensure a profiles row exists for the purchasing Clerk user (audit).
        if (userId) {
          await supabaseAdmin.from("profiles").upsert({ id: userId }, { onConflict: "id" });
        }

        if (kind.includes("valid") || kind.includes("created") || kind.includes("succeeded")) {
          const { error: subErr } = await supabaseAdmin
            .from("subscriptions")
            .upsert(
              {
                org_id: orgId,
                user_id: userId ?? orgId,
                whop_subscription_id: subscriptionId ?? undefined,
                whop_membership_id: membershipId,
                quantity,
                status: "active",
                current_period_end: periodEnd,
              },
              { onConflict: "whop_subscription_id" },
            );
          if (subErr) console.error("[whop-webhook] sub upsert", subErr);

          // --- Order handling ---
          let effectiveOrderId = orderId;
          if (effectiveOrderId) {
            await supabaseAdmin
              .from("orders")
              .update({
                payment_status: "paid",
                status: "awaiting_details",
                paid_at: new Date().toISOString(),
                whop_subscription_id: subscriptionId ?? null,
                whop_membership_id: membershipId,
                current_period_end: periodEnd,
              })
              .eq("id", effectiveOrderId);
          } else {
            // Fallback: create an order retroactively for legacy checkouts.
            const { data: product } = await supabaseAdmin
              .from("products").select("id, unit_price_cents, currency")
              .eq("code", "instagram_account").maybeSingle();
            if (product) {
              const total = product.unit_price_cents * quantity;
              const { data: created } = await supabaseAdmin
                .from("orders")
                .insert({
                  org_id: orgId,
                  created_by_user_id: userId ?? orgId,
                  product_id: product.id,
                  quantity,
                  unit_price_cents: product.unit_price_cents,
                  subtotal_cents: total,
                  total_cents: total,
                  currency: product.currency,
                  payment_status: "paid",
                  status: "awaiting_details",
                  paid_at: new Date().toISOString(),
                  whop_subscription_id: subscriptionId ?? null,
                  whop_membership_id: membershipId,
                  current_period_end: periodEnd,
                })
                .select("id, product_id")
                .single();
              effectiveOrderId = created?.id ?? null;
            }
          }

          if (effectiveOrderId) {
            // Ensure order_items exist (one per unit)
            const { data: order } = await supabaseAdmin
              .from("orders").select("id, product_id, quantity").eq("id", effectiveOrderId).maybeSingle();
            if (order) {
              const { count: itemCount } = await supabaseAdmin
                .from("order_items").select("id", { count: "exact", head: true })
                .eq("order_id", order.id);
              const missing = Math.max(0, order.quantity - (itemCount ?? 0));
              if (missing > 0) {
                const rows = Array.from({ length: missing }, (_, i) => ({
                  order_id: order.id,
                  product_id: order.product_id,
                  position: (itemCount ?? 0) + i + 1,
                  status: "waiting" as const,
                }));
                await supabaseAdmin.from("order_items").insert(rows);
              }

              // Ensure a legacy instagram_accounts row per order_item so calendar/posts keep working.
              const { data: items } = await supabaseAdmin
                .from("order_items").select("id, position").eq("order_id", order.id).order("position");
              for (const it of items ?? []) {
                const { data: existing } = await supabaseAdmin
                  .from("instagram_accounts").select("id").eq("order_item_id", it.id).maybeSingle();
                if (!existing) {
                  await supabaseAdmin.from("instagram_accounts").insert({
                    org_id: orgId,
                    user_id: userId ?? orgId,
                    order_item_id: it.id,
                    status: "pending_details",
                    label: `Account ${it.position}`,
                  });
                }
              }
            }
          }
        } else if (kind.includes("invalid") || kind.includes("cancelled") || kind.includes("canceled")) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("org_id", orgId);
          if (orderId) {
            await supabaseAdmin
              .from("orders")
              .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
              .eq("id", orderId);
          }
        }

        return new Response("ok");
      },
    },
  },
});
