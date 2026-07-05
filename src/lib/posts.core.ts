// Posts core — bridges the `publications` table + `publication_media` rows to
// the spec Post resource (docs/openapi.json → schemas.Post).
//
// DB → spec status collapse:
//   draft                → draft
//   scheduled            → scheduled
//   ready_for_publishing → scheduled     (still queued)
//   publishing           → publishing
//   published            → published
//   failed               → failed
//   cancelled            → cancelled
//
// Assets (Phase 7d): `asset_ids` on create/update are validated against the
// `assets` table (workspace-scoped, status='ready') and persisted as real
// `publication_media.asset_id` foreign keys. The legacy `asset://<id>` text
// placeholder in `image_url` is still read as a fallback for older rows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";

export type SpecPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type SpecVia = "web" | "api" | "mcp" | "system";

const DB_TO_SPEC_STATUS: Record<string, SpecPostStatus> = {
  draft: "draft",
  scheduled: "scheduled",
  ready_for_publishing: "scheduled",
  publishing: "publishing",
  published: "published",
  failed: "failed",
  cancelled: "cancelled",
};

const ASSET_PREFIX = "asset://";

const PUB_SELECT =
  "id, org_id, account_id, campaign_id, caption, hashtags, notes, scheduled_at, published_at, status, source, failure_reason, instagram_post_url, created_by, created_at, updated_at, publication_media(id, position, kind, bunny_video_id, image_url, thumbnail_url, asset_id), instagram_accounts(id, label, account_details(ig_username))";

type PubRow = {
  id: string;
  org_id: string;
  account_id: string;
  campaign_id: string | null;
  caption: string;
  hashtags: string[];
  notes: string;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  source: string;
  failure_reason: string | null;
  instagram_post_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  publication_media: Array<{
    id: string;
    position: number;
    kind: "image" | "video";
    bunny_video_id: string | null;
    image_url: string | null;
    thumbnail_url: string | null;
    asset_id: string | null;
  }>;
  instagram_accounts: { id: string; label: string | null; account_details: { ig_username: string | null } | null } | null;
};

export type PostView = {
  id: string;
  object: "post";
  created_at: string;
  updated_at: string;
  created_by: string;
  created_via: SpecVia;
  agent: string | null;
  status: SpecPostStatus;
  platform: "instagram";
  account: { id: string; object: "social_account"; handle?: string };
  assets: Array<{ id: string; object: "asset" }>;
  caption: string;
  first_comment: string | null;
  tags: string[];
  campaign: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  failure: { code: string; message: string } | null;
  links: { self: string; related?: Record<string, string> };
};

function mapSource(source: string): SpecVia {
  if (source === "api") return "api";
  if (source === "mcp") return "mcp";
  if (source === "system") return "system";
  return "web";
}

function assetIdFromMedia(m: PubRow["publication_media"][number]): string {
  // Prefer real FK (Phase 7d+). Fall back to legacy asset:// placeholder or
  // bunny-derived pseudo-id for rows created before 7d.
  if (m.asset_id) return m.asset_id;
  if (m.image_url && m.image_url.startsWith(ASSET_PREFIX)) {
    return m.image_url.slice(ASSET_PREFIX.length);
  }
  if (m.bunny_video_id) return `bunny_${m.bunny_video_id}`;
  return m.id;
}

export function toPostView(row: PubRow, baseUrl = ""): PostView {
  const status = DB_TO_SPEC_STATUS[row.status] ?? "draft";
  const handle = row.instagram_accounts?.account_details?.ig_username ?? row.instagram_accounts?.label ?? undefined;
  const assets = [...row.publication_media]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ id: assetIdFromMedia(m), object: "asset" as const }));
  return {
    id: row.id,
    object: "post",
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    created_via: mapSource(row.source),
    agent: null,
    status,
    platform: "instagram",
    account: {
      id: row.account_id,
      object: "social_account",
      ...(handle ? { handle } : {}),
    },
    assets,
    caption: row.caption ?? "",
    first_comment: null,
    tags: row.hashtags ?? [],
    campaign: row.campaign_id,
    scheduled_at: row.scheduled_at ?? null,
    published_at: row.published_at,
    failure:
      status === "failed"
        ? { code: "internal", message: row.failure_reason ?? "Publication failed" }
        : null,
    links: {
      self: `${baseUrl}/api/public/v1/posts/${row.id}`,
    },
  };
}

