// Read-only resource discovery for workspace-scoped API callers.
// Same auth context as the rest of /api/public/v1. Used by AI agents to
// discover valid account_id + media references before creating a Publication.
import type { SupabaseClient } from "@supabase/supabase-js";

export type DiscoveryCtx = {
  supabase: SupabaseClient;
  orgId: string;
};

type AccountRow = {
  id: string;
  status: string;
  label: string | null;
  created_at: string;
  account_details:
    | { ig_username: string | null; app_name: string | null; niche: string | null; profile_photo_url: string | null }
    | { ig_username: string | null; app_name: string | null; niche: string | null; profile_photo_url: string | null }[]
    | null;
};

function shapeAccount(row: AccountRow) {
  const d = Array.isArray(row.account_details) ? row.account_details[0] : row.account_details;
  return {
    id: row.id,
    username: d?.ig_username ?? null,
    display_name: d?.app_name ?? row.label ?? null,
    niche: d?.niche ?? null,
    status: row.status,
    profile_picture_url: d?.profile_photo_url ?? null,
    created_at: row.created_at,
  };
}

export async function listAccountsCore(ctx: DiscoveryCtx) {
  const { data, error } = await ctx.supabase
    .from("instagram_accounts")
    .select("id, status, label, created_at, account_details(ig_username, app_name, niche, profile_photo_url)")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => shapeAccount(r as unknown as AccountRow));
}

export async function getAccountCore(ctx: DiscoveryCtx, id: string) {
  const { data, error } = await ctx.supabase
    .from("instagram_accounts")
    .select("id, status, label, created_at, account_details(ig_username, app_name, niche, profile_photo_url)")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return shapeAccount(data as unknown as AccountRow);
}

// Workspace media library. There is no standalone "assets" table — every
// uploaded asset is attached to a publication or a legacy scheduled_post.
// We surface a unified, de-duplicated view keyed by bunny_video_id (or
// image_url for image-only assets).
type MediaItem = {
  id: string;
  filename: string | null;
  media_type: "video" | "image";
  thumbnail_url: string | null;
  bunny_video_id: string | null;
  bunny_library_id: string | null;
  image_url: string | null;
  duration: number | null;
  uploaded_at: string;
};

function mediaKey(m: {
  id: string;
  bunny_video_id?: string | null;
  image_url?: string | null;
}) {
  return m.bunny_video_id ?? m.image_url ?? m.id;
}

export async function listMediaCore(ctx: DiscoveryCtx): Promise<MediaItem[]> {
  const { data: pm, error: pmErr } = await ctx.supabase
    .from("publication_media")
    .select(
      "id, kind, bunny_video_id, bunny_library_id, thumbnail_url, image_url, created_at, publications!inner(org_id)",
    )
    .eq("publications.org_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (pmErr) throw new Error(pmErr.message);

  const { data: legacy, error: legErr } = await ctx.supabase
    .from("scheduled_posts")
    .select("id, bunny_video_id, bunny_library_id, thumbnail_url, created_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (legErr) throw new Error(legErr.message);

  const seen = new Map<string, MediaItem>();
  for (const row of pm ?? []) {
    const item: MediaItem = {
      id: row.id as string,
      filename: null,
      media_type: (row.kind as "video" | "image") ?? "video",
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      bunny_video_id: (row.bunny_video_id as string | null) ?? null,
      bunny_library_id: (row.bunny_library_id as string | null) ?? null,
      image_url: (row.image_url as string | null) ?? null,
      duration: null,
      uploaded_at: row.created_at as string,
    };
    const k = mediaKey(item);
    if (!seen.has(k)) seen.set(k, item);
  }
  for (const row of legacy ?? []) {
    const item: MediaItem = {
      id: row.id as string,
      filename: null,
      media_type: "video",
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      bunny_video_id: (row.bunny_video_id as string | null) ?? null,
      bunny_library_id: (row.bunny_library_id as string | null) ?? null,
      image_url: null,
      duration: null,
      uploaded_at: row.created_at as string,
    };
    const k = mediaKey(item);
    if (!seen.has(k)) seen.set(k, item);
  }
  return Array.from(seen.values());
}

export async function getMediaCore(ctx: DiscoveryCtx, id: string): Promise<MediaItem | null> {
  // Try publication_media (workspace-scoped via join)
  const { data: pm, error: pmErr } = await ctx.supabase
    .from("publication_media")
    .select(
      "id, kind, bunny_video_id, bunny_library_id, thumbnail_url, image_url, created_at, publications!inner(org_id)",
    )
    .eq("id", id)
    .eq("publications.org_id", ctx.orgId)
    .maybeSingle();
  if (pmErr) throw new Error(pmErr.message);
  if (pm) {
    return {
      id: pm.id as string,
      filename: null,
      media_type: (pm.kind as "video" | "image") ?? "video",
      thumbnail_url: (pm.thumbnail_url as string | null) ?? null,
      bunny_video_id: (pm.bunny_video_id as string | null) ?? null,
      bunny_library_id: (pm.bunny_library_id as string | null) ?? null,
      image_url: (pm.image_url as string | null) ?? null,
      duration: null,
      uploaded_at: pm.created_at as string,
    };
  }

  const { data: sp, error: spErr } = await ctx.supabase
    .from("scheduled_posts")
    .select("id, bunny_video_id, bunny_library_id, thumbnail_url, created_at")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (spErr) throw new Error(spErr.message);
  if (!sp) return null;
  return {
    id: sp.id as string,
    filename: null,
    media_type: "video",
    thumbnail_url: (sp.thumbnail_url as string | null) ?? null,
    bunny_video_id: (sp.bunny_video_id as string | null) ?? null,
    bunny_library_id: (sp.bunny_library_id as string | null) ?? null,
    image_url: null,
    duration: null,
    uploaded_at: sp.created_at as string,
  };
}
