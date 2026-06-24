
# FitForge — Steps 0 & 1

Build the foundation for a white-label, multi-tenant B2B fitness SaaS with two apps in one codebase, plus the full Supabase data layer with RLS.

## Step 0 — Scaffold, routes, theming, design system

**Routes (TanStack Start file-based)**
```
src/routes/
  __root.tsx              shell + ThemeProvider + QueryClient
  index.tsx               marketing/login landing
  auth.tsx                login / signup (email + password)
  _authenticated/
    route.tsx             managed gate (integration owns this)
    admin/
      route.tsx           Admin shell (sidebar + glass header) — admin/trainer only
      index.tsx           dashboard (stats grid, engagement, payments, schedule)
    app/
      route.tsx           Member shell (mobile-first bottom nav) — member only
      index.tsx           today's workout / quick actions
```
Role gate inside each shell route redirects wrong-role users.

**Design system (src/styles.css)**
- Tokens via `oklch` for: background `#F8FAFC`, surface `#FFFFFF`, primary emerald `#059669`, primary-foreground, secondary sky `#0284c7`, emerald-900 `#064E3B`, success/info/danger, border `#E2E8F0`, ring.
- Radii: card `2rem` (32px), button `0.75rem` (12px).
- Shadows: `--shadow-card`, `--shadow-card-hover` (12px 20px -5px).
- Fonts loaded via `<link>` in `__root.tsx` head: General Sans (headings/numerals) + Satoshi (body) from Fontshare. `--font-display`, `--font-sans` tokens.
- Custom utilities: `.card-lift` (translateY(-4px) + hover shadow, 0.3s ease), `.glass-header` (sticky, white/90, blur 12), `.timeline-bar` (2px colored left border).
- Shadcn `button`, `card`, `badge` extended with `hero`/`bento`/`verified` variants — no ad-hoc colors in components.

**Runtime branding (ThemeProvider)**
- `src/lib/theme-provider.tsx` — context with `{ primaryColor, logoUrl, fontFamily }`, sets CSS vars on `:root` (`--primary`, `--font-sans`, etc.) via `useEffect`. Default = FitForge theme. Later swapped from `gyms` row; no rebuild needed.

**Shared shell pieces**
- `AdminSidebar` (256px, nav items, "Practice Verified" card, logout)
- `GlassHeader` (sticky, search pill, bell, avatar)
- `BentoStatCard`, `TimelineItem`, `StatusBadge` reusable components

**Landing page** — hero with both CTAs ("Member sign in" / "Gym admin sign in"), minimal — not a generic SaaS marketing dump.

## Step 1 — Supabase: schema, auth, RLS

Enable Lovable Cloud, then ship one migration containing:

**Enums**
- `app_role`: `admin | trainer | member`
- `subscription_plan`: `starter | growth | pro | chain`
- `plan_status`: `active | archived`

**Tables** (all with `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `gym_id uuid` where applicable, FKs + indexes):
gyms, users (id = auth.users.id), member_profiles, trainer_assignments, fitness_assessments, exercises (gym_id nullable for global library), workout_plans, workout_days, workout_exercises, workout_logs, exercise_logs, attendance_logs — exactly as specified.

**Roles table (separate, per security rules)**
- `user_roles(user_id, gym_id, role app_role, unique(user_id, role))` — roles NOT on `users` table.

**Security-definer helpers** (`SECURITY DEFINER`, `search_path=public`):
- `current_gym_id()` → reads `user_roles`/`users` for `auth.uid()`
- `has_role(_user_id, _role)` → bool
- `is_trainer_of(_member_id)` → bool via `trainer_assignments`

**RLS pattern on every gym-scoped table**
- `gym_id = current_gym_id()` for SELECT
- Admin: full CRUD within gym (`has_role(auth.uid(),'admin')`)
- Trainer: rows where member is in `is_trainer_of(member_id)` + global exercises
- Member: rows where `member_id = auth.uid()` (own profile/assessments/plans/logs); read-only exercise library

**GRANTs** on every public table to `authenticated` + `service_role` (no `anon` — all data is auth-gated).

**Trigger**
- `handle_new_user()` on `auth.users` insert → inserts into `public.users` (gym_id from signup metadata) and `user_roles` (default `member` unless metadata says otherwise).

**Auth flow**
- `/auth` page: sign in + sign up (with gym slug field on signup → resolves `gym_id`).
- Session listener wired once in `__root.tsx` (filtered to identity events).
- Post-auth redirect: admin/trainer → `/admin`, member → `/app`.
- Sign-out: cancel queries → clear cache → signOut → navigate `/auth` replace.

## Technical notes

- TanStack Query for all reads; `defaultPreloadStaleTime: 0`, per-request QueryClient.
- Server-side reads use `requireSupabaseAuth` middleware; nothing imports `client.server` into route/component chains.
- Multi-tenant isolation is enforced in the DB by RLS, not by app code — app code is the second line of defense.
- PWA manifest + service worker deferred to a later step (offline workout logging arrives with Step 2's logging UI).

## What ships at the end of this turn

A bootable app with: themed design system, dual app shells with role-gated routing, working email/password auth, and the full schema + RLS so subsequent feature work just consumes typed Supabase queries.
