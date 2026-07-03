// Core order logic — the single source of truth for all order operations.
// Both the website (via createServerFn in orders.functions.ts) and the
// public REST API (src/routes/api/public/v1/*) call these functions.
// Anything reaching an order MUST go through this file.
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = { supabase: SupabaseClient; orgId: string; userId: string | null };

// ---------- Catalog ----------

export async function listProductsCore({ supabase }: { supabase: SupabaseClient }) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("unit_price_cents", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPrimaryProductCore({ supabase }: { supabase: SupabaseClient }) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("code", "instagram_account")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Product not configured");
  return data;
}

// ---------- Orders: read ----------

export async function listOrdersCore({ supabase, orgId }: Ctx) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(name, code), order_items(id, status)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOrderCore(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase
    .from("orders")
    .select(
      "*, products(*), order_items(*, order_item_details(*), order_item_deliverables(*))",
    )
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Order not found");
  return data;
}

export async function getOrderStatusCore(ctx: Ctx, id: string) {
  const order = await getOrderCore(ctx, id);
  const items = (order as unknown as { order_items?: { id: string; status: string }[] })
    .order_items ?? [];
  return {
    id: order.id,
    order_number: order.order_number,
    payment_status: order.payment_status,
    status: order.status,
    quantity: order.quantity,
    items: items.map((i) => ({ id: i.id, status: i.status })),
  };
}

export async function getOrderDeliverablesCore(ctx: Ctx, id: string) {
  const order = await getOrderCore(ctx, id);
  type Item = {
    id: string;
    status: string;
    position: number;
    order_item_deliverables?: { data: unknown; delivered_at: string | null }[];
  };
  const items = (order as unknown as { order_items?: Item[] }).order_items ?? [];
  return {
    order_id: order.id,
    items: items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        item_id: i.id,
        position: i.position,
        status: i.status,
        delivered_at: i.order_item_deliverables?.[0]?.delivered_at ?? null,
        deliverable: i.order_item_deliverables?.[0]?.data ?? null,
      })),
  };
}

// ---------- Orders: create + Whop checkout ----------

export async function createOrderCore(
  ctx: Ctx,
  input: { quantity: number },
): Promise<{ orderId: string; url: string }> {
  if (!ctx.userId) throw new Error("A user must be attributed to the order");
  const product = await getPrimaryProductCore({ supabase: ctx.supabase });
  const unit = product.unit_price_cents;
  const total = unit * input.quantity;

  const { data: order, error: oErr } = await ctx.supabase
    .from("orders")
    .insert({
      org_id: ctx.orgId,
      created_by_user_id: ctx.userId,
      product_id: product.id,
      quantity: input.quantity,
      unit_price_cents: unit,
      subtotal_cents: total,
      total_cents: total,
      currency: product.currency,
      payment_status: "pending",
      status: "awaiting_payment",
    })
    .select()
    .single();
  if (oErr) throw new Error(oErr.message);

  const planId = process.env.WHOP_PLAN_ID;
  const apiKey = process.env.WHOP_API_KEY;
  if (!planId || !apiKey) throw new Error("Payments are not configured.");

  const basePlanRes = await fetch(`https://api.whop.com/api/v1/plans/${planId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Api-Version-Date": "2026-07-01",
    },
  });
  if (!basePlanRes.ok) {
    console.error("[orders] fetch plan failed", basePlanRes.status, await basePlanRes.text());
    throw new Error("Could not start checkout.");
  }
  const basePlan = (await basePlanRes.json()) as Record<string, unknown>;
  const product_id =
    (basePlan.product as { id?: string } | undefined)?.id ??
    (basePlan.product_id as string | undefined);
  if (!product_id) throw new Error("Whop plan is misconfigured.");

  const metadata = {
    org_id: ctx.orgId,
    user_id: ctx.userId,
    order_id: order.id,
    quantity: input.quantity,
  };
  const dollars = Math.round(total / 100);

  const checkoutRes = await fetch(`https://api.whop.com/api/v1/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Api-Version-Date": "2026-07-01",
    },
    body: JSON.stringify({
      plan: {
        product_id,
        currency: (basePlan.currency as string) ?? "usd",
        plan_type: (basePlan.plan_type as string) ?? "renewal",
        release_method: (basePlan.release_method as string) ?? "buy_now",
        initial_price: 0,
        renewal_price: dollars,
        billing_period: (basePlan.billing_period as number) ?? 30,
        title: `${input.quantity} Instagram ${input.quantity === 1 ? "account" : "accounts"}`,
        description: `Order #${order.order_number}`,
        visibility: "hidden",
        unlimited_stock: true,
        metadata,
        force_create_new_plan: true,
      },
      metadata,
    }),
  });
  if (!checkoutRes.ok) {
    console.error("[orders] checkout failed", checkoutRes.status, await checkoutRes.text());
    throw new Error("Could not start checkout.");
  }
  const checkout = (await checkoutRes.json()) as Record<string, unknown>;
  const url =
    (checkout.purchase_url as string | undefined) ??
    (checkout.checkout_url as string | undefined) ??
    ((checkout.data as { purchase_url?: string } | undefined)?.purchase_url);
  if (!url) throw new Error("Could not start checkout.");

  await ctx.supabase.from("orders").update({ payment_ref: url }).eq("id", order.id);
  return { orderId: order.id, url };
}

// ---------- Orders: per-item details ----------

export type ItemDetailInput = { order_item_id: string; data: Record<string, unknown> };

export async function saveItemDetailsCore(
  ctx: Ctx,
  input: { order_id: string; items: ItemDetailInput[]; submit: boolean },
) {
  const { data: order, error: oErr } = await ctx.supabase
    .from("orders")
    .select("id, org_id, payment_status, status")
    .eq("id", input.order_id)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!order || order.org_id !== ctx.orgId) throw new Error("Order not found");
  if (order.payment_status !== "paid") throw new Error("Order is not paid yet");

  for (const item of input.items) {
    const { error } = await ctx.supabase.from("order_item_details").upsert(
      {
        order_item_id: item.order_item_id,
        data: item.data as unknown as Record<string, unknown>,
        submitted_at: input.submit ? new Date().toISOString() : null,
      },
      { onConflict: "order_item_id" },
    );
    if (error) throw new Error(error.message);

    if (input.submit) {
      await ctx.supabase
        .from("order_items")
        .update({ status: "creating" })
        .eq("id", item.order_item_id)
        .eq("status", "waiting");

      const { data: acct } = await ctx.supabase
        .from("instagram_accounts")
        .select("id, user_id, org_id")
        .eq("order_item_id", item.order_item_id)
        .maybeSingle();
      if (acct) {
        const d = item.data as Record<string, unknown>;
        await ctx.supabase.from("account_details").upsert(
          {
            account_id: acct.id,
            user_id: acct.user_id,
            org_id: acct.org_id,
            app_name: String(d.brand_name ?? d.app_name ?? "Untitled"),
            bio: String(d.bio ?? ""),
            niche: String(d.niche ?? ""),
            target_country: String(d.target_country ?? ""),
            website: (d.website as string | null) ?? null,
            profile_photo_url: (d.profile_photo_url as string | null) ?? null,
            competitors: Array.isArray(d.competitors) ? (d.competitors as string[]) : [],
            notes: (d.notes as string | null) ?? null,
            ig_username: (d.username_style as string | null) ?? null,
          },
          { onConflict: "account_id" },
        );
      }
    }
  }
  return { ok: true };
}
