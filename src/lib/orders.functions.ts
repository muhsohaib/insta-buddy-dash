import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkAuth, requireClerkOrg } from "@/integrations/clerk/auth-middleware";

// ---------- Product catalog ----------

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("unit_price_cents", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPrimaryProduct = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("*")
      .eq("code", "instagram_account")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Product not configured");
    return data;
  });

// ---------- Customer: orders ----------

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*, products(name, code), order_items(id, status)")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select(
        "*, products(*), order_items(*, order_item_details(*), order_item_deliverables(*))",
      )
      .eq("id", data.id)
      .eq("org_id", context.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    return order;
  });

// ---------- Customer: create draft order + start checkout ----------

export const createOrderAndCheckout = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => z.object({ quantity: z.number().int().min(1).max(10) }).parse(i))
  .handler(async ({ context, data }) => {
    // Load product
    const { data: product, error: pErr } = await context.supabase
      .from("products")
      .select("*")
      .eq("code", "instagram_account")
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!product) throw new Error("Product not configured");

    const unit = product.unit_price_cents;
    const total = unit * data.quantity;

    const { data: order, error: oErr } = await context.supabase
      .from("orders")
      .insert({
        org_id: context.orgId,
        created_by_user_id: context.userId,
        product_id: product.id,
        quantity: data.quantity,
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

    // Start Whop checkout
    const planId = process.env.WHOP_PLAN_ID;
    const apiKey = process.env.WHOP_API_KEY;
    if (!planId || !apiKey) {
      throw new Error("Payments are not configured. Ask an admin to add Whop credentials.");
    }

    const basePlanRes = await fetch(`https://api.whop.com/api/v1/plans/${planId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Api-Version-Date": "2026-07-01",
      },
    });
    if (!basePlanRes.ok) {
      const t = await basePlanRes.text();
      console.error("[orders] fetch plan failed", basePlanRes.status, t);
      throw new Error("Could not start checkout.");
    }
    const basePlan = (await basePlanRes.json()) as Record<string, unknown>;
    const product_id =
      (basePlan.product as { id?: string } | undefined)?.id ??
      (basePlan.product_id as string | undefined);
    if (!product_id) throw new Error("Whop plan is misconfigured.");

    const metadata = {
      org_id: context.orgId,
      user_id: context.userId,
      order_id: order.id,
      quantity: data.quantity,
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
          title: `${data.quantity} Instagram ${data.quantity === 1 ? "account" : "accounts"}`,
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
      const t = await checkoutRes.text();
      console.error("[orders] checkout failed", checkoutRes.status, t);
      throw new Error("Could not start checkout.");
    }
    const checkout = (await checkoutRes.json()) as Record<string, unknown>;
    const url =
      (checkout.purchase_url as string | undefined) ??
      (checkout.checkout_url as string | undefined) ??
      ((checkout.data as { purchase_url?: string } | undefined)?.purchase_url);
    if (!url) throw new Error("Could not start checkout.");

    // Save payment_ref for reconciliation
    await context.supabase
      .from("orders")
      .update({ payment_ref: url })
      .eq("id", order.id);

    return { orderId: order.id, url };
  });

// ---------- Customer: submit per-item details ----------

const itemDetailSchema = z.object({
  order_item_id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
});

export const saveItemDetails = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) =>
    z.object({
      order_id: z.string().uuid(),
      items: z.array(itemDetailSchema).min(1),
      submit: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    // Verify the order belongs to the org and is paid
    const { data: order, error: oErr } = await context.supabase
      .from("orders")
      .select("id, org_id, payment_status, status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!order || order.org_id !== context.orgId) throw new Error("Order not found");
    if (order.payment_status !== "paid") throw new Error("Order is not paid yet");

    for (const item of data.items) {
      const { error } = await context.supabase
        .from("order_item_details")
        .upsert(
          {
            order_item_id: item.order_item_id,
            data: item.data,
            submitted_at: data.submit ? new Date().toISOString() : null,
          },
          { onConflict: "order_item_id" },
        );
      if (error) throw new Error(error.message);

      if (data.submit) {
        // Move item into the admin queue and mirror details into legacy account_details
        await context.supabase
          .from("order_items")
          .update({ status: "creating" })
          .eq("id", item.order_item_id)
          .eq("status", "waiting");

        // Mirror into account_details so admin/calendar keep showing them
        const { data: acct } = await context.supabase
          .from("instagram_accounts")
          .select("id, user_id, org_id")
          .eq("order_item_id", item.order_item_id)
          .maybeSingle();
        if (acct) {
          const d = item.data as Record<string, unknown>;
          await context.supabase.from("account_details").upsert(
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
  });

// ---------- Admin ----------

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("orders")
      .select("*, products(name, code), order_items(id, status)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGetOrder = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select(
        "*, products(*), order_items(*, order_item_details(*), order_item_deliverables(*))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    return order;
  });

export const adminUpdateItemStatus = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["waiting", "creating", "warming", "ready", "delivered", "cancelled"]),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("order_items")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveDeliverable = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i) =>
    z.object({
      order_item_id: z.string().uuid(),
      data: z.record(z.string(), z.unknown()),
      mark_ready: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("order_item_deliverables")
      .upsert(
        {
          order_item_id: data.order_item_id,
          data: data.data,
          delivered_at: new Date().toISOString(),
          delivered_by: context.userId,
        },
        { onConflict: "order_item_id" },
      );
    if (error) throw new Error(error.message);
    if (data.mark_ready) {
      const { error: uErr } = await context.supabase
        .from("order_items")
        .update({ status: "ready" })
        .eq("id", data.order_item_id);
      if (uErr) throw new Error(uErr.message);
    }
    return { ok: true };
  });
