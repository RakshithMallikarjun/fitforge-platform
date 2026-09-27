# Billing permissions — manual test script

All billing server functions use one guard, `requireGymRole` in
`src/lib/membership-plans.functions.ts`: caller from their session, gym from
`current_gym_id()`, role checked in `user_roles` for that gym.

| Action | Admin | Trainer | Member |
|---|---|---|---|
| Start with Bronze/Silver/Gold, new/edit/archive tier, prices | yes | "Only admins can change prices, tiers and billing settings." | Forbidden |
| Reminder settings (open/save) | yes | same admin-only message | Forbidden |
| Preview / record payment, dues, send reminders | yes | yes | Forbidden |
| Refund, cancel membership, revenue report | yes | admin-only message | Forbidden |

Steps
1. Gym admin: Membership tiers → Start with Bronze/Silver/Gold → three tiers appear. Set a
   monthly price, toggle ad-free, archive one — each saves.
2. Dues → Reminder settings → saved values load, change grace days, Save.
3. Members → a member → Record payment → price comes from the tier, covered dates and new
   expiry preview → Save → expiry/status update; payment shows in Dues, Revenue, Payment history.
4. Trainer: steps 1–2 show the admin-only message; step 3 works.
5. Member (call any billing action): Forbidden.
6. Cross-gym: as admin of gym A, call `updatePlan`/`setPlanPrice`/`archivePlan` with a tier id
   from gym B → Forbidden.
