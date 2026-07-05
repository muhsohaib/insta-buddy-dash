// Search core — cross-resource keyword search.
// Spec: docs/openapi.json → operationId `search.search`.
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";

export type SearchHit = {
  id: string;
  type: "post" | "account" | "asset" | "order" | "product";
  title: string;
  snippet: string | null;
  score: number;
};

export async function search(
  auth: ApiAuth,
  opts: { q: string; types?: string[]; limit: number },
): Promise<SearchHit[]> {
  const q = opts.q.trim();
  if (!q) throw new SpecError("invalid_input", "q required", { q: "required" });
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const wanted = new Set(opts.types?.length ? opts.types : ["post", "account", "asset", "order", "product"]);
  const results: SearchHit[] = [];

  if (wanted.has("post")) {
    const { data } = await auth.supabase
      .from("publications")
      .select("id, caption, created_at, org_id")
      .eq("org_id", auth.orgId)
      .ilike("caption", like)
      .limit(opts.limit);
    for (const r of (data as Array<{ id: string; caption: string | null }> | null) ?? []) {
      results.push({
        id: r.id,
        type: "post",
        title: (r.caption ?? "").slice(0, 80) || "(no caption)",
        snippet: r.caption,
        score: 1,
      });
    }
  }
  if (wanted.has("account")) {
    const { data } = await auth.supabase
      .from("account_details")
      .select("id, ig_username, app_name, instagram_accounts!inner(org_id)")
      .eq("instagram_accounts.org_id", auth.orgId)
      .ilike("ig_username", like)
      .limit(opts.limit);
    for (const r of (data as Array<{ id: string; ig_username: string | null; app_name: string | null }> | null) ?? []) {
      results.push({
        id: r.id,
        type: "account",
        title: r.ig_username ?? r.app_name ?? "(no username)",
        snippet: r.app_name,
        score: 1,
      });
    }
  }
  if (wanted.has("asset")) {
    const { data } = await auth.supabase
      .from("assets")
      .select("id, filename")
      .eq("workspace_id", auth.orgId)
      .ilike("filename", like)
      .limit(opts.limit);
    for (const r of (data as Array<{ id: string; filename: string }> | null) ?? []) {
      results.push({ id: r.id, type: "asset", title: r.filename, snippet: null, score: 1 });
    }
  }
  if (wanted.has("order")) {
    const { data } = await auth.supabase
      .from("orders")
      .select("id, status")
      .eq("org_id", auth.orgId)
      .ilike("id", like)
      .limit(opts.limit);
    for (const r of (data as Array<{ id: string; status: string }> | null) ?? []) {
      results.push({ id: r.id, type: "order", title: r.id, snippet: r.status, score: 0.5 });
    }
  }
  if (wanted.has("product")) {
    const { data } = await auth.supabase
      .from("products")
      .select("id, name, description")
      .ilike("name", like)
      .limit(opts.limit);
    for (const r of (data as Array<{ id: string; name: string; description: string | null }> | null) ?? []) {
      results.push({ id: r.id, type: "product", title: r.name, snippet: r.description, score: 1 });
    }
  }
  return results.slice(0, opts.limit);
}
