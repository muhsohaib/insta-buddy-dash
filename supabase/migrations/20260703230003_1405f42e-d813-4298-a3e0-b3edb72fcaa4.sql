
-- Enums
CREATE TYPE public.publication_type AS ENUM ('reel','image','carousel','video');
CREATE TYPE public.publication_status AS ENUM ('draft','scheduled','ready_for_publishing','publishing','published','failed');
CREATE TYPE public.publication_actor_type AS ENUM ('user','api_key','system');

-- Campaigns (future grouping; created now so FK exists)
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_service_role_all" ON public.campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX campaigns_org_idx ON public.campaigns(org_id);
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Publications
CREATE TABLE public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  account_id uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  type public.publication_type NOT NULL DEFAULT 'reel',
  status public.publication_status NOT NULL DEFAULT 'draft',
  caption text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz NOT NULL,
  assigned_to text,
  notes text NOT NULL DEFAULT '',
  published_at timestamptz,
  instagram_post_url text,
  failure_reason text,
  source text NOT NULL DEFAULT 'web',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publications_service_role_all" ON public.publications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX publications_org_scheduled_idx ON public.publications(org_id, scheduled_at);
CREATE INDEX publications_status_scheduled_idx ON public.publications(status, scheduled_at);
CREATE INDEX publications_account_idx ON public.publications(account_id);
CREATE TRIGGER publications_updated_at BEFORE UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Publication media
CREATE TABLE public.publication_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('video','image')),
  bunny_video_id text,
  bunny_library_id text,
  thumbnail_url text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_media TO authenticated;
GRANT ALL ON public.publication_media TO service_role;
ALTER TABLE public.publication_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publication_media_service_role_all" ON public.publication_media FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX publication_media_pub_idx ON public.publication_media(publication_id);

-- Publication events (audit log)
CREATE TABLE public.publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type public.publication_actor_type NOT NULL DEFAULT 'system',
  actor_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.publication_events TO authenticated;
GRANT ALL ON public.publication_events TO service_role;
ALTER TABLE public.publication_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publication_events_service_role_all" ON public.publication_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX publication_events_pub_idx ON public.publication_events(publication_id, created_at DESC);

-- Trigger: stamp lifecycle timestamps + write audit event on status change
CREATE OR REPLACE FUNCTION public.stamp_publication_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
    INSERT INTO public.publication_events(publication_id, event_type, actor_type, payload)
      VALUES (NEW.id, 'status_changed', 'system',
              jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER publications_stamp_status
  BEFORE UPDATE ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.stamp_publication_status();

-- Cron: promote scheduled -> ready_for_publishing when time arrives
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'promote-publications-ready',
  '* * * * *',
  $$
  UPDATE public.publications
    SET status = 'ready_for_publishing'
    WHERE status = 'scheduled' AND scheduled_at <= now();
  $$
);
