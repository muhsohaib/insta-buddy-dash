// Core publication logic — single source of truth.
// Both the website (via createServerFn wrappers) and the public REST API
// (/api/public/v1/publications/*) call these functions. Anything reaching a
// publication row goes through this file.
import type { SupabaseClient } from "@supabase/supabase-js";

export type PubActor = "user" | "api_key" | "system";
export type PubCtx = {
  supabase: SupabaseClient;
  orgId: string;
  userId: string | null;
  actor: PubActor;
  source?: string;
};

export type PublicationType = "reel" | "image" | "carousel" | "video";
export type PublicationStatus =
  | "draft"
  | "scheduled"
  | "ready_for_publishing"
  | "publishing"
  | "published"
  | "failed";

export type MediaInput = {
  kind: "video" | "image";
  bunny_video_id?: string | null;
  bunny_library_id?: string | null;
  thumbnail_url?: string | null;
  image_url?: string | null;
};

export type CreatePublicationInput = {
  account_id: string;
  type?: PublicationType;
  caption?: string;
  hashtags?: string[];
  scheduled_at: string;
  notes?: string;
  campaign_id?: string | null;
  media: MediaInput[];
  status?: "draft" | "scheduled";
};

async function logEvent(
  ctx: PubCtx,
  publication_id: string,
  event_type: string,
  payload: Record<string, unknown> = {},
) {
  await ctx.supabase.from("publication_events").insert({
    publication_id,
    event_type,
    actor_type: ctx.actor,
    actor_id: ctx.userId ?? null,
    payload,
  });
}

async function assertAccount(ctx: PubCtx, account_id: string) {
  const { data, error } = await ctx.supabase
    .from("instagram_accounts")
    .select("id, org_id, status")
    .eq("id", account_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.org_id !== ctx.orgId) throw new Error("Account not found");
  if (data.status !== "ready") throw new Error("Account is not ready");
}

const SELECT = "*, publication_media(*)";

export async function listPublicationsInRangeCore(
  ctx: PubCtx,
  opts: { from?: string; to?: string; account_id?: string; status?: PublicationStatus } = {},
) {
  let q = ctx.supabase
    .from("publications")
    .select(SELECT)
    .eq("org_id", ctx.orgId)
    .order("scheduled_at", { ascending: true });
  if (opts.from) q = q.gte("scheduled_at", opts.from);
  if (opts.to) q = q.lte("scheduled_at", opts.to);
  if (opts.account_id) q = q.eq("account_id", opts.account_id);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPublicationCore(ctx: PubCtx, id: string) {
  const { data, error } = await ctx.supabase
    .from("publications")
    .select(SELECT)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Publication not found");
  return data;
}

export async function createPublicationCore(ctx: PubCtx, input: CreatePublicationInput) {
  if (!ctx.userId) throw new Error("A user must be attributed to the publication");
  await assertAccount(ctx, input.account_id);
  if (!input.media || input.media.length === 0) throw new Error("At least one media item is required");

  const status: PublicationStatus = input.status ?? "scheduled";

  const { data: pub, error } = await ctx.supabase
    .from("publications")
    .insert({
      org_id: ctx.orgId,
      account_id: input.account_id,
      campaign_id: input.campaign_id ?? null,
      type: input.type ?? "reel",
      status,
      caption: input.caption ?? "",
      hashtags: input.hashtags ?? [],
      scheduled_at: input.scheduled_at,
      notes: input.notes ?? "",
      source: ctx.source ?? (ctx.actor === "api_key" ? "api" : "web"),
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const mediaRows = input.media.map((m, i) => ({
    publication_id: pub.id,
    position: i,
    kind: m.kind,
    bunny_video_id: m.bunny_video_id ?? null,
    bunny_library_id: m.bunny_library_id ?? null,
    thumbnail_url: m.thumbnail_url ?? null,
    image_url: m.image_url ?? null,
  }));
  const { error: mErr } = await ctx.supabase.from("publication_media").insert(mediaRows);
  if (mErr) throw new Error(mErr.message);

  await logEvent(ctx, pub.id, "created", { source: ctx.source, status });
  return getPublicationCore(ctx, pub.id);
}

export type UpdatePublicationInput = Partial<{
  caption: string;
  hashtags: string[];
  scheduled_at: string;
  notes: string;
  campaign_id: string | null;
  assigned_to: string | null;
  status: PublicationStatus;
  instagram_post_url: string | null;
  failure_reason: string | null;
}>;

const LOCKED_STATUSES: PublicationStatus[] = ["publishing", "published"];

export async function updatePublicationCore(
  ctx: PubCtx,
  id: string,
  patch: UpdatePublicationInput,
) {
  const current = await getPublicationCore(ctx, id);
  // Guard: once publishing/published, only status transitions (published/failed) allowed
  if (LOCKED_STATUSES.includes(current.status as PublicationStatus)) {
    const onlyStatus = Object.keys(patch).every((k) =>
      ["status", "instagram_post_url", "failure_reason"].includes(k),
    );
    if (!onlyStatus) throw new Error("Publication is locked; only status may be updated");
  }
  const { error } = await ctx.supabase
    .from("publications")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw new Error(error.message);
  await logEvent(ctx, id, "updated", patch as Record<string, unknown>);
  return getPublicationCore(ctx, id);
}

export async function deletePublicationCore(ctx: PubCtx, id: string) {
  const current = await getPublicationCore(ctx, id);
  if (LOCKED_STATUSES.includes(current.status as PublicationStatus)) {
    throw new Error("Cannot delete a publication that is publishing or published");
  }
  const { error } = await ctx.supabase
    .from("publications")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function markPublishedCore(
  ctx: PubCtx,
  id: string,
  input: { instagram_post_url?: string | null } = {},
) {
  return updatePublicationCore(ctx, id, {
    status: "published",
    instagram_post_url: input.instagram_post_url ?? null,
  });
}

export async function getPublicationStatusCore(ctx: PubCtx, id: string) {
  const { data, error } = await ctx.supabase
    .from("publications")
    .select("id, status, scheduled_at, published_at, instagram_post_url, failure_reason, updated_at")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Publication not found");
  return data;
}

export async function cancelPublicationCore(ctx: PubCtx, id: string) {
  const current = await getPublicationCore(ctx, id);
  if (LOCKED_STATUSES.includes(current.status as PublicationStatus)) {
    throw new Error("Cannot cancel a publication that is publishing or published");
  }
  await logEvent(ctx, id, "cancelled", { previous_status: current.status });
  return deletePublicationCore(ctx, id);
}

// -------- Admin queue --------

export async function adminListPublicationsCore(
  supabase: SupabaseClient,
  opts: { status?: PublicationStatus | "today" } = {},
) {
  let q = supabase
    .from("publications")
    .select(
      "*, publication_media(*), instagram_accounts(id, label, account_details(ig_username, app_name))",
    )
    .order("scheduled_at", { ascending: true });
  if (opts.status === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    q = q.gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString());
  } else if (opts.status) {
    q = q.eq("status", opts.status);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminTransitionPublicationCore(
  supabase: SupabaseClient,
  id: string,
  status: PublicationStatus,
  extras: { instagram_post_url?: string | null; failure_reason?: string | null } = {},
) {
  const patch: Record<string, unknown> = { status };
  if (extras.instagram_post_url !== undefined) patch.instagram_post_url = extras.instagram_post_url;
  if (extras.failure_reason !== undefined) patch.failure_reason = extras.failure_reason;
  const { data, error } = await supabase
    .from("publications")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
