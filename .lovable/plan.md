# Fix membership tier price saving

## What will change
- Replace the fragile blur-only price behavior with an explicit save action for each membership term.
- Keep each term’s amount editable, show clear saving/error feedback, and preserve saved values after reload.
- Enable the “Sell {Term}” switch whenever that term has a valid saved price; switching it updates whether the term is offered.
- Show “Not on sale” for unpriced or disabled terms, while keeping the tier-level “On sale” control as the overall availability gate.

## Verification
- Extend the billing smoke test to save a term price, reload, confirm persistence, and toggle its sale status.
- Confirm Record payment recognizes a tier with an active, enabled price.
- Check the preview build and the live interaction path for errors.

## Technical details
- Reuse the existing authenticated `setPlanPrice` and `removePlanPrice` server functions; no database or business-rule changes are needed.
- Keep cache updates synchronized so the tier card reflects the saved server value rather than unsaved local text.
