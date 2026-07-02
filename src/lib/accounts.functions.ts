import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("instagram_accounts")
      .select("id, status, label, created_at, account_details(ig_username, app_name, profile_photo_url)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: acct, error } = await context.supabase
      .from("instagram_accounts")
      .select("*, account_details(*)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return acct;
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => detailsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { account_id, ...rest } = data;
    const { error: upErr } = await context.supabase
      .from("account_details")
      .upsert({ account_id, user_id: context.userId, ...rest }, { onConflict: "account_id" });
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const uploadPhotoPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ext: z.string().max(5) }).parse(input))
  .handler(async ({ context, data }) => {
    const path = `${context.userId}/${crypto.randomUUID()}.${data.ext.replace(/[^a-z0-9]/gi, "")}`;
    const { data: signed, error } = await context.supabase.storage
      .from("account-photos")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const finalizePhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ path: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ context, data }) => {
    // 10-year signed URL so private-bucket photos still render for owner and admins.
    const { data: signed, error } = await context.supabase.storage
      .from("account-photos")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 10);
    if (error) throw new Error(error.message);
    return { signedUrl: signed.signedUrl };
  });
