-- Add Clerk organization scoping. Existing rows are wiped because they are
-- tied to individual Clerk users and cannot be safely reassigned to an org.

TRUNCATE TABLE public.scheduled_posts, public.account_details, public.instagram_accounts, public.subscriptions, public.user_roles RESTART IDENTITY;

ALTER TABLE public.instagram_accounts ADD COLUMN org_id text NOT NULL;
ALTER TABLE public.account_details    ADD COLUMN org_id text NOT NULL;
ALTER TABLE public.scheduled_posts    ADD COLUMN org_id text NOT NULL;
ALTER TABLE public.subscriptions      ADD COLUMN org_id text NOT NULL;

CREATE INDEX IF NOT EXISTS instagram_accounts_org_id_idx ON public.instagram_accounts(org_id);
CREATE INDEX IF NOT EXISTS account_details_org_id_idx    ON public.account_details(org_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_org_id_idx    ON public.scheduled_posts(org_id);
CREATE INDEX IF NOT EXISTS subscriptions_org_id_idx      ON public.subscriptions(org_id);
