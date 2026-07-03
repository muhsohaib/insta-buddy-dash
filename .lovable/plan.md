## Current architecture — analysis

The scheduling feature today is calendar-centric:

- Single table `scheduled_posts` acts as both the calendar event and the fulfillment record. Columns are Bunny/video-specific (`bunny_video_id`, `bunny_library_id`, `thumbnail_url`) and assume every post is a single-video Reel.
- Status enum is a shallow `pending / completed` pair carried on the same row — no distinction between "draft", "scheduled", "publishing", "published", "failed".
- Business logic lives in `src/lib/posts.functions.ts` as `createServerFn` handlers only. There is no transport-agnostic core, no REST surface, and no way for an agent (Claude, Zapier, MCP) to create a post without impersonating a browser session.
- Calendar page (`dashboard.index.tsx`) reads `scheduled_posts` per-account, then re-shapes them into `CalendarPost`. The calendar is effectively the domain model.
- No concept of Campaigns, no publication type, no per-media table, no hashtags/notes/assignee, no audit event trail like `order_events`.

### What's wrong

1. Table shape is media-bound (single Bunny video). Adding Image, Carousel, or a photo-only post means new nullable columns or forks.
2. Lifecycle can't represent the human fulfillment workflow (queue → download → publishing → published/failed).
3. Business logic is only reachable through the TanStack RPC — not idempotent, not versioned, not documented, no API-key auth.
4. Calendar UI, storage, and status all share one shape, so any schema change (Campaigns, assignee, IG URL) ripples into the UI.

## New architecture — same philosophy as the OMS

Mirror the OMS pattern exactly:

```
Client (Web / Claude / MCP / Zapier)
        │
        ▼
REST API  ──►  Core module  ──►  Supabase (Publications + Media + Events)
        ▲                                │
        │                                ▼
   createServerFn (website)     Admin queue (humans)
```

- Introduce **Publication** as the domain object. Calendar and admin queue are two views over the same rows.
- Extract logic into `src/lib/publications.core.ts` (transport-agnostic). `publications.functions.ts` (website) and `/api/public/v1/publications/*` (agents) both delegate to it.
- Reuse `authenticateApiRequest` from the OMS work — one auth path for Clerk session JWTs and workspace API keys.
- Keep the current calendar UI and `SchedulePostDialog` flow. Only rewire what they call.

## Database design

### `publications` (new — replaces `scheduled_posts` conceptually)

Core columns:

- `id uuid pk`
- `org_id text not null` — Clerk org / personal workspace
- `account_id uuid not null → instagram_accounts`
- `campaign_id uuid null → campaigns` *(nullable now, table added later)*
- `type publication_type not null` — `reel | image | carousel | video`
- `status publication_status not null default 'draft'`
- `caption text not null default ''`
- `hashtags text[] not null default '{}'`
- `scheduled_at timestamptz not null`
- `assigned_to text null` — Clerk user id of the human operator (future use)
- `notes text not null default ''`
- `published_at timestamptz null`
- `instagram_post_url text null`
- `failure_reason text null`
- `source text not null default 'web'` — `web | api | mcp | zapier | ...`
- `created_by text not null` — Clerk user id or `api_key:<id>`
- `created_at`, `updated_at`

Constraints: index on `(org_id, scheduled_at)` for calendar range queries; index on `(status, scheduled_at)` for the admin queue.

### `publication_media` (new)

- `id uuid pk`
- `publication_id uuid not null → publications on delete cascade`
- `position int not null` — carousel order
- `kind text not null` — `video | image`
- `bunny_video_id text null`, `bunny_library_id text null`, `thumbnail_url text null`
- `image_url text null`
- `unique (publication_id, position)`

One row per asset. A Reel/Video has one row; a Carousel has many; an Image has one image row.

### `publication_events` (new — like `order_events`)

`id, publication_id, event_type, actor_type (user|api_key|system), actor_id, payload jsonb, created_at`. Every status change and edit writes an event.

### `campaigns` (new, empty relationship for now)

`id, org_id, name, description, starts_at, ends_at, created_by, created_at, updated_at`. Nothing hooked up yet — the FK on `publications.campaign_id` is enough to add later without migration.

### Legacy `scheduled_posts`

Kept intact this iteration for zero-downtime. New writes go to `publications`; a read-time union in the calendar loader shows both so existing rows don't disappear. Backfill migration (copy `scheduled_posts` → `publications` + `publication_media`) ships in a follow-up once we've verified the new path.

