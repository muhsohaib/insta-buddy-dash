import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Whop webhook endpoint. Signature is HMAC-SHA256 of the raw body with the
// webhook secret, sent as X-Whop-Signature. Adjust header name if your Whop
// dashboard shows something different.
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

        const userId =
          (payload.metadata as { user_id?: string } | undefined)?.user_id ??
          (payload.user_metadata as { user_id?: string } | undefined)?.user_id;
        const quantity = Number(
          (payload.quantity as number | undefined) ??
            (payload.metadata as { quantity?: number } | undefined)?.quantity ??
            1,
        );
        const membershipId = (payload.id as string | undefined) ?? null;
        const subscriptionId = (payload.subscription_id as string | undefined) ?? membershipId;
        const periodEnd = (payload.expires_at as number | undefined)
          ? new Date((payload.expires_at as number) * 1000).toISOString()
          : null;

        if (!userId) {
          console.warn("[whop-webhook] no user_id in metadata; ignoring");
          return new Response("ok");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (kind.includes("valid") || kind.includes("created") || kind.includes("succeeded")) {
          // Upsert subscription
          const { data: sub, error: subErr } = await supabaseAdmin
            .from("subscriptions")
            .upsert(
              {
                user_id: userId,
                whop_subscription_id: subscriptionId ?? undefined,
                whop_membership_id: membershipId,
                quantity,
                status: "active",
                current_period_end: periodEnd,
              },
              { onConflict: "whop_subscription_id" },
            )
            .select()
            .single();
          if (subErr) console.error("[whop-webhook] sub upsert", subErr);

          // Provision instagram_accounts rows up to quantity
          const { count } = await supabaseAdmin
            .from("instagram_accounts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .neq("status", "cancelled");
          const existing = count ?? 0;
          const toCreate = Math.max(0, quantity - existing);
          if (toCreate > 0) {
            const rows = Array.from({ length: toCreate }, (_, i) => ({
              user_id: userId,
              status: "pending_details" as const,
              label: `Account ${existing + i + 1}`,
            }));
            const { error: insErr } = await supabaseAdmin.from("instagram_accounts").insert(rows);
            if (insErr) console.error("[whop-webhook] account insert", insErr);
          }
          void sub;
        } else if (kind.includes("invalid") || kind.includes("cancelled") || kind.includes("canceled")) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("user_id", userId);
        }

        return new Response("ok");
      },
    },
  },
});
