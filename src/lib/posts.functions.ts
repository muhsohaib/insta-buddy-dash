import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkOrg } from "@/integrations/clerk/auth-middleware";

export const listMyPostsForAccount = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => z.object({ account_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: posts, error } = await context.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("account_id", data.account_id)
      .eq("org_id", context.orgId)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return posts ?? [];
  });

const createPostSchema = z.object({
  account_id: z.string().uuid(),
  caption: z.string().max(2200).default(""),
  scheduled_at: z.string(),
  bunny_video_id: z.string().min(1),
  bunny_library_id: z.string().min(1),
  thumbnail_url: z.string().url().optional().nullable(),
});

export const createScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => createPostSchema.parse(input))
  .handler(async ({ context, data }) => {
    // Ensure the account is Ready and owned by the active org
    const { data: acct, error: acctErr } = await context.supabase
      .from("instagram_accounts")
      .select("id, status, org_id")
      .eq("id", data.account_id)
      .maybeSingle();
    if (acctErr) throw new Error(acctErr.message);
    if (!acct || acct.org_id !== context.orgId) throw new Error("Account not found");
    if (acct.status !== "ready") throw new Error("Account is not ready for scheduling yet");

    const { data: post, error } = await context.supabase
      .from("scheduled_posts")
      .insert({
        account_id: data.account_id,
        user_id: context.userId,
        org_id: context.orgId,
        caption: data.caption,
        scheduled_at: data.scheduled_at,
        bunny_video_id: data.bunny_video_id,
        bunny_library_id: data.bunny_library_id,
        thumbnail_url: data.thumbnail_url ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return post;
  });

export const deleteScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", data.id)
      .eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
