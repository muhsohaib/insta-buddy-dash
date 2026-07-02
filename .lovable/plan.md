## Premium Light SaaS Redesign

Full frontend redesign in a **white modern premium theme**. All backend logic, server functions, routes, and data flows stay intact — only presentation/component layer changes.

### Design tokens (`src/styles.css`)
- Base: pure white `#FFFFFF` background, off-white surfaces `#FAFAFA` / `#F5F5F7`
- Text: near-black `#0A0A0A` primary, muted `#6B7280`
- Accents: cyan `#00C2D1` (primary action) + soft purple `#7C6BF2` (secondary)
- Borders: hairline `rgba(10,10,10,0.06)`; shadows soft & layered (`0 1px 2px + 0 8px 24px`)
- Glassmorphism: white `rgba(255,255,255,0.7)` + backdrop-blur for floating panels
- Rounded-2xl default; generous spacing scale
- Add `framer-motion` for animations

### Homepage (`src/routes/index.tsx`)
- Minimal centered layout on white: logo, one-line tagline, large premium "Sign in with Google" button with subtle cyan glow
- Soft animated gradient blob background (cyan/purple, very low opacity)
- Successful sign-in → `/dashboard` (existing flow untouched)

### Dashboard shell (`src/components/dashboard-shell.tsx`)
- Left **sidebar** + top **navbar** layout via shadcn `Sidebar`
- Sidebar items with icons: Calendar (default), Accounts, Video Library, Analytics, Billing, Settings, Admin (if admin)
- Active item: cyan pill background, subtle glow
- Top navbar: logo, search input, notifications bell, avatar dropdown (email + sign out)
- Glass surfaces, hairline dividers, smooth hovers

### Calendar tab (new default `/dashboard`)
- Full month grid with large airy cells
- Hover a cell → animated cyan `+` fades/scales in center
- Top-right prominent "+ Create New Account" button (cyan gradient)
- Click `+` on a date:
  - no active account → open Create Account dialog (routes into existing pricing/onboarding)
  - accounts exist → open Upload/Schedule dialog (existing `PostDialog`), pre-fill date + account selector
- Scheduled posts render as chips inside cells

### Accounts tab (`/dashboard/accounts` — new page)
- Card grid: avatar, @username, status badge (green Active / red Suspended / orange Warmup), followers, last post, health score bar, quick actions (View, Schedule)
- Data via existing `listMyAccounts`

### Other tabs
- Video Library, Analytics: premium empty-state scaffolds (keeps nav complete, no backend changes)
- Billing, Settings, Admin: keep existing routes; restyled through new tokens

### Animations (framer-motion)
- Route fade/slide, card hover lift, sidebar item transitions, calendar `+` hover, dialog scale-in
- Respect `prefers-reduced-motion`

### Out of scope
- No server function / RLS / Supabase / webhook changes
- No changes to admin business logic

### Files to add/edit
- edit `src/styles.css` (light tokens, accents, shadows, glass)
- edit `src/routes/__root.tsx` (ensure light theme, meta)
- edit `src/routes/index.tsx` (minimal hero)
- edit `src/components/dashboard-shell.tsx` (sidebar + navbar)
- edit `src/routes/_authenticated/dashboard.index.tsx` → calendar view
- add `src/routes/_authenticated/dashboard.accounts.tsx` (accounts grid)
- add `src/routes/_authenticated/dashboard.library.tsx`, `dashboard.analytics.tsx`
- add `src/components/calendar-grid.tsx`, `src/components/account-card.tsx`, `src/components/schedule-dialog.tsx`
- `bun add framer-motion`

Approve and I'll build it.