// -------- Read --------

export type ListPostsInput = {
  orgId: string;
  limit: number;
  cursor: ParsedCursor | null;
  filters?: {
    status?: SpecPostStatus | string;
    account_id?: string;
    asset_id?: string;
    platform?: string;
    tag?: string;
    q?: string;
    created_after?: string;
    created_before?: string;
    updated_after?: string;
    scheduled_after?: string;
    scheduled_before?: string;
    campaign?: string;
    via?: string;
  };
};

const SPEC_TO_DB_STATUS: Record<SpecPostStatus, string[]> = {
  draft: ["draft"],
  scheduled: ["scheduled", "ready_for_publishing"],
  publishing: ["publishing"],
  published: ["published"],
  failed: ["failed"],
  cancelled: ["cancelled"],
};

export async function listPostsCore(
  supabase: SupabaseClient,
  input: ListPostsInput,
): Promise<{ rows: PubRow[]; nextCursor: string | null; hasMore: boolean }> {
  let q = supabase
    .from("publications")
    .select(PUB_SELECT)
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit + 1);

  if (input.cursor) {
    q = q.or(
      `created_at.lt.${input.cursor.ts},and(created_at.eq.${input.cursor.ts},id.lt.${input.cursor.id})`,
    );
  }
  if (input.filters?.status) {
    const dbStatuses = SPEC_TO_DB_STATUS[input.filters.status as SpecPostStatus];
    if (!dbStatuses) {
      throw new SpecError("invalid_filter", "Unknown status filter", {
        status: "unknown value",
      });
    }
    q = q.in("status", dbStatuses);
  }
  if (input.filters?.platform && input.filters.platform !== "instagram") {
    // Only Instagram is live today; return empty for other platforms.
    return { rows: [], nextCursor: null, hasMore: false };
  }
  if (input.filters?.account_id) q = q.eq("account_id", input.filters.account_id);
  if (input.filters?.campaign) q = q.eq("campaign_id", input.filters.campaign);
  if (input.filters?.tag) q = q.contains("hashtags", [input.filters.tag]);
  if (input.filters?.q) q = q.ilike("caption", `%${input.filters.q}%`);
  if (input.filters?.created_after) q = q.gte("created_at", input.filters.created_after);
  if (input.filters?.created_before) q = q.lte("created_at", input.filters.created_before);
  if (input.filters?.updated_after) q = q.gte("updated_at", input.filters.updated_after);
  if (input.filters?.scheduled_after) q = q.gte("scheduled_at", input.filters.scheduled_after);
  if (input.filters?.scheduled_before) q = q.lte("scheduled_at", input.filters.scheduled_before);
  if (input.filters?.via) q = q.eq("source", input.filters.via);

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as unknown as PubRow[];

  // asset_id filter is post-hoc (would require join on publication_media)
  if (input.filters?.asset_id) {
    const needle = input.filters.asset_id;
    rows = rows.filter((r) => r.publication_media.some((m) => assetIdFromMedia(m) === needle));
  }

  const hasMore = rows.length > input.limit;
  const trimmed = hasMore ? rows.slice(0, input.limit) : rows;
  const last = trimmed[trimmed.length - 1];
  return {
    rows: trimmed,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  };
}

export async function getPostRowCore(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
): Promise<PubRow> {
  const { data, error } = await supabase
    .from("publications")
    .select(PUB_SELECT)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new SpecError("not_found", `Post ${id} not found`);
  return data as unknown as PubRow;
}

// -------- Write --------

export type CreatePostInput = {
  account_id: string;
  asset_ids: string[];
  caption: string;
  first_comment?: string;
  tags?: string[];
  campaign?: string;
  scheduled_at?: string;
};

export type WriteCtx = {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  via: SpecVia;
};

