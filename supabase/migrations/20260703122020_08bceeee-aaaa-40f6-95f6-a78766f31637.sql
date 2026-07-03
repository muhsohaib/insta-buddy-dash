
-- 1. Drop the trigger that auto-created profiles from auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Drop existing RLS policies (they reference auth.uid() which no longer applies)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','user_roles','instagram_accounts','account_details','scheduled_posts','subscriptions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 3. Drop storage policies on account-photos referencing auth.uid()
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  LOOP
    -- keep this loop cautious: only drop those that mention account-photos
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects' AND policyname = r.policyname
        AND (qual ILIKE '%account-photos%' OR with_check ILIKE '%account-photos%')
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END IF;
  END LOOP;
END $$;

-- 4. Wipe existing data (dev project; old UUIDs won't map to Clerk ids)
TRUNCATE TABLE public.scheduled_posts, public.account_details, public.instagram_accounts,
               public.subscriptions, public.user_roles, public.profiles RESTART IDENTITY CASCADE;

-- 5. Drop FKs to auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.instagram_accounts DROP CONSTRAINT IF EXISTS instagram_accounts_user_id_fkey;
ALTER TABLE public.account_details DROP CONSTRAINT IF EXISTS account_details_user_id_fkey;
ALTER TABLE public.scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_user_id_fkey;
ALTER TABLE public.scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_completed_by_fkey;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

-- 6. Convert user id columns from uuid to text (holds Clerk ids)
ALTER TABLE public.profiles           ALTER COLUMN id      TYPE text USING id::text;
ALTER TABLE public.user_roles         ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.instagram_accounts ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.account_details    ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.scheduled_posts    ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.scheduled_posts    ALTER COLUMN completed_by TYPE text USING completed_by::text;
ALTER TABLE public.subscriptions      ALTER COLUMN user_id TYPE text USING user_id::text;

-- 7. Recreate the profiles primary key default (was tied to auth.users id)
ALTER TABLE public.profiles ALTER COLUMN id DROP DEFAULT;

-- 8. Update has_role to accept text
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
CREATE OR REPLACE FUNCTION public.has_role(_user_id text, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 9. Restrictive default RLS — deny direct client access. Server code uses service_role (bypasses RLS).
--    RLS stays enabled as defense-in-depth in case a client accidentally hits the Data API.
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_details    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;

-- Revoke direct Data API access from anon/authenticated (server code goes through service_role)
REVOKE ALL ON public.profiles           FROM anon, authenticated;
REVOKE ALL ON public.user_roles         FROM anon, authenticated;
REVOKE ALL ON public.instagram_accounts FROM anon, authenticated;
REVOKE ALL ON public.account_details    FROM anon, authenticated;
REVOKE ALL ON public.scheduled_posts    FROM anon, authenticated;
REVOKE ALL ON public.subscriptions      FROM anon, authenticated;

GRANT ALL ON public.profiles           TO service_role;
GRANT ALL ON public.user_roles         TO service_role;
GRANT ALL ON public.instagram_accounts TO service_role;
GRANT ALL ON public.account_details    TO service_role;
GRANT ALL ON public.scheduled_posts    TO service_role;
GRANT ALL ON public.subscriptions      TO service_role;
