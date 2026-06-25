
# Step 2 — Admin Member Management

Build the full member management module in the Admin PWA. Covers directory, CRUD, trainer assignment, and the Member 360 profile view.

## Routes

```
src/routes/_authenticated/admin/
  members.tsx              directory (list + filters + Add Member dialog + bulk import)
  members.$memberId.tsx    Member 360 (tabbed profile)
```

Add "Members" link to `AdminSidebar`.

## 2.1 — Member Directory (`/admin/members`)

**Table** (shadcn `<Table>` + TanStack Query):
- Columns: photo + name, email, status badge (active / inactive / expiring soon), assigned trainer(s), join date, last login.
- Search: name/email (client-side filter on fetched list).
- Filters: status select, trainer select.
- Sortable headers: name, join date, last login.
- Row click → `/admin/members/$memberId`.

Status derivation: `users.active=false` → inactive; `member_profiles.membership_expires_at` within 14d → expiring soon; else active.

**Add Member dialog** — react-hook-form + zod:
- Fields: name, email, phone, goals (textarea), experience level (select: beginner/intermediate/advanced), medical history (textarea), photo upload (Supabase Storage `member-photos` bucket).
- Server function `inviteMember` (admin-only, `requireSupabaseAuth` + `has_role` check, loads `supabaseAdmin` inside handler):
  1. `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { gym_slug, role: 'member', display_name }})` — trigger creates `users` + `user_roles` + empty `member_profile` row.
  2. Update `users` (phone, photo_url), update `member_profile` (goals, experience, medical_history).
- Toast on success, invalidate `['members']`.

**CSV bulk import**:
- Dialog with file input, parse with PapaParse client-side, preview table, "Import" calls `inviteMembersBulk` server fn (loops `inviteMember` logic), shows per-row success/error.

**Soft delete (Remove Member)**:
- Row action menu → confirm dialog → `deactivateMember` server fn sets `users.active=false` and `trainer_assignments.active=false`. Historical data preserved.

**Trainer Assignment**:
- In member detail (and as row action): "Manage trainers" dialog — multi-select of gym's trainers, writes to `trainer_assignments` (insert new active rows, mark removed ones inactive).

## 2.2 — Member 360 (`/admin/members/$memberId`)

Header card: photo, name, status badge, contact, "Edit" + "Assign trainer" actions.

**Tabs** (shadcn `Tabs`):
1. **Overview** — demographics (DOB, gender, height, weight from `member_profile`), goals, experience, medical history, membership type & expiry, assigned trainers, contact info. Inline edit dialog.
2. **Assessments** — list `fitness_assessments` rows (date, weight, body fat, key metrics). Empty state "No assessments yet — form coming in Step 3".
3. **Workout Plans** — list `workout_plans` with status badge, day count, "View" link (deferred page).
4. **Attendance** — `attendance_logs` table + simple monthly count.
5. **Notes** — trainer notes (timestamped, author, body). Requires new `member_notes` table.

## Data layer

**New migration**: `member_notes` table
```
member_notes(id, gym_id, member_id, author_id, body text, created_at, updated_at)
```
RLS: admin full CRUD in gym; trainer can SELECT/INSERT/UPDATE/DELETE own notes for assigned members; member cannot read. GRANTs to `authenticated` + `service_role`.

**Storage bucket**: `member-photos` (public read, authenticated write within own gym path). Migration creates bucket + policies.

**Server functions** (`src/lib/members.functions.ts`):
- `listMembers()` — admin/trainer scoped; joins `users`, `member_profiles`, latest `trainer_assignments` (with trainer names), last sign-in via `supabaseAdmin.auth.admin.listUsers` (admin only).
- `getMember(memberId)` — single member with profile, trainers, recent assessments/plans/attendance/notes.
- `inviteMember(input)`, `inviteMembersBulk(rows)`, `deactivateMember(id)`, `updateMember(id, patch)`.
- `assignTrainers(memberId, trainerIds[])`.
- `listTrainers()` — gym's trainers for selectors.
- `listMemberNotes(memberId)`, `createMemberNote(memberId, body)`, `deleteMemberNote(id)`.

All gated by `requireSupabaseAuth` + role check via `has_role` RPC.

## Components

- `src/components/members/member-table.tsx`
- `src/components/members/add-member-dialog.tsx`
- `src/components/members/bulk-import-dialog.tsx`
- `src/components/members/assign-trainers-dialog.tsx`
- `src/components/members/member-notes.tsx`
- `src/components/members/status-badge.tsx`

## Out of scope (later steps)

- Email-template customization (uses default Supabase invite email for now).
- Fitness assessment form (Step 3).
- Workout plan builder (Step 4).
- Check-in flow (Step 5).
