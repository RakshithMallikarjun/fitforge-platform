# FitForge — Setup

## AI (progressive overload suggestions)

Uses **Lovable AI Gateway** (`google/gemini-2.5-flash` by default). The
`LOVABLE_API_KEY` secret is auto-provisioned — no manual API key needed.

If you want to switch models, edit `model:` in `src/lib/overload.functions.ts`.

## Web Push (deferred — Prompt 8.2)

Once you're ready to enable push notifications, generate a VAPID keypair:

```bash
npx web-push generate-vapid-keys
```

Add these as secrets:

- `VAPID_PUBLIC_KEY`  (exposed to the browser via a server function)
- `VAPID_PRIVATE_KEY` (server only)
- `VAPID_SUBJECT`     (`mailto:you@yourgym.com`)

Then build the `push_subscriptions` table + `send-push` edge function.

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
