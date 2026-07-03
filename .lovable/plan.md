# Migrate authentication from Lovable Cloud (Supabase) to Clerk

## Heads-up before we start

This is a large, destructive refactor, not a quickstart install. The app currently uses Supabase auth end-to-end:

- Every table (`profiles`, `user_roles`, `instagram_accounts`, `account_details`, `scheduled_posts`, `subscriptions`) has a `user_id uuid` column and RLS policies keyed on `auth.uid()`.
- `requireSupabaseAuth` middleware gates every server function.
- `handle_new_user` trigger auto-creates `profiles` when a row lands in `auth.users`.
- Whop webhook provisions users via `supabaseAdmin.auth.admin`.
- Google OAuth goes through the Lovable broker.
- `has_role(auth.uid(), 'admin')` powers the admin panel.

Clerk issues its own user IDs (`user_xxx`, text — not UUIDs) and does not populate `auth.users`. To keep RLS working with Clerk we use **Supabase's Clerk third-party auth integration** — Supabase accepts Clerk-issued JWTs and `auth.jwt()->>'sub'` returns the Clerk user ID. This is the recommended path; the alternative (dropping RLS and gating everything in server functions) is riskier.

## Existing users

Existing rows in `auth.users` will NOT map to Clerk automatically. Options:
1. Wipe the dev database (fastest, loses all existing accounts/posts).
2. Keep data but require every user to re-sign-up in Clerk, then run a one-time mapping to rewrite `user_id` columns from old Supabase UUIDs to new Clerk IDs (manual, per-user).

**I'll assume option 1 (wipe) unless you say otherwise** — this is a dev/preview project and simpler.

## Plan

### 1. Install & provider setup
- `bun add @clerk/tanstack-react-start @clerk/ui`
- Add `ClerkProvider` (with `shadcn` theme) inside `src/routes/__root.tsx` `<body>`, wrapping the existing providers.
- Add `@import '@clerk/ui/themes/shadcn.css'` to `src/styles.css`.

### 2. API keys
Request via `add_secret`:
- `CLERK_PUBLISHABLE_KEY` (also exposed as `VITE_CLERK_PUBLISHABLE_KEY`)
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN` (for Supabase third-party auth)

You get these from https://dashboard.clerk.com after creating an app.

### 3. Supabase ↔ Clerk third-party auth
- Configure Clerk as a third-party auth provider in Supabase (via SQL: register the Clerk issuer domain so PostgREST validates Clerk JWTs and `auth.jwt()->>'sub'` returns the Clerk user id).
- Update the browser Supabase client so it forwards the Clerk session token as the `Authorization` header on every Data API call. `@/integrations/supabase/client.ts` is auto-generated and shouldn't be edited, so we'll create a thin wrapper `src/integrations/supabase/clerk-client.ts` that components use instead of the raw client.

### 4. Schema migration
One migration that:
- Drops `handle_new_user` trigger and function (no more `auth.users` inserts).
- Drops all existing RLS policies referencing `auth.uid()`.
- Changes `user_id` / `id` columns from `uuid` to `text` on: `profiles`, `user_roles`, `instagram_accounts`, `account_details`, `scheduled_posts`, `subscriptions`. Drops FK to `auth.users`.
- Recreates RLS policies keyed on `(auth.jwt()->>'sub') = user_id`.
- Updates `has_role` to take `_user_id text`.
- Re-issues `GRANT`s.
- **Wipes existing rows** in these tables (required — old UUIDs won't match new Clerk IDs).

### 5. Server-side auth
- Replace `src/integrations/supabase/auth-middleware.ts` usage with a new `src/integrations/clerk/auth-middleware.ts` that verifies the Clerk session (`@clerk/backend`) and puts `userId: string` and a Supabase client (with the Clerk JWT attached) on context.
- Update every `createServerFn().middleware([requireSupabaseAuth])` call site in `src/lib/*.functions.ts` (`accounts`, `posts`, `admin`, `whop`, `bunny`) to use the new middleware and treat `userId` as `string`.
- Replace `src/start.ts` `attachSupabaseAuth` bearer middleware with one that attaches the Clerk session token.
- Update `src/routes/api/public/webhooks/whop.ts` and `src/routes/api/public/admin/bunny-download.ts`: create users via Clerk Backend API (`clerkClient.users.createUser`) instead of `supabaseAdmin.auth.admin.createUser`.

### 6. Routes & UI
- Replace `src/routes/auth.tsx` with Clerk's `<SignIn />` component (shadcn-themed).
- Add `src/routes/sign-up.tsx` with `<SignUp />`.
- Rewrite `src/routes/_authenticated/route.tsx` gate: use Clerk's `getAuth()` (server) / `useAuth()` (client) instead of `supabase.auth.getUser()`.
- Replace `src/routes/index.tsx` and `src/routes/auth.tsx` sign-in buttons — remove `lovable.auth.signInWithOAuth` calls; use Clerk's `<SignInButton>` or redirect to `/auth`.
- Update `src/components/dashboard-shell.tsx` sign-out and user display: `useUser()` from Clerk for name/email/avatar; `useClerk().signOut()` for the sign-out button; keep the existing cache-teardown ordering.
- Update `src/components/site-header.tsx` signed-in check to Clerk's `useAuth().isSignedIn`.
- Remove `src/integrations/lovable/` broker calls from all UI code (the package can stay installed).

### 7. Remove Supabase auth wiring
- Delete unused `src/integrations/supabase/auth-attacher.ts` import from `src/start.ts`.
- Remove any `supabase.auth.*` calls from components (getSession, getUser, onAuthStateChange, signOut) — replace with Clerk equivalents.
- Keep `src/integrations/supabase/client.ts` in place (it's auto-generated) but stop using its `.auth` surface.

### 8. Test
- Sign up a new user via Clerk → confirm `profiles` row is created (we'll add a small `ensureProfile` server fn called from the `_authenticated` layout since we can't rely on the old auth.users trigger).
- Verify RLS: create an Instagram account, confirm it's readable only by the owner.
- Verify admin panel: manually seed a `user_roles` row for your Clerk ID via the migration/insert tool, confirm `has_role` gate passes.
- Verify Whop webhook still provisions users end-to-end.
- Verify Bunny download still works from admin panel.

## Risks / what will break

- **All existing users must re-sign-up.** Any test data tied to old UUIDs is wiped.
- **Google OAuth** moves from the Lovable-managed broker to Clerk-managed Google. You'll need to configure Google in the Clerk dashboard (Clerk provides shared dev credentials by default).
- **Whop webhook** currently identifies users by Supabase user id in metadata. After migration, Whop metadata must carry the Clerk user id (or email) instead — I'll switch it to email lookup.
- **Realtime / storage RLS** on the `account-photos` bucket also uses `auth.uid()` and will need policy updates.
- **`supabase--configure_social_auth`** and Lovable Cloud's managed OAuth UI become irrelevant; Clerk owns auth going forward.

## Decisions I need from you before building

1. **Wipe existing data?** (recommended — option 1 above). If no, we need a per-user mapping strategy.
2. **Which sign-in methods should Clerk enable?** Currently the app uses Google only. Same in Clerk, or add email/password too?
3. **Confirm you understand this replaces Lovable Cloud auth entirely** — sign-in, user records, session management, and admin identification all move to Clerk. Supabase remains only as the database.

Reply with your answers (or "proceed with defaults: wipe + Google only") and I'll implement.
