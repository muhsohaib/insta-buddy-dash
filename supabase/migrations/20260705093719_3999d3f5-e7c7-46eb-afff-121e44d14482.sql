
-- Phase 7b.4-7b.6 schema additions

-- 1. workspaces (per Clerk org)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'UTC',
  default_locale text NOT NULL DEFAULT 'en-US',
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspaces read" ON public.workspaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "workspaces write" ON public.workspaces FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. assets
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','video','document','archive','other')),
  mime text NOT NULL,
  bytes bigint NOT NULL DEFAULT 0,
  sha256 text,
  filename text NOT NULL DEFAULT '',
  storage_path text NOT NULL DEFAULT '',
  upload_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed','deleted')),
  tags text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assets_workspace_created_idx ON public.assets(workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets workspace read" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets workspace write" ON public.assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. webhooks
CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  url text NOT NULL,
  description text NOT NULL DEFAULT '',
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhooks_workspace_idx ON public.webhooks(workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks read" ON public.webhooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "webhooks write" ON public.webhooks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. webhook_deliveries
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','retrying')),
  attempts int NOT NULL DEFAULT 0,
  http_status int,
  response_body text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whd_webhook_idx ON public.webhook_deliveries(webhook_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whd read" ON public.webhook_deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "whd write" ON public.webhook_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER whd_updated_at BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. order_item_deliverables: acceptance / issue stamps
ALTER TABLE public.order_item_deliverables
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_reason text;
