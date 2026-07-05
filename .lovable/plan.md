## Phase 7b — remaining sub-parts

Ships every remaining endpoint in `docs/openapi.json` behind the existing 7b envelope contract (`ok` / `okList` / `SpecError` / `X-Request-Id`, opaque cursor pagination, spec `ErrorCode` mapping). No spec re-design.

### 7b.4 — Orders + Deliveries (13 ops)
Backed by existing `orders`, `order_items`, `order_item_details`, `order_item_deliverables` tables.

- `src/lib/orders.spec.core.ts` — DB → spec `Order` mapping. Status collapse: `awaiting_payment|awaiting_details|pending|in_progress → active`, `ready|delivered → fulfilled`, `cancelled → cancelled`, `refunded → refunded`.
- `src/lib/deliveries.spec.core.ts` — one delivery per `order_item_deliverables` row. `accepted_at` / `issue_reported_at` stamped via new nullable columns (added in a small migration, not schema redesign).
- Routes:
  - `GET|POST /orders`, `GET /orders/{order_id}`
  - `POST /orders/{order_id}/replacement` (creates a new order linked via `metadata.replacement_of`)
  - `GET /orders/{order_id}/deliveries`
  - `GET /deliveries`, `GET /deliveries/{delivery_id}`
  - `POST /deliveries/{delivery_id}/accept`
  - `POST /deliveries/{delivery_id}/report-issue`

### 7b.5 — Workspace admin (17 ops)
Split by resource, all under `/workspace/*`.

- `PATCH /workspace` — updates `name`, `timezone`, `default_locale` on a new `workspaces` row keyed by `orgId` (auto-provisioned on first read).
- **api-keys** (4 ops) — backed by existing `api_keys` table. `POST` returns the plaintext token once; storage stores hash + `last4`.
- **members** (4 ops) — backed by Clerk org memberships; read-only mirror + role updates via Clerk admin API. `DELETE` revokes membership.
- **webhooks** (7 ops) — new tables `webhooks` + `webhook_deliveries` (small migration). `rotate-secret` and `replay` implemented.

### 7b.6 — Assets + Products + Search + live OpenAPI (10 ops)
- **assets** (6 ops) — new `assets` table (id, workspace_id, kind, mime, bytes, sha256, upload_url, status). `POST /assets` returns a presigned Supabase Storage upload URL for the existing `account-photos` bucket (renamed usage: `workspace-assets`, add bucket). `complete` flips status to `ready`.
- **products** (2 ops) — read from existing `products` table.
- **search** (1 op) — cross-resource keyword search over posts, accounts, assets, orders (LIKE-based, no FTS yet).
- **openapi live** — replace hand-written `openapi.ts` with a handler that streams `docs/openapi.json` verbatim (imported as a build-time asset), rewriting `servers[0].url` to the request origin.

### Cross-cutting
- One migration adds: `workspaces`, `webhooks`, `webhook_deliveries`, `assets`, `order_item_deliverables.accepted_at`, `.issue_reported_at`, `.issue_reason`, plus GRANTs + RLS scoped by `org_id`.
- `scripts/regen-routes.mjs` re-run after all files land so `src/routeTree.gen.ts` picks up the ~35 new route files (including colon bulk paths already handled in 7b.2).
- Existing legacy routes (`orders.ts`, `orders/$id.ts`, `publications.ts`, `media.ts`, `calendar.ts`) stay in place — they serve the app UI and are outside the spec surface. Phase 7c will retire them.

### After 7b: 7c–7g preview (for cadence agreement)
- **7c** — replace the app's data layer to consume `/api/public/v1/*` exclusively (retire `*.functions.ts` server fns that duplicate spec endpoints).
- **7d** — real Asset pipeline (Bunny/Storage), swap `asset://` opaque strings in posts for real asset IDs.
- **7e** — ✅ webhooks delivery worker + retry/backoff + signature. `src/lib/webhooks-dispatch.server.ts` (HMAC-SHA256 signature `t=..,v1=..` + `enqueueWebhookEvent` fan-out). `src/routes/api/public/hooks/webhook-worker.ts` cron worker: batches 25, exponential backoff 30s→1h, 8 attempts, 10s timeout, anon-key gated. Wired into `api-keys` (created/revoked), `assets` (ready), `deliveries` (accepted/issue_reported). pg_net enabled, cron scheduled every minute.
- **7f** — rate limiting, idempotency keys, request-id tracing.
- **7g** — remote MCP generated from the live `/openapi.json`.

Say **"go"** and I ship 7b.4 → 7b.6 in one pass (one migration + ~35 route files + 8 core modules), or **"one sub-part at a time"** to keep the previous cadence.
