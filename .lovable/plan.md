## The problem

The pricing page lets a user pick 1–20 accounts, but the server function just builds a URL like `https://whop.com/checkout/<PLAN_ID>?quantity=N`. Whop's hosted checkout page ignores the `quantity` query param — the plan itself has a fixed price ($49), so every user lands on a $49/1-seat checkout regardless of what they picked.

Whop plans are priced per plan, not per unit. To charge N × $49 we have to tell Whop the quantity **when creating the checkout**, not in the redirect URL. Whop exposes this through the **Checkout Sessions API**, which returns a one-time `purchase_url` that already has the correct quantity and total baked in.

## The fix

Switch `createWhopCheckout` from "build a URL" to "call Whop's Checkout Sessions API server-side, then redirect to the returned purchase URL".

### 1. Add a Whop API key secret

The Checkout Sessions endpoint is authenticated. We need a new secret `WHOP_API_KEY` (the app's Whop API key from the Whop dashboard → Developer → API keys). I'll request it via the secrets tool during build.

`WHOP_PLAN_ID` (already set) stays as-is.

### 2. Rewrite `src/lib/whop.functions.ts`

Inside the handler:

```ts
const res = await fetch("https://api.whop.com/api/v5/checkout_sessions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    plan_id: process.env.WHOP_PLAN_ID,
    quantity: data.quantity,
    metadata: {
      org_id: context.orgId,
      user_id: context.userId,
      quantity: data.quantity,
    },
  }),
});
```

- Parse the JSON, pull `purchase_url` (fallback to `checkout_url`), return `{ url }`.
- On non-2xx, log the response body and throw a friendly error the pricing page can toast.
- Keep the existing `min(1).max(50)` Zod validation and the `requireClerkOrg` middleware — nothing else on the pricing page changes.

### 3. Webhook side — no changes needed

`src/routes/api/public/webhooks/whop.ts` already reads `metadata.quantity` and provisions that many `instagram_accounts` rows, so once Whop sends the real quantity, provisioning will match the amount paid.

### 4. Verification

After the change, from the pricing page:
- Pick 10 → click Continue → the returned Whop checkout should show **$490/month** with 10 seats.
- Pick 1 → should show **$49/month**.
- After a successful test payment, the webhook should insert 10 (or 1) `instagram_accounts` rows for the active workspace.

## Files touched

- `src/lib/whop.functions.ts` — replace URL-builder with a Checkout Sessions API call.
- New secret: `WHOP_API_KEY` (requested at build time, not committed).

No UI, pricing copy, or webhook logic changes.
