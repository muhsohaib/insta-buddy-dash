// Orders spec core — bridges DB `orders`/`order_items` → spec Order resource.
// See docs/openapi.json → schemas.Order.
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";

export type SpecOrderStatus = "active" | "fulfilled" | "cancelled" | "refunded";

const DB_TO_SPEC: Record<string, SpecOrderStatus> = {
  draft: "active",
  awaiting_payment: "active",
  awaiting_details: "active",
  pending: "active",
  in_progress: "active",
  ready: "fulfilled",
  delivered: "fulfilled",
  cancelled: "cancelled",
};

type OrderRow = {
  id: string;
  org_id: string;
  created_by_user_id: string | null;
  status: string;
  payment_status: string | null;
  currency: string | null;
  total_cents: number | null;
  quantity: number | null;
  product_id: string | null;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
  delivered_at: string | null;
};

export type OrderView = {
  id: string;
  object: "order";
  status: SpecOrderStatus;
  product_id: string | null;
  quantity: number;
  amount_cents: number;
  currency: string;
  payment_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
};

function specStatus(r: OrderRow): SpecOrderStatus {
  if (r.payment_status === "refunded") return "refunded";
  return DB_TO_SPEC[r.status] ?? "active";
}

export function toOrderView(r: OrderRow): OrderView {
  return {
    id: r.id,
    object: "order",
    status: specStatus(r),
    product_id: r.product_id,
    quantity: r.quantity ?? 1,
    amount_cents: r.total_cents ?? 0,
    currency: r.currency ?? "USD",
    payment_status: r.payment_status ?? "unknown",
    metadata: {},
    created_at: r.created_at,
    updated_at: r.updated_at,
    fulfilled_at: r.delivered_at ?? r.ready_at ?? null,
  };
}

export async function listOrdersSpec(
  auth: ApiAuth,
  opts: { limit: number; cursor: ParsedCursor | null; status?: string | null },
) {
  let q = auth.supabase
    .from("orders")
    .select("*")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);
  if (opts.cursor) {
    q = q.or(
      `created_at.lt.${opts.cursor.ts},and(created_at.eq.${opts.cursor.ts},id.lt.${opts.cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw new SpecError("internal", error.message);
  let rows = (data ?? []) as unknown as OrderRow[];
  if (opts.status) rows = rows.filter((r) => specStatus(r) === opts.status);
  const overflow = rows.length > opts.limit;
  const trimmed = overflow ? rows.slice(0, opts.limit) : rows;
  const last = trimmed[trimmed.length - 1];
  return {
    data: trimmed.map(toOrderView),
    page: {
      has_more: overflow,
      next_cursor: overflow && last ? encodeCursor(last.created_at, last.id) : null,
    },
  };
}

export async function getOrderSpec(auth: ApiAuth, id: string): Promise<OrderView> {
  const { data, error } = await auth.supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (error) throw new SpecError("internal", error.message);
  if (!data) throw new SpecError("not_found", `Order ${id} not found`);
  return toOrderView(data as OrderRow);
}

export async function createReplacementOrder(
  auth: ApiAuth,
  originalId: string,
  reason: string,
): Promise<OrderView> {
  const original = await getOrderSpec(auth, originalId);
  const { data, error } = await auth.supabase
    .from("orders")
    .insert({ 
      org_id: auth.orgId,
      user_id: auth.userId,
      product_id: original.product_id,
      quantity: original.quantity,
      currency: original.currency,
      amount_cents: 0,
      status: "awaiting_details",
      payment_status: "paid",
      metadata: { replacement_of: originalId, replacement_reason: reason },
    })
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toOrderView(data as OrderRow);
}
