import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkOrg } from "@/integrations/clerk/auth-middleware";

const ACCOUNT_PRICE = 49;

type WhopRecord = Record<string, unknown>;

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as WhopRecord) : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function whopRequest(path: string, apiKey: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.whop.com/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Api-Version-Date": "2026-07-01",
      ...init.headers,
    },
  });

  const text = await res.text();
  let json: WhopRecord = {};
  if (text) {
    try {
      json = JSON.parse(text) as WhopRecord;
    } catch {
      // Keep the raw response available in the thrown server log below.
    }
  }

  if (!res.ok) {
    console.error("[whop-checkout] API error", path, res.status, text.slice(0, 500));
    throw new Error("Whop rejected the checkout request.");
  }

  return json;
}

// Creates a one-off Whop checkout configuration with the selected total price
// baked into an inline plan. Whop checkout links do not multiply a base plan by
// a `quantity` param, so 4 accounts must be a $196/mo plan, not quantity=4 on a
// $49 (or $9) hosted checkout URL.
export const createWhopCheckout = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => z.object({ quantity: z.number().int().min(1).max(50) }).parse(input))
  .handler(async ({ context, data }) => {
    const planId = process.env.WHOP_PLAN_ID;
    const apiKey = process.env.WHOP_API_KEY;
    if (!planId || !apiKey) {
      throw new Error("Payments are not configured yet. Ask an admin to add Whop credentials.");
    }

    const basePlan = await whopRequest(`/plans/${encodeURIComponent(planId)}`, apiKey);
    const product = asRecord(basePlan.product);
    const productId = asString(product?.id);
    if (!productId) {
      console.error("[whop-checkout] base plan has no product", planId);
      throw new Error("Payments are not configured correctly. Ask an admin to check the Whop plan.");
    }

    const quantity = data.quantity;
    const total = quantity * ACCOUNT_PRICE;
    const planType = asString(basePlan.plan_type) ?? "renewal";
    const billingPeriod = typeof basePlan.billing_period === "number" ? basePlan.billing_period : 30;
    const currency = asString(basePlan.currency) ?? "usd";

    const metadata = {
      org_id: context.orgId,
      user_id: context.userId,
      quantity,
    };

    const checkout = await whopRequest("/checkout_configurations", apiKey, {
      method: "POST",
      body: JSON.stringify({
        plan: {
          product_id: productId,
          currency,
          plan_type: planType,
          release_method: asString(basePlan.release_method) ?? "buy_now",
          initial_price: total,
          renewal_price: planType === "renewal" ? total : null,
          billing_period: planType === "renewal" ? billingPeriod : null,
          expiration_days: typeof basePlan.expiration_days === "number" ? basePlan.expiration_days : null,
          title: `${quantity} Instagram ${quantity === 1 ? "account" : "accounts"}`,
          description: `Loomly subscription for ${quantity} Instagram ${quantity === 1 ? "account" : "accounts"}.`,
          visibility: "hidden",
          unlimited_stock: true,
          metadata,
          force_create_new_plan: true,
        },
        metadata,
      }),
    });

    const url =
      asString(checkout.purchase_url) ??
      asString(checkout.checkout_url) ??
      asString(asRecord(checkout.data)?.purchase_url);

    if (!url) {
      console.error("[whop-checkout] no purchase_url in response", JSON.stringify(checkout).slice(0, 500));
      throw new Error("Could not start checkout. Please try again or contact support.");
    }

    return { url };
  });
