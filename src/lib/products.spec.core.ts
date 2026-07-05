// Products core — spec: docs/openapi.json → schemas.Product
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";

export type ProductView = {
  id: string;
  object: "product";
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  status: "active" | "inactive";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  active: boolean;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

function toView(r: ProductRow): ProductView {
  return {
    id: r.id,
    object: "product",
    name: r.name,
    description: r.description ?? "",
    price_cents: r.price_cents,
    currency: r.currency,
    status: r.active ? "active" : "inactive",
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listProducts(
  auth: ApiAuth,
  opts: { limit: number; cursor: ParsedCursor | null; status?: string | null },
) {
  let q = auth.supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);
  if (opts.status === "active") q = q.eq("active", true);
  if (opts.status === "inactive") q = q.eq("active", false);
  if (opts.cursor) {
    q = q.or(
      `created_at.lt.${opts.cursor.ts},and(created_at.eq.${opts.cursor.ts},id.lt.${opts.cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw new SpecError("internal", error.message);
  const rows = (data ?? []) as unknown as ProductRow[];
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

export async function getProduct(auth: ApiAuth, id: string): Promise<ProductView> {
  const { data, error } = await auth.supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new SpecError("internal", error.message);
  if (!data) throw new SpecError("not_found", `Product ${id} not found`);
  return toView(data as unknown as ProductRow);
}
