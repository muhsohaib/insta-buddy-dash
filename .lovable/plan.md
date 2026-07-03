# Order Management System — Design

Everything in the app revolves around an **Order**. An order contains one or more **order items** (today: Instagram accounts; tomorrow: other services). Payment happens first; details are collected after. Customer and admin dashboards both read from the same order model.

---

## 1. Core concepts

- **Order** — the transaction. One per checkout. Belongs to a workspace (Clerk org).
- **Order item** — one deliverable inside an order. For Instagram, one item = one account to warm up.
- **Product** — what is being sold. Today only `instagram_account` at $49. A product row defines price, name, and which detail-form schema to render.
- **Item details** — the per-item information the customer fills in after payment (brand, niche, bio, etc.). Stored generically as JSON keyed by product so future products can define their own fields.

Existing `instagram_accounts` and `account_details` tables become **derived views of order items** — or are replaced by `order_items` + `order_item_details`. Recommended: replace, and migrate existing rows into the new model.

---

## 2. Database structure

### `products`

Catalog of what can be sold. Seeded with one row today.

- `code` (unique, e.g. `instagram_account`)
- `name` (`Warmed Instagram Account`)
- `unit_price_cents` (`4900`)
- `active` (bool)
- `details_schema` (jsonb — field definitions for the per-item form)

### `orders`

One per checkout.

- `org_id` (Clerk org — the workspace)
- `created_by_user_id`
- `quantity` (total items)
- `subtotal_cents`, `total_cents`, `currency`
- `payment_status` — `pending | paid | failed | refunded`
- `payment_provider` (`whop`), `payment_ref` (Whop checkout/subscription id)
- `status` — see state machine below
- `paid_at`, `details_submitted_at`, `ready_at`, `delivered_at`
- `created_at`, `updated_at`

### `order_items`

One row per unit purchased. If quantity = 3, three rows are created at payment time.

- `order_id`
- `product_id` (→ `products`)
- `position` (1, 2, 3 — for "Account 1 / 2 / 3" UI)
- `status` — `waiting | creating | warming | ready | delivered | cancelled`
- `assigned_admin_id` (nullable)
- `started_at`, `ready_at`, `delivered_at`

### `order_item_details`

The customer-provided form data for one item. Separate table so items can exist before details are filled.

- `order_item_id` (unique)
- `data` (jsonb — validated against `products.details_schema`)
- `submitted_at`

For Instagram, `data` holds: `brand_name`, `website`, `niche`, `bio`, `username_style`, `profile_photo_url`, `notes`.

### `order_item_deliverables`

What the admin hands back once the item is `ready`. Generic so future products can deliver different payloads.

- `order_item_id`
- `data` (jsonb — for Instagram: `ig_username`, `ig_password`, `profile_url`, `email`, `email_password`, handoff notes)
- `delivered_at`, `delivered_by`

### `order_events` (audit log)

Every status transition, payment webhook, admin action.

- `order_id`, `order_item_id` (nullable), `actor_user_id`, `type`, `payload` (jsonb), `created_at`

### Tables removed/migrated

- `instagram_accounts` → `order_items` (product = `instagram_account`)
- `account_details` → `order_item_details.data`
- `scheduled_posts` keeps its own table but now FKs `order_item_id` instead of `instagram_accounts.id`.
- `subscriptions` (Whop) stays for recurring billing metadata but no longer gates access; **entitlement flows from paid orders**, not from an active subscription row.

---

## 3. Status model

### Order payment status

`pending → paid → (refunded)` or `pending → failed`

### Order status (derived from items + payment)

```
draft              — created client-side, not paid
awaiting_payment   — checkout started, webhook not received
awaiting_details   — paid, but customer has not submitted item forms
pending            — all details submitted, no admin work started
in_progress        — at least one item creating/warming, not all ready
ready              — every item status = ready
delivered          — every item delivered to customer
cancelled | refunded
```

Rule: order status is **computed** from `payment_status` + the set of `order_items.status`. Store it denormalized for fast list queries, recompute on any item change via trigger.

### Order item status

`waiting → creating → warming → ready → delivered`
Plus `cancelled`.

---

## 4. Customer flow (pages)

### `/order/new` — Step 1: quantity

