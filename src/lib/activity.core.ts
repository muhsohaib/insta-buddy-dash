// Activity stream — immutable audit events.
// Writes: service_role only (never client).
// Reads: workspace-scoped, filtered server-side.
//
// Spec: docs/openapi.json → schemas.Activity, EventType, ActorType, Via.
// The DB column is `actor_type` and accepts human|ai|automation|system
// (superset of spec's human|ai|system). We fold `automation` → `system`
// on the way out so responses stay spec-compliant.
import type { SupabaseClient } from "@supabase/supabase-js";

// Spec EventType — closed set; extend the OpenAPI first, then this union.
export type SpecEventType =
  | "post.scheduled"
  | "post.publishing"
  | "post.published"
  | "post.failed"
  | "post.cancelled"
  | "asset.ready"
  | "asset.failed"
  | "account.connected"
  | "account.needs_attention"
  | "order.paid"
  | "order.fulfilled"
  | "order.refunded"
  | "delivery.ready"
  | "delivery.accepted"
  | "delivery.issue_reported"
  | "member.invited"
  | "member.role_changed"
  | "api_key.created"
  | "api_key.revoked";

export type SpecActorType = "human" | "ai" | "system";
export type SpecVia = "web" | "api" | "mcp" | "system";

export type ActivityRow = {
  id: string;
  org_id: string;
  actor_type: "human" | "ai" | "automation" | "system";
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
};

export type ActivityView = {
  id: string;
  object: "activity";
  event: string;
  actor: { type: SpecActorType; id: string; name?: string; agent?: string | null };
  via?: SpecVia;
  target?: { type: string; id: string };
  occurred_at: string;
  message?: string;
  data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const DB_TO_SPEC_ACTOR: Record<ActivityRow["actor_type"], SpecActorType> = {
  human: "human",
  ai: "ai",
  automation: "system",
  system: "system",
};

export function toActivityView(row: ActivityRow): ActivityView {
  const via = (row.payload?.via as SpecVia | undefined) ?? undefined;
  const agent = (row.payload?.agent as string | null | undefined) ?? null;
  return {
    id: row.id,
    object: "activity",
    event: row.action,
    actor: {
      type: DB_TO_SPEC_ACTOR[row.actor_type],
      id: row.actor_id ?? "system",
      agent,
    },
    ...(via ? { via } : {}),
    ...(row.resource_id && row.resource_type
      ? { target: { type: row.resource_type, id: row.resource_id } }
      : {}),
    occurred_at: row.occurred_at,
    ...(row.summary ? { message: row.summary } : {}),
    ...(row.payload && Object.keys(row.payload).length ? { data: row.payload } : {}),
    // ResourceBase demands created_at/updated_at; activities are immutable so
    // both are the occurrence time.
    created_at: row.occurred_at,
    updated_at: row.occurred_at,
  };
}

// -------- Write path (service_role) --------

export type RecordActivityInput = {
  orgId: string;
  actorType: SpecActorType | "automation";
  actorId?: string | null;
  event: SpecEventType | string; // extensible for internal events, but keep spec-first
  resourceType: string;
  resourceId?: string | null;
  message?: string;
  via?: SpecVia;
  agent?: string | null;
  data?: Record<string, unknown>;
};

export async function recordActivity(
  adminSupabase: SupabaseClient,
  input: RecordActivityInput,
): Promise<void> {
  const payload: Record<string, unknown> = { ...(input.data ?? {}) };
  if (input.via) payload.via = input.via;
  if (input.agent) payload.agent = input.agent;

  const { error } = await adminSupabase.from("activities").insert({
    org_id: input.orgId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.event,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    summary: input.message ?? null,
    payload,
  });
  if (error) {
    // Never fail the parent action just because audit write failed.
    console.error("[activity] insert failed", error, input);
  }
}

// -------- Read path --------

export type ListActivitiesInput = {
  orgId: string;
  limit: number;
  cursor: { ts: string; id: string } | null;
  filters?: {
    event?: string;
    actor_type?: SpecActorType;
    resource_type?: string;
    resource_id?: string;
  };
};

export async function listActivitiesCore(
  supabase: SupabaseClient,
  input: ListActivitiesInput,
): Promise<ActivityRow[]> {
  let q = supabase
    .from("activities")
    .select("*")
    .eq("org_id", input.orgId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit + 1);

  if (input.cursor) {
    // (occurred_at, id) strictly less than cursor
    q = q.or(
      `occurred_at.lt.${input.cursor.ts},and(occurred_at.eq.${input.cursor.ts},id.lt.${input.cursor.id})`,
    );
  }
  if (input.filters?.event) q = q.eq("action", input.filters.event);
  if (input.filters?.resource_type) q = q.eq("resource_type", input.filters.resource_type);
  if (input.filters?.resource_id) q = q.eq("resource_id", input.filters.resource_id);
  if (input.filters?.actor_type) {
    // spec's "system" collapses our automation+system in the DB
    const dbActor =
      input.filters.actor_type === "system" ? ["system", "automation"] : [input.filters.actor_type];
    q = q.in("actor_type", dbActor);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export async function getActivityCore(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
): Promise<ActivityRow | null> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ActivityRow | null) ?? null;
}
