import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkOrg } from "@/integrations/clerk/auth-middleware";

// Redirects to Whop's hosted checkout page. Quantity + org_id are passed as
// metadata so the webhook can provision the right number of accounts under
// the correct organization.
export const createWhopCheckout = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => z.object({ quantity: z.number().int().min(1).max(50) }).parse(input))
  .handler(async ({ context, data }) => {
    const planId = process.env.WHOP_PLAN_ID;
    if (!planId) {
      throw new Error("Payments are not configured yet. Ask an admin to add Whop credentials.");
    }

    const params = new URLSearchParams({
      "metadata[org_id]": context.orgId,
      "metadata[user_id]": context.userId,
      "metadata[quantity]": String(data.quantity),
      quantity: String(data.quantity),
    });
    const url = `https://whop.com/checkout/${planId}?${params.toString()}`;
    return { url };
  });
