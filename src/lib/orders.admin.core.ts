// Admin-facing order operations. Shared by the admin server functions
// (createServerFn callers from the website) and any future admin REST layer.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function adminListOrdersCore(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, products(name, code), order_items(id, status)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminGetOrderCore(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, products(*), order_items(*, order_item_details(*), order_item_deliverables(*))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Order not found");
  return data;
}

export async function adminUpdateItemStatusCore(
  supabase: SupabaseClient,
  id: string,
  status: "waiting" | "creating" | "warming" | "ready" | "delivered" | "cancelled",
) {
  const { error } = await supabase.from("order_items").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminSaveDeliverableCore(
  supabase: SupabaseClient,
  userId: string,
  order_item_id: string,
  data: Record<string, unknown>,
  mark_ready: boolean,
) {
  const { error } = await supabase.from("order_item_deliverables").upsert(
    {
      order_item_id,
      data: data as unknown as Record<string, unknown>,
      delivered_at: new Date().toISOString(),
      delivered_by: userId,
    },
    { onConflict: "order_item_id" },
  );
  if (error) throw new Error(error.message);
  if (mark_ready) {
    const { error: uErr } = await supabase
      .from("order_items")
      .update({ status: "ready" })
      .eq("id", order_item_id);
    if (uErr) throw new Error(uErr.message);
  }
  return { ok: true };
}
