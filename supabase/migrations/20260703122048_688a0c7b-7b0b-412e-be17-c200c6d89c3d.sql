
-- Only the service role (server code) may execute the role helper
REVOKE EXECUTE ON FUNCTION public.has_role(text, public.app_role) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.has_role(text, public.app_role) TO service_role;

-- Default-deny RLS policies so if anyone reaches these tables via anon/authenticated,
-- they see nothing. Service role bypasses RLS entirely.
CREATE POLICY "deny_all_anon_auth" ON public.profiles           FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon_auth" ON public.user_roles         FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon_auth" ON public.instagram_accounts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon_auth" ON public.account_details    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon_auth" ON public.scheduled_posts    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_anon_auth" ON public.subscriptions      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
