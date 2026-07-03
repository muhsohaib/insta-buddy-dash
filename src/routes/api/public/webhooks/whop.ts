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

          // Provision instagram_accounts rows up to quantity, scoped to org.
          const { count } = await supabaseAdmin
            .from("instagram_accounts")
            .select("*", { count: "exact", head: true })
            .eq("org_id", orgId)
            .neq("status", "cancelled");
          const existing = count ?? 0;
          const toCreate = Math.max(0, quantity - existing);
          if (toCreate > 0) {
            const rows = Array.from({ length: toCreate }, (_, i) => ({
              org_id: orgId,
              user_id: userId ?? orgId,
              status: "pending_details" as const,
              label: `Account ${existing + i + 1}`,
            }));
            const { error: insErr } = await supabaseAdmin.from("instagram_accounts").insert(rows);
            if (insErr) console.error("[whop-webhook] account insert", insErr);
          }
        } else if (kind.includes("invalid") || kind.includes("cancelled") || kind.includes("canceled")) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("org_id", orgId);
        }

        return new Response("ok");
      },
    },
  },
});
