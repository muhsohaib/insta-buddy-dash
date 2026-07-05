
-- Phase 7a: additive schema for Activity + Notifications
-- No existing tables are altered. Legacy renames land in later sub-phases.

-- ============ actor_type enum (human | ai | automation | system) ============
DO $$ BEGIN
  CREATE TYPE public.actor_type AS ENUM ('human', 'ai', 'automation', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ activities: immutable audit stream ============
CREATE TABLE public.activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,                  -- workspace identifier (Clerk org); renamed to workspace_id in 7b
  actor_type    public.actor_type NOT NULL,
  actor_id      TEXT,                            -- user id, api key id, or NULL for system
  action        TEXT NOT NULL,                   -- e.g. 'publication.created', 'order.delivered'
  resource_type TEXT NOT NULL,                   -- e.g. 'publication', 'order', 'account'
  resource_id   TEXT,                            -- opaque id of the resource
  summary       TEXT,                            -- human-readable one-liner
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activities_org_occurred_idx  ON public.activities (org_id, occurred_at DESC);
CREATE INDEX activities_resource_idx      ON public.activities (org_id, resource_type, resource_id);
CREATE INDEX activities_actor_idx         ON public.activities (org_id, actor_type, actor_id);

GRANT SELECT ON public.activities TO authenticated;
GRANT ALL    ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Activities are immutable: no insert/update/delete from client roles.
-- Reads are workspace-scoped and go through server functions using service_role;
-- an explicit deny-by-default posture here keeps the client from ever writing.
CREATE POLICY "activities_no_client_writes"
  ON public.activities FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "activities_read_own_workspace"
  ON public.activities FOR SELECT TO authenticated
  USING (true);  -- server functions filter by org_id; RLS is defense-in-depth
                 -- and will be tightened in 7c when workspace membership lives in DB.

-- ============ notifications: per-user, per-workspace inbox ============
CREATE TABLE public.notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,                -- Clerk user id
  kind             TEXT NOT NULL,                  -- 'delivery.ready', 'publication.failed', etc.
  title            TEXT NOT NULL,
  body             TEXT,
  resource_type    TEXT,
  resource_id      TEXT,
  action_url       TEXT,                           -- deep-link into the web app
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC);
CREATE INDEX notifications_recipient_unread_idx
  ON public.notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_org_idx
  ON public.notifications (org_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL           ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Server code creates notifications via service_role. Clients only read their own
-- and mark them as read (UPDATE limited to read_at via server function).
CREATE POLICY "notifications_read_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (true);  -- server functions filter by recipient_user_id; tightened in 7c.

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
