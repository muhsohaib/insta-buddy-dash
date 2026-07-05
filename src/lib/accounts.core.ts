// Accounts core — bridges `instagram_accounts` + `account_details` to the
// spec SocialAccount resource (docs/openapi.json → schemas.SocialAccount).
//
// DB → spec status collapse:
//   pending_details → connecting
//   creating        → connecting
//   warming_up      → connecting
//   ready           → active
//   cancelled       → retired
//
// Credentials handling: the DB doesn't store platform credentials directly;
// `credentials_ref` is accepted, logged into `activities`, and swapped in the
// dedicated credentials store landing in phase 7d (Assets/Bunny + rotate).
import type { SupabaseClient } from "@supabase/supabase-js";
import { SpecError } from "./api/envelope";
import { encodeCursor, type ParsedCursor } from "./api/pagination";

export type SpecAccountStatus = "connecting" | "active" | "needs_attention" | "retired";
export type SpecVia = "web" | "api" | "mcp" | "system";

const DB_TO_SPEC_STATUS: Record<string, SpecAccountStatus> = {
  pending_details: "connecting",
  creating: "connecting",
  warming_up: "connecting",
  ready: "active",
  cancelled: "retired",
};

const SPEC_TO_DB_STATUS: Record<SpecAccountStatus, string[]> = {
  connecting: ["pending_details", "creating", "warming_up"],
  active: ["ready"],
  needs_attention: [], // no DB representation yet — always empty match
  retired: ["cancelled"],
};

const ACCOUNT_SELECT =
  "id, org_id, user_id, label, status, order_item_id, created_at, updated_at, account_details(ig_username, app_name, profile_photo_url)";

type AccountRow = {
  id: string;
  org_id: string;
  user_id: string;
  label: string | null;
  status: string;
  order_item_id: string | null;
  created_at: string;
  updated_at: string;
  account_details:
    | { ig_username: string | null; app_name: string | null; profile_photo_url: string | null }
    | Array<{ ig_username: string | null; app_name: string | null; profile_photo_url: string | null }>
    | null;
};

export type SocialAccountView = {
  id: string;
  object: "social_account";
  created_at: string;
  updated_at: string;
  created_by: string;
  created_via: SpecVia;
  agent: string | null;
  platform: "instagram";
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  status: SpecAccountStatus;
  source: "self_connected" | "bought";
  delivered_by: { id: string; object: "delivery" } | null;
  tags: string[];
  links: { self: string };
};

function detailsOf(
  row: AccountRow,
): { ig_username: string | null; app_name: string | null; profile_photo_url: string | null } | null {
  if (!row.account_details) return null;
  return Array.isArray(row.account_details) ? row.account_details[0] ?? null : row.account_details;
}

export function toSocialAccountView(row: AccountRow, baseUrl = ""): SocialAccountView {
  const d = detailsOf(row);
  const handle = d?.ig_username ?? row.label ?? row.id;
  return {
    id: row.id,
    object: "social_account",
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.user_id,
    created_via: "web",
    agent: null,
    platform: "instagram",
    handle,
    display_name: d?.app_name ?? row.label ?? null,
    avatar_url: d?.profile_photo_url ?? null,
    status: DB_TO_SPEC_STATUS[row.status] ?? "connecting",
    source: row.order_item_id ? "bought" : "self_connected",
    delivered_by: row.order_item_id ? { id: row.order_item_id, object: "delivery" } : null,
    tags: [],
    links: { self: `${baseUrl}/api/public/v1/accounts/${row.id}` },
  };
}

// -------- Read --------

export type ListAccountsInput = {
  orgId: string;
  limit: number;
  cursor: ParsedCursor | null;
  filters?: {
    status?: SpecAccountStatus | string;
    platform?: string;
    q?: string;
    tag?: string;
    created_after?: string;
    created_before?: string;
    updated_after?: string;
  };
};

