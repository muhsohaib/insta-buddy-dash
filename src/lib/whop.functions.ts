import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkOrg } from "@/integrations/clerk/auth-middleware";

// Creates a Whop Checkout Session server-side so the quantity (and therefore
// the total price) is baked into the checkout the user lands on. Whop's
// hosted checkout URL ignores `?quantity=` query params — the plan itself is
// fixed-price, so the only way to charge N × $49 is to POST to the Checkout
// Sessions API with the desired quantity.
export const createWhopCheckout = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => z.object({ quantity: z.number().int().min(1).max(50) }).parse(input))
  .handler(async ({ context, data }) => {
    const planId = process.env.WHOP_PLAN_ID;
    const apiKey = process.env.WHOP_API_KEY;
    if (!planId || !apiKey) {
      throw new Error("Payments are not configured yet. Ask an admin to add Whop credentials.");
    }

    const metadata = {
      org_id: context.orgId,
      user_id: context.userId,
      quantity: data.quantity,
    };

    const body = {
      plan_id: planId,
      quantity: data.quantity,
      metadata,
    };

    // Try v5 first, fall back to v2 (Whop has shipped both; older keys still
    // resolve on v2). Both endpoints return a `purchase_url` we can redirect to.
    const endpoints = [
      "https://api.whop.com/api/v5/checkout_sessions",
      "https://api.whop.com/api/v2/checkout_sessions",
    ];

    let lastErr = "";
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        lastErr = `${endpoint} → ${res.status} ${text}`;
        console.error("[whop-checkout] non-2xx", lastErr);
        continue;
      }

      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        lastErr = `${endpoint} → invalid JSON: ${text.slice(0, 200)}`;
        continue;
      }

      const url =
        (json.purchase_url as string | undefined) ??
        (json.checkout_url as string | undefined) ??
        ((json.data as Record<string, unknown> | undefined)?.purchase_url as string | undefined);

      if (url) return { url };
      lastErr = `${endpoint} → no purchase_url in response: ${text.slice(0, 200)}`;
    }

    console.error("[whop-checkout] all endpoints failed", lastErr);
    throw new Error("Could not start checkout. Please try again or contact support.");
  });
