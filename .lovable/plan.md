# API-First OMS — Architecture Plan

## What exists today

- **Auth**: Clerk (users + Organizations). `requireClerkOrg` middleware resolves the active org for every server function.
- **Business logic**: lives in TanStack `createServerFn` files (`src/lib/orders.functions.ts`, `accounts.functions.ts`, etc.). Frontend calls them via `useServerFn` — a private, non-HTTP RPC protocol.
- **Order Management**: `orders`, `order_items`, `order_item_details`, `order_item_deliverables` tables, all scoped by `org_id`. Triggers recompute status. Whop webhook flips orders to paid.
- **Admin**: `has_role` RPC + admin-only server fns.
- **Human workflow**: unchanged, admin dashboard drives it.

## The gap

`createServerFn` is not an HTTP API. External agents (Claude, ChatGPT, Zapier, MCP) can't call it. Today the website is the only client.

## What changes

Introduce a **thin public REST layer at `/api/v1/*`** that wraps the *same* server-function handlers. The handlers stay the single source of truth; REST routes just parse HTTP, authenticate, resolve the org, and delegate.

### Authentication (Clerk-official)

Clerk's official answer for external/agent access is **Machine-to-Machine (M2M) tokens** issued per Organization, plus the existing session tokens for browser calls. Both are verified by Clerk's `verifyToken` / `authenticateRequest` — same JWT verifier we already use.

Two token types accepted on `/api/v1/*`:
1. **Session JWT** (browser, unchanged) — from Clerk's `getToken()`. Org resolved from `org_id` claim.
2. **M2M token** (agents) — created by workspace admins under Settings → API Keys. Scoped to one Organization. Claim `org_id` is set at issuance so agents can't switch orgs.

No custom auth. No "AI users." No service accounts. Every request resolves to the same `orgId` the middleware already produces.

### Backend refactor

- New middleware `requireApiAuth` accepts either token type and populates `{ orgId, userId | null, actor: 'user' | 'machine' }`.
- Extract the **handler bodies** of existing server functions into plain async functions (`createOrder`, `listOrders`, `submitDetails`, …) in `src/lib/orders.core.ts`. Both the server fn and the REST route call the core function. Zero behaviour change for the website.
- REST routes live under `src/routes/api/v1/**` (NOT `api/public/*` — these require auth).

### Public API surface (v1)

```
POST   /api/v1/orders                 create + return checkout URL
GET    /api/v1/orders                 list org orders
GET    /api/v1/orders/{id}            full order
GET    /api/v1/orders/{id}/status     lightweight status
POST   /api/v1/orders/{id}/details    submit per-item details
GET    /api/v1/orders/{id}/deliverables  delivered credentials
GET    /api/v1/products               catalog
```

Conventions: JSON in/out, Zod-validated bodies, RFC 7807-ish error shape, `Idempotency-Key` header honoured on POST, cursor pagination on lists.

### API Keys UI (Settings)

New "API Keys" section (admin only) in Workspace settings:
- Create key (label, optional expiry) → Clerk M2M token shown once.
- List / revoke keys.

Uses Clerk's Machine Tokens API server-side; keys are Clerk-managed, not stored in our DB.

## What stays exactly the same

- Customer dashboard, calendar, create-post flow.
- Admin dashboard and human fulfillment workflow.
- Whop webhook, triggers, DB schema.
- All existing `createServerFn` call sites (they now delegate to core functions internally).

## Incremental rollout

1. Extract order logic into `orders.core.ts`; rewire existing server fns to call it. (No behaviour change — verify site works.)
2. Add `requireApiAuth` middleware (session OR M2M) + tiny helper for JSON errors.
3. Ship `/api/v1/orders*`, `/api/v1/products` routes.
4. Add API Keys UI in Workspace settings.
5. Publish `/api/v1/openapi.json` + a short docs page so agents/MCP servers can discover the API.

## Technical notes

- Clerk verification: `@clerk/backend`'s `authenticateRequest({ request, secretKey })` handles both session and machine tokens; we already have `CLERK_SECRET_KEY`.
- M2M keys are created via Clerk's Backend API (`POST /v1/machine_tokens` or the current equivalent) — the API Keys route calls Clerk, we never mint JWTs ourselves.
- RLS unaffected: routes still use the org-scoped Supabase client returned by `requireClerkOrg`'s existing pattern.
- MCP server (future) becomes just another `/api/v1` consumer using an M2M key — no backend changes needed.

Confirm and I'll start with step 1 (extract core, wire REST for `/orders`), then iterate.