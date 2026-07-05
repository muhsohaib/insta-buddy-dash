// Workspaces core — spec: docs/openapi.json → components.schemas.Workspace
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";

type WorkspaceRow = {
  id: string;
  name: string;
  timezone: string;
  default_locale: string;
  branding: unknown;
  created_at: string;
  updated_at: string;
};

export type WorkspaceView = {
  id: string;
  object: "workspace";
  name: string;
  timezone: string;
  default_locale: string;
  branding: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function toView(r: WorkspaceRow): WorkspaceView {
  return {
    id: r.id,
    object: "workspace",
    name: r.name,
    timezone: r.timezone,
    default_locale: r.default_locale,
    branding: (r.branding as Record<string, unknown>) ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function ensureRow(auth: ApiAuth): Promise<WorkspaceRow> {
  const { data, error } = await auth.supabase
    .from("workspaces")
    .select("*")
    .eq("id", auth.orgId)
    .maybeSingle();
  if (error) throw new SpecError("internal", error.message);
  if (data) return data as WorkspaceRow;
  const { data: created, error: insErr } = await auth.supabase
    .from("workspaces")
    .insert({  id: auth.orgId, name: auth.orgId })
    .select("*")
    .single();
  if (insErr) throw new SpecError("internal", insErr.message);
  return created as WorkspaceRow;
}

export async function getWorkspace(auth: ApiAuth): Promise<WorkspaceView> {
  return toView(await ensureRow(auth));
}

export async function updateWorkspace(
  auth: ApiAuth,
  input: Partial<Pick<WorkspaceRow, "name" | "timezone" | "default_locale" | "branding">>,
): Promise<WorkspaceView> {
  await ensureRow(auth);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.default_locale !== undefined) patch.default_locale = input.default_locale;
  if (input.branding !== undefined) patch.branding = input.branding;
  if (Object.keys(patch).length === 0) return toView(await ensureRow(auth));
  const { data, error } = await auth.supabase
    .from("workspaces")
    .update(patch as never)
    .eq("id", auth.orgId)
    .select("*")
    .single();
  if (error) throw new SpecError("internal", error.message);
  return toView(data as WorkspaceRow);
}
