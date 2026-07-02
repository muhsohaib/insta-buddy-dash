import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

export const adminListClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, avatar_url, created_at")
      .order("created_at", { ascending: false });
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, quantity, status");
    const { data: accounts } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id, user_id, status, label, created_at, account_details(*)")
      .order("created_at", { ascending: true });

    return (profiles ?? []).map((p) => {
      const sub = subs?.find((s) => s.user_id === p.id);
      const accts = accounts?.filter((a) => a.user_id === p.id) ?? [];
      return {
        ...p,
        quantity: sub?.quantity ?? 0,
        status: sub?.status ?? "none",
        account_counts: {
          pending_details: accts.filter((a) => a.status === "pending_details").length,
          creating: accts.filter((a) => a.status === "creating").length,
          warming_up: accts.filter((a) => a.status === "warming_up").length,
          ready: accts.filter((a) => a.status === "ready").length,
        },
        account_submissions: accts.map((account) => ({
          id: account.id,
          label: account.label,
          status: account.status,
          created_at: account.created_at,
          details: Array.isArray(account.account_details)
            ? (account.account_details[0] ?? null)
            : (account.account_details ?? null),
        })),
      };
    });
  });

export const adminListAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("instagram_accounts")
      .select("*, account_details(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    let profilesById: Record<string, { email: string | null; full_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      if (pErr) throw new Error(pErr.message);
      profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, { email: p.email, full_name: p.full_name }]));
    }
    return rows.map((r) => ({ ...r, profiles: profilesById[r.user_id] ?? null }));
  });

export const adminUpdateAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending_details", "creating", "warming_up", "ready", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("instagram_accounts")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ status: z.enum(["scheduled", "completed", "all"]).default("scheduled") }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("scheduled_posts")
      .select("*, instagram_accounts!inner(label, account_details(ig_username, app_name)), profiles!inner(email, full_name)")
      .order("scheduled_at", { ascending: true });
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminMarkPostCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("scheduled_posts")
      .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
