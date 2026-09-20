# FitForge — Setup

## Creating gyms

Platform admins create gyms from **/platform/gyms → New gym**. That flow picks
the gym code, sends the owner an invite email, and makes them an admin of that
gym only. No database access is needed.

### `BOOTSTRAP_ADMIN_TOKEN` (legacy)

`BOOTSTRAP_ADMIN_TOKEN` is the **legacy** path for gyms created before the
console could provision them. It only works for a gym whose
`pending_owner_email` matches the signed-in caller's own email, and only while
that gym has no admin. Once every gym has an admin, unset the secret — new gyms
should always be created and claimed through the console.

## AI (progressive overload suggestions)

Uses **Lovable AI Gateway** (`google/gemini-2.5-flash` by default). The
`LOVABLE_API_KEY` secret is auto-provisioned — no manual API key needed.

If you want to switch models, edit `model:` in `src/lib/overload.functions.ts`.

## Web Push

Generate a VAPID keypair:

```bash
npx web-push generate-vapid-keys
```

Required secrets:

| Secret                  | Purpose                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`      | Public application server key (also needed in the browser as `VITE_VAPID_PUBLIC_KEY`; the Profile toggle stays disabled without it) |
| `VAPID_PRIVATE_KEY`     | Signs push messages (server only)                                                                                                   |
| `VAPID_SUBJECT`         | Contact for push services, e.g. `mailto:you@yourgym.com`                                                                            |
| `NOTIFY_WEBHOOK_SECRET` | Shared secret sent as `x-webhook-secret` when the server calls `notify-plan-assigned`                                               |

Plan-assignment pushes are fired directly from `src/lib/plans.functions.ts`
(`assignPlan` and `bulkAssignPlan`) — no database webhook is required. A push
failure is logged and never fails the assignment.

Push and offline support only work on the published site, where the service
worker registers; they do not work in the editor preview.

## Membership tiers, payments and dues

Each gym defines its own tiers (Bronze / Silver / Gold to start) under
**/admin/membership tiers**, with a price per term (monthly, quarterly,
half-yearly, annual). Recording a payment is what puts a member on a tier and
moves their expiry date — there is no free-text membership type any more.

- **/admin/dues** — who to chase, with one-click reminders (in-app message +
  push) and "Record payment" inline.
- **/admin/reports/revenue** — collections by month, tier and term.
- Reminder lead time, grace days, auto-reminders and the daily email hour live
  behind **Reminder settings** on the dues page.

### Daily email summary + dues digest

| Secret                  | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `RESEND_API_KEY`        | Sends the daily collection email through Resend        |
| `SUMMARY_FROM_EMAIL`    | Verified sender, e.g. `FitForge <billing@yourgym.com>` |
| `NOTIFY_WEBHOOK_SECRET` | Shared secret for the scheduled endpoints below        |

Schedule both endpoints **hourly** (pg_cron or any scheduler) — each gym is only
served when its own local hour matches, so every timezone works from one job:

```
POST https://project--<project-id>.lovable.app/api/public/daily-summary
POST https://project--<project-id>.lovable.app/api/public/dues-digest
header: x-webhook-secret: <NOTIFY_WEBHOOK_SECRET>
```

Admins can also send themselves today's summary from **Reminder settings →
Email me today's summary**.

## White-label branding

Each gym stores branding on the `gyms` row:

- `name`
- `primary_color` (hex, e.g. `#059669`)
- `logo_url`
- `font_family`
- `slug`
- `custom_domain`

The theme is loaded automatically when a member or staff user opens the
app (see `src/lib/gym-theme.functions.ts` + `theme-provider.tsx`).

### Subdomain / custom-domain resolution

`/manifest.webmanifest` reads the request host, extracts the subdomain
(or matches `custom_domain`), and returns a gym-branded PWA manifest.

DNS setup for `{slug}.fitforge.app`:

1. In your DNS provider, add a wildcard `CNAME`:
   `*.fitforge.app` → your Lovable published URL
2. Add each `gyms.slug` row in the database.
3. Members visiting `acmegym.fitforge.app` will get the Acme Gym
   manifest, theme, and logo automatically.

For a fully custom domain:

1. Set `gyms.custom_domain = 'app.acmegym.com'`.
2. Add a `CNAME` from `app.acmegym.com` → your Lovable published URL.
3. Configure the custom domain in Lovable **Project Settings → Domains**.

### Branded email invites

`inviteOneMember` / `inviteStaffMember` call
`supabaseAdmin.auth.admin.inviteUserByEmail`. The invite email template is
managed in the auth email templates and **cannot** be customized per gym
in code — customize once with gym-neutral copy (or per-gym via SMTP
routing if you set that up).

Suggested variables to include in the invite template:

- `{{ .SiteURL }}` — links back to the app
- `{{ .Email }}` — the invitee
- Add your gym logo statically in the email template HTML

## Per-gym assessment templates (future)

The `fitness_assessments` table currently exposes every field to every
gym. To gate fields per gym (Prompt 10.2, Task 6), add a
`gym_assessment_templates(gym_id, fields jsonb)` table and read it from
`components/assessments/new-assessment-sheet.tsx`. Not yet implemented.
