// Notifications — per-user, per-workspace inbox.
// Writes are backend-only (service_role, driven by activities in later phases).
// Reads and read-state mutations happen here.
//
// Spec: docs/openapi.json → schemas.Notification, EventType.
import type { SupabaseClient } from "@supabase/supabase-js";
import { SpecError } from "./api/envelope";

export type NotificationRow = {
  id: string;
  org_id: string;
  recipient_user_id: string;
  kind: string;
  title: string;
  body: string | null;
  resource_type: string | null;
  resource_id: string | null;
  action_url: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type NotificationView = {
  id: string;
  object: "notification";
  event: string;
  message: string;
  read: boolean;
  target?: { type: string; id: string };
  created_at: string;
  updated_at: string;
};

export function toNotificationView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    object: "notification",
    event: row.kind,
    message: row.title,
    read: row.read_at !== null,
    ...(row.resource_type && row.resource_id
      ? { target: { type: row.resource_type, id: row.resource_id } }
      : {}),
    created_at: row.created_at,
    updated_at: row.read_at ?? row.created_at,
  };
}

export type ListNotificationsInput = {
  orgId: string;
  userId: string;
  limit: number;
  cursor: { ts: string; id: string } | null;
  unread?: boolean;
};

export async function listNotificationsCore(
  supabase: SupabaseClient,
  input: ListNotificationsInput,
): Promise<NotificationRow[]> {
  let q = supabase
    .from("notifications")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("recipient_user_id", input.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit + 1);

  if (input.unread) q = q.is("read_at", null);
  if (input.cursor) {
    q = q.or(
      `created_at.lt.${input.cursor.ts},and(created_at.eq.${input.cursor.ts},id.lt.${input.cursor.id})`,
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationReadCore(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  id: string,
): Promise<NotificationRow> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("recipient_user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new SpecError("not_found", "Notification not found");
  return data as NotificationRow;
}

export async function markAllNotificationsReadCore(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("org_id", orgId)
    .eq("recipient_user_id", userId)
    .is("read_at", null)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

// Backend-only helper for other cores to enqueue notifications.
export type CreateNotificationInput = {
  orgId: string;
  recipientUserId: string;
  kind: string;
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
  payload?: Record<string, unknown>;
};

export async function createNotification(
  adminSupabase: SupabaseClient,
  input: CreateNotificationInput,
): Promise<void> {
  const { error } = await adminSupabase.from("notifications").insert({
    org_id: input.orgId,
    recipient_user_id: input.recipientUserId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    action_url: input.actionUrl ?? null,
    payload: input.payload ?? {},
  });
  if (error) console.error("[notifications] insert failed", error, input);
}
