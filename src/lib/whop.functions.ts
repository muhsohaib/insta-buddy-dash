import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Creates a Whop checkout link with quantity = number of accounts.
// Whop's "generate checkout link" API: POST /v5/companies/checkouts (or plans/{id}/checkouts).
export const createWhopCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ quantity: z.number().int().min(1).max(50) }).parse(input))
  .handler(async ({ context, data }) => {
    const apiKey = process.env.WHOP_API_KEY;
    const planId = process.env.WHOP_PLAN_ID;
    if (!apiKey || !planId) {
      throw new Error("Payments are not configured yet. Ask an admin to add Whop credentials.");
    }

    const res = await fetch(`https://api.whop.com/api/v5/plans/${planId}/create-checkout-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        quantity: data.quantity,
        metadata: { user_id: context.userId, quantity: data.quantity },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[whop] checkout failed", res.status, errBody);
      throw new Error("Could not open Whop checkout. Please try again.");
    }

    const body = (await res.json()) as { purchase_url?: string; checkout_url?: string; url?: string };
    const url = body.purchase_url || body.checkout_url || body.url;
    if (!url) throw new Error("Whop did not return a checkout URL.");
    return { url };
  });
