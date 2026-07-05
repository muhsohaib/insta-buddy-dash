// Deliveries core — bridges `order_item_deliverables` → spec Delivery.
// See docs/openapi.json → schemas.Delivery.
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";

const SELECT =
  "id, order_item_id, ig_username, ig_password, delivered_at, accepted_at, issue_reported_at, issue_reason, created_at, updated_at, order_items!inner(id, order_id, orders!inner(id, org_id))";

type Row = {
  id: string;
  order_item_id: string;
  ig_username: string | null;
  ig_password: string | null;
  delivered_at: string | null;
  accepted_at: string | null;
  issue_reported_at: string | null;
  issue_reason: string | null;
  created_at: string;
  updated_at: string;
  order_items: {
    id: string;
    order_id: string;
    orders: { id: string; org_id: string } | Array<{ id: string; org_id: string }>;
  };
};

export type DeliveryStatus = "delivered" | "accepted" | "issue_reported";

export type DeliveryView = {
  id: string;
  object: "delivery";
  order_id: string;
  order_item_id: string;
  status: DeliveryStatus;
  username: string | null;
  delivered_at: string | null;
  accepted_at: string | null;
  issue_reported_at: string | null;
  issue_reason: string | null;
  created_at: string;
  updated_at: string;
};

function toView(r: Row): DeliveryView {
  const status: DeliveryStatus = r.issue_reported_at
    ? "issue_reported"
    : r.accepted_at
      ? "accepted"
      : "delivered";
  return {
    id: r.id,
    object: "delivery",
    order_id: r.order_items.order_id,
    order_item_id: r.order_item_id,
    status,
    username: r.ig_username,
    delivered_at: r.delivered_at,
    accepted_at: r.accepted_at,
    issue_reported_at: r.issue_reported_at,
    issue_reason: r.issue_reason,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listDeliveries(
  auth: ApiAuth,
  opts: { limit: number; cursor: ParsedCursor | null; orderId?: string | null; status?: string | null },
) {
  let q = auth.supabase
    .from("order_item_deliverables")
    .select(SELECT)
    .eq("order_items.orders.org_id", auth.orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);
  if (opts.cursor) {
    q = q.or(
      `created_at.lt.${opts.cursor.ts},and(created_at.eq.${opts.cursor.ts},id.lt.${opts.cursor.id})`,
    );
  }
  if (opts.orderId) q = q.eq("order_items.order_id", opts.orderId);
  const { data, error } = await q;
  if (error) throw new SpecError("internal", error.message);
  let rows = (data ?? []) as unknown as Row[];
  if (opts.status) rows = rows.filter((r) => toView(r).status === opts.status);
  const overflow = rows.length > opts.limit;
  const trimmed = overflow ? rows.slice(0, opts.limit) : rows;
  const last = trimmed[trimmed.length - 1];
  return {
    data: trimmed.map(toView),
    page: {
      has_more: overflow,
      next_cursor: overflow && last ? encodeCursor(last.created_at, last.id) : null,
    },
  };
}

export async function getDelivery(auth: ApiAuth, id: string): Promise<DeliveryView> {
  const { data, error } = await auth.supabase
    .from("order_item_deliverables")
    .select(SELECT)
    .eq("id", id)
    .eq("order_items.orders.org_id", auth.orgId)
    .maybeSingle();
  if (error) throw new SpecError("internal", error.message);
  if (!data) throw new SpecError("not_found", `Delivery ${id} not found`);
  return toView(data as unknown as Row);
}

export async function acceptDelivery(auth: ApiAuth, id: string): Promise<DeliveryView> {
  await getDelivery(auth, id); // authz + existence
  const { data, error } = await auth.supabase
    .from("order_item_deliverables")
    .update({ accepted_at: new Date().toISOString(), issue_reported_at: null, issue_reason: null })
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toView(data as unknown as Row);
}

export async function reportIssue(
  auth: ApiAuth,
  id: string,
  reason: string,
): Promise<DeliveryView> {
  await getDelivery(auth, id);
  const { data, error } = await auth.supabase
    .from("order_item_deliverables")
    .update({
      issue_reported_at: new Date().toISOString(),
      issue_reason: reason,
      accepted_at: null,
    })
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toView(data as unknown as Row);
}
