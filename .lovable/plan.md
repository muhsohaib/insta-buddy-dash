
# Loomly — Client Portal Plan

A minimal, fast white-themed portal that organizes your existing manual Instagram-account + post-scheduling workflow. Clients sign in with Google, subscribe via Whop ($49/account/month), fill out an onboarding form per account, then schedule posts on a calendar. Your admins update statuses and download videos to publish manually.

## Stack

- **Frontend**: TanStack Start + React 19, Tailwind v4, shadcn/ui. White theme, generous whitespace, Inter font.
- **Backend**: Lovable Cloud (Postgres + Auth + Storage) for data, auth, RLS.
- **Auth**: Google OAuth via Lovable's managed broker.
- **Payments**: Whop (quantity-based subscription, $49 × N accounts).
- **Video**: Bunny.net Stream, direct browser upload via TUS (resumable).
- **Speed**: SSR + TanStack Query with `ensureQueryData` in loaders, route-level code splitting, preloaded routes on hover, optimistic mutations, Bunny CDN for video thumbnails.

## Data Model (Postgres, all with RLS + grants)

- `profiles` (id → auth.users, email, full_name, avatar_url, whop_customer_id)
- `user_roles` (user_id, role: `admin` | `client`) — separate table, `has_role()` security-definer fn
- `subscriptions` (user_id, whop_subscription_id, quantity, status, current_period_end)
- `instagram_accounts` (id, user_id, status: `pending_details` | `creating` | `warming_up` | `ready`, created_at)
- `account_details` (account_id, profile_photo_url, ig_username, bio, target_country, app_name, website, niche, competitors[], notes)
- `scheduled_posts` (id, account_id, caption, scheduled_at, bunny_video_id, bunny_playback_url, thumbnail_url, status: `scheduled` | `completed`, completed_at, completed_by)

**Provisioning rule**: `subscriptions.quantity` = number of `instagram_accounts` rows the client can own. When Whop webhook updates quantity up, we create N new `pending_details` rows; when down, we soft-cancel excess rows (admin decides which).

## Routes

Public
- `/` — landing (hero, how it works, testimonials placeholder, CTA)
- `/pricing` — quantity slider (1–20), live price = $49 × N, "Continue with Whop" → Whop checkout
- `/auth` — Google sign-in
- `/auth/callback` — session hydration, redirect to dashboard
- `/api/public/webhooks/whop` — Whop subscription events (signature-verified)

Authenticated (`_authenticated/`)
- `/dashboard` — overview: subscription status, accounts grid with status badges
- `/dashboard/accounts/$id` — if `pending_details`: onboarding form; else: status + calendar
- `/dashboard/accounts/$id/schedule/new` — modal route for New Post
- `/dashboard/billing` — Whop customer portal link, current plan, invoices
- `/dashboard/settings` — profile, email, sign out

Admin (`_authenticated/_admin/`, gated by `has_role('admin')`)
- `/admin` — client list with account counts + MRR
- `/admin/accounts` — all IG accounts, inline status editor
- `/admin/posts` — all scheduled posts sorted by `scheduled_at`, filter by status, download video, mark completed

## Key Flows

**1. Signup → subscribe**
Google sign-in → `/pricing` → pick quantity → server fn creates Whop checkout session with `metadata.user_id` → Whop hosted checkout → webhook `subscription.created` fires → we insert subscription + N `instagram_accounts` rows → user lands on `/dashboard`.

**2. Onboarding form**
Client opens a `pending_details` account → fills form (profile photo uploaded to Lovable Cloud Storage) → submit sets status to `creating` and inserts `account_details`.

**3. Admin fulfillment**
Admin sees new account in `/admin/accounts` → changes status: `creating` → `warming_up` → `ready`. Client sees live status via Supabase realtime subscription.

**4. Post scheduling (only when status = `ready`)**
Calendar (month view, click any date) or "New Post" button → modal opens → client selects video file → server fn mints a Bunny TUS upload token → browser uploads directly to Bunny with progress bar → on complete, we save caption + scheduled_at + bunny_video_id → post appears on calendar.

**5. Admin publishing**
Admin opens `/admin/posts` → sees next post due → clicks Download (signed Bunny original URL) → uploads to Instagram manually → clicks "Mark completed" → status flips.

## Whop Integration

- **Checkout**: server fn `createCheckout({ quantity })` calls Whop API with our plan ID, `quantity`, `metadata.user_id`, success URL = `/dashboard`, cancel = `/pricing`.
- **Webhook** `/api/public/webhooks/whop` (HMAC-verified):
  - `membership.went_valid` / `subscription.created` → upsert subscription, provision accounts.
  - `membership.went_invalid` / `subscription.cancelled` → mark subscription cancelled, revoke calendar access after period end.
  - `subscription.updated` (quantity change) → add/remove account slots.
- **Customer portal**: link to Whop-hosted billing from `/dashboard/billing`.
- Secrets needed: `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_PLAN_ID`. I'll request these via `add_secret` after enabling Cloud.

## Bunny.net Integration

- One Bunny Stream library for the whole app.
- Server fn `createBunnyUpload()` creates a video object via Bunny API, returns `{ videoId, tusEndpoint, authorizationSignature, authorizationExpire, libraryId }`.
- Browser uses `tus-js-client` to upload directly with those headers — resumable, no server bandwidth.
- On success, save `bunny_video_id`; construct thumbnail + iframe URLs from Bunny CDN.
- Admin downloads original via server fn that returns a signed direct-play URL.
- Secrets needed: `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`.

## Speed Strategy

- SSR every public page with preloaded data via TanStack Query `ensureQueryData`.
- `defaultPreloadStaleTime: 0` + link hover preloading on all internal nav.
- Route-level code splitting (default in TanStack Start).
- Optimistic UI on post create/edit/delete.
- Realtime subscription for account status so clients don't refresh.
- Bunny CDN handles video delivery globally; we never proxy video bytes.
- Skeleton loaders sized to final content to avoid layout shift.

## Design

White background, near-black text, single accent color (deep indigo `#4F46E5`), generous spacing, rounded-xl cards, subtle borders (`oklch(0.93 0 0)`), no gradients, no dark mode in v1. Inter for everything. Calendar uses a clean month grid with post thumbnails as chips.

## Build Order

1. Enable Lovable Cloud, set up schema + RLS + roles.
2. Landing + pricing + Google auth + `/dashboard` shell.
3. Whop checkout + webhook + subscription provisioning.
4. Onboarding form + account status display + admin status editor.
5. Bunny TUS upload + scheduling modal + calendar view.
6. Admin posts dashboard (list, download, mark completed).
7. Billing page, settings, polish, empty states, SEO metadata per route.

## Out of Scope (v1)

- Auto-publishing to Instagram
- In-app messaging with clients
- Analytics/reporting on posts
- Team seats per client
- Refund/proration UI (handled in Whop portal)

Ready to build when you approve. I'll ask for Whop and Bunny credentials at the right steps.