async function assertAccount(ctx: WriteCtx, account_id: string): Promise<void> {
  const { data, error } = await ctx.supabase
    .from("instagram_accounts")
    .select("id, org_id, status")
    .eq("id", account_id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.org_id !== ctx.orgId) {
    throw new SpecError("not_found", `Social account ${account_id} not found`);
  }
  if (data.status !== "ready") {
    throw new SpecError("conflict", "Social account is not ready to publish");
  }
}
// Validates every asset_id exists, belongs to the workspace, and is `ready`.
// Returns the ids preserving input order + de-duped to prevent double-inserts.
async function assertAssets(ctx: WriteCtx, assetIds: string[]): Promise<string[]> {
  const unique = Array.from(new Set(assetIds));
  if (unique.length === 0) return unique;
  const { data, error } = await ctx.supabase
    .from("assets")
    .select("id, workspace_id, status")
    .in("id", unique);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; workspace_id: string; status: string }>;
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of unique) {
    const row = byId.get(id);
    if (!row || row.workspace_id !== ctx.orgId) {
      throw new SpecError("not_found", `Asset ${id} not found`, { asset_ids: `unknown asset ${id}` });
    }
    if (row.status !== "ready") {
      throw new SpecError("conflict", `Asset ${id} is not ready`, {
        asset_ids: `asset ${id} status is ${row.status}, must be ready`,
      });
    }
  }
  // Preserve original order (may include duplicates -> reject to keep positions well-defined)
  if (assetIds.length !== unique.length) {
    throw new SpecError("invalid_input", "asset_ids must not contain duplicates", {
      asset_ids: "duplicate ids",
    });
  }
  return assetIds;
}


export async function createPostCore(
  ctx: WriteCtx,
  input: CreatePostInput,
): Promise<PubRow> {
  if (input.asset_ids.length === 0) {
    throw new SpecError("invalid_input", "asset_ids must contain at least one asset", {
      asset_ids: "min 1",
    });
  }
  await assertAccount(ctx, input.account_id);
  const assetIds = await assertAssets(ctx, input.asset_ids);
  const status = input.scheduled_at ? "scheduled" : "draft";
  const scheduledAt = input.scheduled_at ?? new Date(0).toISOString();
  const { data: pub, error } = await ctx.supabase
    .from("publications")
    .insert({
      org_id: ctx.orgId,
      account_id: input.account_id,
      campaign_id: input.campaign ?? null,
      caption: input.caption,
      hashtags: input.tags ?? [],
      notes: input.first_comment ?? "",
      scheduled_at: scheduledAt,
      status,
      source: ctx.via,
      created_by: ctx.userId,
      type: "reel",
    })
    .select("id")
    .single();
  if (error) throw error;
  const media = assetIds.map((aid, i) => ({
    publication_id: pub.id,
    position: i,
    kind: "image" as const,
    asset_id: aid,
  }));
  const { error: mErr } = await ctx.supabase.from("publication_media").insert(media);
  if (mErr) throw mErr;
  return getPostRowCore(ctx.supabase, ctx.orgId, pub.id);
}

export type UpdatePostInput = Partial<{
  caption: string;
  first_comment: string;
  tags: string[];
  campaign: string;
  asset_ids: string[];
}>;

const LOCKED = new Set(["publishing", "published"]);

export async function updatePostCore(
  ctx: WriteCtx,
  id: string,
  patch: UpdatePostInput,
): Promise<PubRow> {
  const current = await getPostRowCore(ctx.supabase, ctx.orgId, id);
  if (LOCKED.has(current.status)) {
    throw new SpecError("conflict", "Post is locked; publishing or already published");
  }
  const dbPatch: Record<string, unknown> = {};
  if (patch.caption !== undefined) dbPatch.caption = patch.caption;
  if (patch.first_comment !== undefined) dbPatch.notes = patch.first_comment;
  if (patch.tags !== undefined) dbPatch.hashtags = patch.tags;
  if (patch.campaign !== undefined) dbPatch.campaign_id = patch.campaign;
  if (Object.keys(dbPatch).length > 0) {
    const { error } = await ctx.supabase
      .from("publications")
      .update(dbPatch)
      .eq("id", id)
      .eq("org_id", ctx.orgId);
    if (error) throw error;
  }
  if (patch.asset_ids !== undefined) {
    if (patch.asset_ids.length === 0) {
      throw new SpecError("invalid_input", "asset_ids must contain at least one asset");
    }
    const assetIds = await assertAssets(ctx, patch.asset_ids);
    await ctx.supabase.from("publication_media").delete().eq("publication_id", id);
    const rows = assetIds.map((aid, i) => ({
      publication_id: id,
      position: i,
      kind: "image" as const,
      asset_id: aid,
    }));
    const { error: mErr } = await ctx.supabase.from("publication_media").insert(rows);
    if (mErr) throw mErr;
  }
  return getPostRowCore(ctx.supabase, ctx.orgId, id);
}