## Lifecycle

```
draft → scheduled → ready_for_publishing → publishing → published
                                                     ↘ failed
```

- `draft`: created without a firm schedule (API can post drafts).
- `scheduled`: has `scheduled_at` in the future. Website's dialog always lands here.
- `ready_for_publishing`: cron flips rows whose `scheduled_at <= now()` and status = `scheduled`. This is what the admin queue reads.
- `publishing`: human operator clicked "Start publishing".
- `published`: operator marked done; stamps `published_at`, optional `instagram_post_url`.
- `failed`: operator marked failed with `failure_reason`; can be retried back to `ready_for_publishing`.

Trigger `stamp_publication_status` stamps timestamps and writes a `publication_events` row on every transition, matching the OMS pattern.

## Calendar interaction

- Calendar becomes a **pure view**. It calls `listPublicationsInRange({ from, to })` — a single query on `publications` filtered by `org_id` and `scheduled_at` window.
- Drag-and-drop → `PATCH /publications/{id}` with `{ scheduled_at }`. Nothing else. Server rejects the edit if status is `publishing`/`published`.
- Create-from-day → existing dialog now calls `createPublication` (core module). Same UX, new backend.
- Edit dialog → `updatePublication` for caption/schedule/media.

The calendar has no concept of "post" state — it just renders whatever `publications` returns.

## Human workflow

New admin page `/admin/publications` (queue view — separate from calendar):

- Tabs: `Today` (scheduled_at within today) · `Ready` (status=ready_for_publishing) · `Publishing` · `Failed`.
- Row actions: **Download media** (signed Bunny URL, existing helper), **Start publishing** (→ publishing), **Mark published** (→ published + IG URL), **Mark failed** (→ failed + reason).
- Cron every minute promotes `scheduled → ready_for_publishing` when due.

## REST API (`/api/public/v1/publications/*`)

Authenticated with the same `authenticateApiRequest` from the OMS work.

- `GET /publications?status=&from=&to=&account_id=&cursor=`
- `POST /publications`
- `GET /publications/{id}`
- `PATCH /publications/{id}`
- `DELETE /publications/{id}`
- `POST /publications/{id}/publish` — human/agent shortcut to mark published
- `GET /calendar?from=&to=` — thin wrapper that returns publications shaped for calendar display
- OpenAPI spec extended at `/api/public/v1/openapi`.

## Incremental rollout

1. **Migration**: add `publication_type`, `publication_status` enums; create `publications`, `publication_media`, `publication_events`, `campaigns`; triggers + GRANTs; cron job for `scheduled → ready_for_publishing`.
2. **Core module**: `src/lib/publications.core.ts` (list/get/create/update/delete/transition + event logging + media handling).
3. **Server fns**: `src/lib/publications.functions.ts` — thin wrappers used by the website. `posts.functions.ts` kept, marked deprecated, but continues to work against `scheduled_posts` until step 5.
4. **REST layer**: `src/routes/api/public/v1/publications/*.ts` + calendar route; update `openapi.ts`.
5. **UI rewire (no visual change)**:
   - `dashboard.index.tsx` — swap `listMyPostsForAccount` per-account fetch for a single `listPublicationsInRange` call; keep `CalendarGrid` untouched.
   - `SchedulePostDialog` / `EditPostDialog` — swap the create/update calls to publications core (type defaults to `reel`, single media row). Same fields, same UX.
   - `CalendarGrid` drag → `updatePublication({ scheduled_at })`.
6. **Admin queue**: new `/admin/publications` page reading `publications` by status.
7. **Backfill + cutover** (last step, separate turn): copy any remaining `scheduled_posts` rows into `publications` + `publication_media`, then delete the read-time union.

## Technical notes

- `publications.core.ts` never imports `client.server` at module scope — same rule as `orders.core.ts`.
- API key permissions: existing `api_keys` scope already covers `publications:read`/`publications:write` — add those scope constants.
- RLS: `publications` and children scoped by `org_id = current_org()`; admin service role only for the queue.
- Calendar range query is one round-trip; drops the current N-queries-per-ready-account fan-out in `dashboard.index.tsx`.
- No UI redesign in this plan — `SchedulePostDialog`, `CalendarGrid`, `EditPostDialog` keep their current markup and interactions.