- Slider / stepper, 1–N.
- Live total: `qty × $49`.
- CTA: **Continue to payment**.
- On submit: create `orders` row with `payment_status=pending`, `status=awaiting_payment`, then redirect to Whop checkout with `order_id` in metadata.

### Whop checkout → webhook

- Webhook (`/api/public/webhooks/whop`) verifies signature, finds order by metadata, sets `payment_status=paid`, `status=awaiting_details`, and inserts `quantity` blank `order_items` (status = `waiting`).

### `/order/:id/details` — Step 4: per-item forms

- Redirects here after payment.
- Renders **one collapsible section per `order_item**`, titled "Account 1 … N", each with the Instagram field set from `products.details_schema`.
- Saves progress per item (draft in `order_item_details.data` with `submitted_at` null).
- **Submit all** button — only enabled when every item validates. Sets `submitted_at`, moves order to `pending`.

### `/orders` — customer order list

- Cards: order #, date, quantity, total, status pill, progress bar (X / N ready).

### `/orders/:id` — customer order detail

- Header: order #, status, quantity, total, timeline (paid → details submitted → in progress → ready → delivered).
- Item list: Account 1/2/3, each with its own status pill and progress.
- When an item is `ready` or `delivered`, expand to show deliverable data (username, login, etc.).
- Actions: download credentials (once delivered), contact support.

---

## 5. Admin flow (pages)

Replace today's "Clients / Accounts / Posts" admin with **Orders-first**.

### `/admin/orders` — order queue

- Filters: status, workspace, date, product.
- Columns: order #, workspace, customer, qty, total, payment, status, age, next action.
- Default sort: oldest `pending` / `in_progress` first.

### `/admin/orders/:id` — order workspace

- Left: order header + timeline + customer notes.
- Right: item list. For each item:
  - Submitted details (read-only card).
  - Status selector (`waiting → creating → warming → ready`).
  - Deliverable form (username, password, etc.) — required before `ready`.
  - Assign to admin, add internal note.
- Bulk actions: mark all ready, deliver all.

### `/admin/workspaces` (was Clients) — index by workspace

Same data as today but pivoted from orders.

### Admin dashboard home

- KPIs: open orders, items waiting, items warming, avg time-to-ready, MRR (from paid orders in period), refunds.

---

## 6. Access & entitlement

- **Entitlement to schedule posts / use the calendar comes from delivered order items**, not from a subscription. An org can schedule for any `order_item` in `delivered` (or `ready`) status.
- The Calendar's "select account" list = delivered order items for the active org.
- Roles unchanged: any workspace member can act on the workspace's orders and items. Admin-only: refund, cancel, edit price.

---

## 7. Scaling to future services

Because items are typed by `products.code` and both details and deliverables are `jsonb` validated by `products.details_schema` / a `deliverable_schema`, adding a new service (e.g. "TikTok account", "Ad account", "Managed campaign") is:

1. Insert a `products` row with its price and schemas.
2. Register a renderer for its detail form and deliverable card.
3. No new tables, no changes to order/checkout/admin plumbing.

---

## 8. Migration plan (existing data)

1. Create new tables alongside old ones.
2. Backfill:
  - One `orders` row per historic `subscriptions` row (quantity = `subscriptions.quantity`, `payment_status=paid`).
  - One `order_items` row per existing `instagram_accounts` row, linked to that order, status mapped from `instagram_accounts.status`.
  - Copy `account_details` → `order_item_details.data`.
  - Repoint `scheduled_posts.account_id` → `order_item_id`.
3. Ship new UI reading from orders.
4. Drop old tables in a later migration once nothing reads them.

---

## 9. What I need from you before building

1. **Max quantity per order**: 10
2. **Whop today is subscription-based ($49/mo per account).** For the new order model, are orders **one-time purchases** or **recurring subscriptions per account**? This changes payment_status semantics and whether cancelling stops warming. (same recurring subscriptions)
3. **Refund policy** — refund an entire order only, or per item? (no refunds, if account is terminated admins will create new)
4. **Delivered vs Ready** — should items auto-flip to `delivered` when the admin fills the deliverable, or is `delivered` a separate customer-acknowledged step? (when all instagram accounts are ready then the order should automatically be delievered)
5. **Keep old data** — migrate the historic Instagram accounts into orders, or start fresh and archive? (start fresh and archive

Once these are decided I'll write the migrations and rebuild the flows. (i gave you answers in brackets for all questions)