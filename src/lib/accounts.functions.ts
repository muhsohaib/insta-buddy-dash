import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkAuth, requireClerkOrg } from "@/integrations/clerk/auth-middleware";

export const listMyAccounts = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("instagram_accounts")
      .select("id, status, label, created_at, account_details(ig_username, app_name, profile_photo_url)")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: acct, error } = await context.supabase
      .from("instagram_accounts")
      .select("*, account_details(*)")
      .eq("id", data.id)
      .eq("org_id", context.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return acct;
  });

export const createAdditionalAccount = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", context.orgId)
      .neq("status", "cancelled");
    if (countErr) throw new Error(countErr.message);

    const { data, error } = await supabaseAdmin
      .from("instagram_accounts")
      .insert({
        user_id: context.userId,
        org_id: context.orgId,
        status: "pending_details",
        label: `Account ${(count ?? 0) + 1}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

const detailsSchema = z.object({
  account_id: z.string().uuid(),
  profile_photo_url: z.string().url().optional().nullable(),
  ig_username: z.string().max(80).optional().nullable(),
  bio: z.string().min(1).max(500),
  target_country: z.string().min(1).max(80),
  app_name: z.string().min(1).max(120),
  website: z.string().max(300).optional().nullable(),
  niche: z.string().min(1).max(120),
  competitors: z.array(z.string().max(300)).max(20).default([]),
  notes: z.string().max(2000).optional().nullable(),
});

export const submitAccountDetails = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => detailsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { account_id, ...rest } = data;

    // Confirm the account belongs to the active org before writing details.
    const { data: acct, error: acctErr } = await context.supabase
      .from("instagram_accounts")
      .select("id, org_id, status")
      .eq("id", account_id)
      .maybeSingle();
    if (acctErr) throw new Error(acctErr.message);
    if (!acct || acct.org_id !== context.orgId) throw new Error("Account not found");

    const { error: upErr } = await context.supabase
      .from("account_details")
      .upsert(
        { account_id, user_id: context.userId, org_id: context.orgId, ...rest },
        { onConflict: "account_id" },
      );
    if (upErr) throw new Error(upErr.message);
    const { error: statusErr } = await context.supabase
      .from("instagram_accounts")
      .update({ status: "creating" })
      .eq("id", account_id)
      .eq("status", "pending_details");
    if (statusErr) throw new Error(statusErr.message);
    return { ok: true };
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("*")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const uploadPhotoPath = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => z.object({ ext: z.string().max(5) }).parse(input))
  .handler(async ({ context, data }) => {
    const path = `${context.orgId}/${crypto.randomUUID()}.${data.ext.replace(/[^a-z0-9]/gi, "")}`;
    const { data: signed, error } = await context.supabase.storage
      .from("account-photos")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const finalizePhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input) => z.object({ path: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("account-photos")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 10);
    if (error) throw new Error(error.message);
    return { signedUrl: signed.signedUrl };
  });
