// Assets core — spec: docs/openapi.json → schemas.Asset
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";
import { enqueueWebhookEvent } from "./webhooks-dispatch.server";

type Row = {
  id: string;
  workspace_id: string;
  kind: string;
  mime: string;
  bytes: number;
  sha256: string | null;
  filename: string;
  storage_path: string;
  upload_url: string | null;
  status: string;
  tags: string[];
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

export type AssetView = {
  id: string;
  object: "asset";
  kind: string;
  mime: string;
  bytes: number;
  sha256: string | null;
  filename: string;
  status: string;
  tags: string[];
  metadata: Record<string, unknown>;
  upload_url: string | null;
  created_at: string;
  updated_at: string;
};

function toView(r: Row): AssetView {
  return {
    id: r.id,
    object: "asset",
    kind: r.kind,
    mime: r.mime,
    bytes: Number(r.bytes ?? 0),
    sha256: r.sha256,
    filename: r.filename,
    status: r.status,
    tags: r.tags ?? [],
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    upload_url: r.status === "pending" ? r.upload_url : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

const KINDS = new Set(["image", "video", "document", "archive", "other"]);

export async function listAssets(
  auth: ApiAuth,
  opts: { limit: number; cursor: ParsedCursor | null; kind?: string | null; status?: string | null },
) {
  let q = auth.supabase
    .from("assets")
    .select("*")
    .eq("workspace_id", auth.orgId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.cursor) {
    q = q.or(
      `created_at.lt.${opts.cursor.ts},and(created_at.eq.${opts.cursor.ts},id.lt.${opts.cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw new SpecError("internal", error.message);
  const rows = (data ?? []) as unknown as Row[];
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

export async function getAsset(auth: ApiAuth, id: string): Promise<AssetView> {
  const { data, error } = await auth.supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", auth.orgId)
    .maybeSingle();
  if (error) throw new SpecError("internal", error.message);
  if (!data || data.status === "deleted") throw new SpecError("not_found", `Asset ${id} not found`);
  return toView(data as unknown as Row);
}

export async function createAsset(
  auth: ApiAuth,
  input: { kind: string; mime: string; filename: string; bytes?: number; tags?: string[]; metadata?: Record<string, unknown> },
): Promise<AssetView> {
  if (!KINDS.has(input.kind))
    throw new SpecError("invalid_input", "Unknown kind", { kind: "must be image|video|document|archive|other" });
  if (!input.mime) throw new SpecError("invalid_input", "mime required", { mime: "required" });
  if (!input.filename) throw new SpecError("invalid_input", "filename required", { filename: "required" });
  const id = crypto.randomUUID();
  const storagePath = `${auth.orgId}/${id}/${input.filename}`;
  // Presigned upload URL — best effort. Bucket is `account-photos`; if not
  // present, upload_url is null and the client can retry via /complete only.
  let uploadUrl: string | null = null;
  try {
    const { data: signed } = await auth.supabase.storage
      .from("account-photos")
      .createSignedUploadUrl(storagePath);
    if (signed?.signedUrl) uploadUrl = signed.signedUrl;
  } catch {
    uploadUrl = null;
  }
  const insertPayload = {
    id,
    workspace_id: auth.orgId,
    kind: input.kind,
    mime: input.mime,
    bytes: input.bytes ?? 0,
    filename: input.filename,
    storage_path: storagePath,
    upload_url: uploadUrl,
    status: "pending",
    tags: input.tags ?? [],
    metadata: (input.metadata ?? {}) as unknown,
  };
  const { data, error } = await auth.supabase
    .from("assets")
    .insert(insertPayload as never)
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toView(data as unknown as Row);
}

export async function completeAsset(
  auth: ApiAuth,
  id: string,
  input: { sha256?: string; bytes?: number },
): Promise<AssetView> {
  await getAsset(auth, id);
  const patch: Record<string, unknown> = { status: "ready", upload_url: null };
  if (input.sha256) patch.sha256 = input.sha256;
  if (input.bytes !== undefined) patch.bytes = input.bytes;
  const { data, error } = await auth.supabase
    .from("assets")
    .update(patch as never)
    .eq("id", id)
    .eq("workspace_id", auth.orgId)
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  const view = toView(data as unknown as Row);
  await enqueueWebhookEvent(auth.supabase, auth.orgId, "asset.ready", { asset: view });
  return view;
}

export async function updateAsset(
  auth: ApiAuth,
  id: string,
  input: { filename?: string; tags?: string[]; metadata?: Record<string, unknown> },
): Promise<AssetView> {
  await getAsset(auth, id);
  const patch: Record<string, unknown> = {};
  if (input.filename !== undefined) patch.filename = input.filename;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  if (Object.keys(patch).length === 0) return getAsset(auth, id);
  const { data, error } = await auth.supabase
    .from("assets")
    .update(patch as never)
    .eq("id", id)
    .eq("workspace_id", auth.orgId)
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toView(data as unknown as Row);
}

export async function deleteAsset(auth: ApiAuth, id: string): Promise<void> {
  await getAsset(auth, id);
  const { error } = await auth.supabase
    .from("assets")
    .update({ status: "deleted" })
    .eq("id", id)
    .eq("workspace_id", auth.orgId);
  if (error) throw new SpecError("internal", error.message);
}
