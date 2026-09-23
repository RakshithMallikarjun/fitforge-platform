# AI plan generator, a new landing page, and search-visibility markup

Three separate pieces of work.

## 1. AI-generated workout plans for trainers

Trainers get a "Generate with AI" button in the plan builder. It opens a short form:

- Member goals (free text, e.g. "lose 6kg, build upper-body strength")
- Limitations / injuries (free text, e.g. "left knee, no overhead press")
- Available equipment (multi-select drawn from the gym's own exercise library)
- Days per week, session length, experience level

The answers are saved against the member, so a trainer filling them once sees them
pre-filled next time. Generating produces a full draft — training days, exercises,
sets, reps, rest — loaded straight into the existing builder, where the trainer can
edit or delete anything before saving. Nothing is written to the member's plan until
the trainer presses Save, exactly as today.

Guardrails: only exercises that already exist in that gym's library can appear in a
draft, requests are limited to staff of the member's own gym, and there is a daily
generation cap per gym so a stuck loop cannot run up cost. Every state is handled —
loading, empty, and a plain error message with a retry.

## 2. "Gym management software" landing page

A new page at `/gym-management-software` aimed at gym owners searching that term:
headline and sub-headline using the phrase naturally, a problem/solution section,
a feature grid (member app, plans and programming, attendance, billing and dues,
reports, white-label branding), a short "how it works" sequence, an FAQ block, and
two calls to action (Get started, Sign in) repeated at top and bottom. Internal
links to the home page, privacy, and terms; the home page links to it too. Added to
the sitemap.

## 3. Structured data on the marketing pages

Machine-readable markup so Google can show richer results:

- Organization (name, URL, logo, support email) site-wide
- SoftwareApplication (category, description, offer) on the home page and the new page
- FAQ on the new page, matching its visible FAQ text

## Technical notes

- Migration `drizzle/migrations/0020_member_training_profiles.sql`: new
  `member_training_profiles` table (gym_id, member_id, goals, limitations,
  equipment text[], days_per_week, session_minutes, experience), RLS enabled with
  `gym_id = public.current_gym_id()` in USING and WITH CHECK and staff writes via
  `public.has_role`; members may read their own row. GRANTs included. Types
  regenerated afterwards.
- `src/lib/plan-ai.functions.ts`: `getTrainingProfile`, `saveTrainingProfile`,
  `generatePlanDraft` — all `createServerFn` + `requireSupabaseAuth`, zod-validated,
  gym/role checks mirroring `plans.functions.ts`. Generation uses the existing
  `chatCompletion` helper (Lovable AI Gateway, JSON response) with the model reply
  validated by zod and exercise names resolved against the gym's `exercises` rows;
  unknown names are dropped. Daily cap counted per gym-local day via
  `src/lib/gym-date.ts`.
- `src/components/plans/ai-plan-dialog.tsx` wired into
  `src/routes/_authenticated/admin/plans.new.tsx`; draft maps onto the builder's
  existing `days`/`ExerciseInput` state.
- `src/lib/structured-data.ts` returns JSON-LD objects; injected through each
  route's `head()` `scripts`. Organization on `__root`, SoftwareApplication on
  `/` and the new route, FAQPage on the new route only.
- New route `src/routes/gym-management-software.tsx` with its own title,
  description, og:title/og:description; added to `sitemap[.]xml.ts`.
- `e2e/smoke.spec.ts` gains a happy path for the landing page and for opening the
  AI generator dialog.