export async function listAccountsCore(
  supabase: SupabaseClient,
  input: ListAccountsInput,
): Promise<{ rows: AccountRow[]; nextCursor: string | null; hasMore: boolean }> {
  if (input.filters?.platform && input.filters.platform !== "instagram") {
    return { rows: [], nextCursor: null, hasMore: false };
  }
  let q = supabase
    .from("instagram_accounts")
    .select(ACCOUNT_SELECT)
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
    const dbStatuses = SPEC_TO_DB_STATUS[input.filters.status as SpecAccountStatus];
    if (!dbStatuses) {
      throw new SpecError("invalid_filter", "Unknown status filter", {
        status: "unknown value",
      });
    }
    if (dbStatuses.length === 0) return { rows: [], nextCursor: null, hasMore: false };
    q = q.in("status", dbStatuses);
  }
  if (input.filters?.created_after) q = q.gte("created_at", input.filters.created_after);
  if (input.filters?.created_before) q = q.lte("created_at", input.filters.created_before);
  if (input.filters?.updated_after) q = q.gte("updated_at", input.filters.updated_after);
  if (input.filters?.q) q = q.ilike("label", `%${input.filters.q}%`);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as AccountRow[];
  const hasMore = rows.length > input.limit;
  const trimmed = hasMore ? rows.slice(0, input.limit) : rows;
  const last = trimmed[trimmed.length - 1];
  return {
    rows: trimmed,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  };
}

export async function getAccountRowCore(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
): Promise<AccountRow> {
  const { data, error } = await supabase
    .from("instagram_accounts")
    .select(ACCOUNT_SELECT)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new SpecError("not_found", `Account ${id} not found`);
  return data as unknown as AccountRow;
}

// -------- Write --------

export type WriteCtx = {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  via: SpecVia;
};

export type ConnectAccountInput = {
  platform: string;
  handle: string;
  credentials_ref: string;
  tags?: string[];
};

export async function createAccountCore(
  ctx: WriteCtx,
  input: ConnectAccountInput,
): Promise<AccountRow> {
  if (input.platform !== "instagram") {
    throw new SpecError("invalid_input", `Platform ${input.platform} not supported yet`, {
      platform: "only 'instagram' is supported today",
    });
  }
  const { data: acc, error } = await ctx.supabase
    .from("instagram_accounts")
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      label: input.handle,
      status: "ready",
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: dErr } = await ctx.supabase.from("account_details").insert({
    account_id: acc.id,
    org_id: ctx.orgId,
    user_id: ctx.userId,
    app_name: input.handle,
    ig_username: input.handle.replace(/^@/, ""),
    bio: "",
    niche: "",
    target_country: "",
  });
  if (dErr) throw dErr;

  return getAccountRowCore(ctx.supabase, ctx.orgId, acc.id);
}

export type UpdateAccountInput = Partial<{
  handle: string;
  display_name: string;
  tags: string[];
}>;

export async function updateAccountCore(
  ctx: WriteCtx,
  id: string,
  patch: UpdateAccountInput,
): Promise<AccountRow> {
  const current = await getAccountRowCore(ctx.supabase, ctx.orgId, id);
  if (patch.handle !== undefined || patch.display_name !== undefined) {
    const accPatch: Record<string, unknown> = {};
    if (patch.handle !== undefined) accPatch.label = patch.handle;
    const { error } = await ctx.supabase
      .from("instagram_accounts")
      .update(accPatch)
      .eq("id", id)
      .eq("org_id", ctx.orgId);
    if (error) throw error;

    const detailsPatch: Record<string, unknown> = {};
    if (patch.handle !== undefined) detailsPatch.ig_username = patch.handle.replace(/^@/, "");
    if (patch.display_name !== undefined) detailsPatch.app_name = patch.display_name;
    if (Object.keys(detailsPatch).length > 0) {
      const d = detailsOf(current);
      if (d) {
        await ctx.supabase
          .from("account_details")
          .update(detailsPatch)
          .eq("account_id", id)
          .eq("org_id", ctx.orgId);
      }
    }
  }
  return getAccountRowCore(ctx.supabase, ctx.orgId, id);
}

export async function deleteAccountCore(
  ctx: WriteCtx,
  id: string,
): Promise<void> {
  await getAccountRowCore(ctx.supabase, ctx.orgId, id); // 404 if missing
  const { error } = await ctx.supabase
    .from("instagram_accounts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw error;
}

export async function rotateAccountCredentialsCore(
  ctx: WriteCtx,
  id: string,
  _credentialsRef: string,
): Promise<AccountRow> {
  await getAccountRowCore(ctx.supabase, ctx.orgId, id);
  // Credentials are stored out-of-band; API only flips status back to ready
  // and returns the fresh row. Persistence of `credentials_ref` lands in 7d.
  const { error } = await ctx.supabase
    .from("instagram_accounts")
    .update({ status: "ready" })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) throw error;
  return getAccountRowCore(ctx.supabase, ctx.orgId, id);
}