export async function deletePostCore(ctx: WriteCtx, id: string): Promise<void> {
  const current = await getPostRowCore(ctx.supabase, ctx.orgId, id);
  if (LOCKED.has(current.status)) {
    throw new SpecError("conflict", "Post is locked; cannot delete");
  }
  const { error } = await ctx.supabase
    .from("publications")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw error;
}

export async function cancelPostCore(
  ctx: WriteCtx,
  id: string,
  _reason?: string,
): Promise<PubRow> {
  const current = await getPostRowCore(ctx.supabase, ctx.orgId, id);
  if (current.status === "cancelled") return current;
  if (LOCKED.has(current.status)) {
    throw new SpecError("conflict", "Post cannot be cancelled; already publishing/published");
  }
  const { error } = await ctx.supabase
    .from("publications")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw error;
  return getPostRowCore(ctx.supabase, ctx.orgId, id);
}

export async function schedulePostCore(
  ctx: WriteCtx,
  id: string,
  scheduled_at: string,
): Promise<PubRow> {
  const current = await getPostRowCore(ctx.supabase, ctx.orgId, id);
  if (LOCKED.has(current.status) || current.status === "cancelled") {
    throw new SpecError("conflict", "Post cannot be scheduled in its current state");
  }
  const { error } = await ctx.supabase
    .from("publications")
    .update({ scheduled_at, status: "scheduled" })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw error;
  return getPostRowCore(ctx.supabase, ctx.orgId, id);
}

export async function publishPostCore(ctx: WriteCtx, id: string): Promise<PubRow> {
  const current = await getPostRowCore(ctx.supabase, ctx.orgId, id);
  if (current.status === "published") return current;
  if (current.status === "publishing") return current;
  if (current.status === "cancelled") {
    throw new SpecError("conflict", "Post is cancelled");
  }
  const { error } = await ctx.supabase
    .from("publications")
    .update({ status: "publishing" })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw error;
  return getPostRowCore(ctx.supabase, ctx.orgId, id);
}

export async function retryPostCore(ctx: WriteCtx, id: string): Promise<PubRow> {
  const current = await getPostRowCore(ctx.supabase, ctx.orgId, id);
  if (current.status !== "failed") {
    throw new SpecError("conflict", "Only failed posts can be retried");
  }
  const { error } = await ctx.supabase
    .from("publications")
    .update({ status: "scheduled", failure_reason: null })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw error;
  return getPostRowCore(ctx.supabase, ctx.orgId, id);
}

export async function duplicatePostCore(ctx: WriteCtx, id: string): Promise<PubRow> {
  const current = await getPostRowCore(ctx.supabase, ctx.orgId, id);
  const { data: pub, error } = await ctx.supabase
    .from("publications")
    .insert({
      org_id: ctx.orgId,
      account_id: current.account_id,
      campaign_id: current.campaign_id,
      caption: current.caption,
      hashtags: current.hashtags,
      notes: current.notes,
      scheduled_at: new Date(0).toISOString(),
      status: "draft",
      source: ctx.via,
      created_by: ctx.userId,
      type: "reel",
    })
    .select("id")
    .single();
  if (error) throw error;
  const media = current.publication_media
    .sort((a, b) => a.position - b.position)
    .map((m, i) => ({
      publication_id: pub.id,
      position: i,
      kind: m.kind,
      bunny_video_id: m.bunny_video_id,
      image_url: m.image_url,
      thumbnail_url: m.thumbnail_url,
    }));
  if (media.length > 0) {
    const { error: mErr } = await ctx.supabase.from("publication_media").insert(media);
    if (mErr) throw mErr;
  }
  return getPostRowCore(ctx.supabase, ctx.orgId, pub.id);
}

export type StatusView = {
  id: string;
  object: "post";
  status: SpecPostStatus;
  updated_at: string;
};

export async function getPostStatusCore(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
): Promise<StatusView> {
  const { data, error } = await supabase
    .from("publications")
    .select("id, status, updated_at")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new SpecError("not_found", `Post ${id} not found`);
  return {
    id: data.id,
    object: "post",
    status: DB_TO_SPEC_STATUS[data.status] ?? "draft",
    updated_at: data.updated_at,
  };
}
