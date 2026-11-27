# "Your access ends soon" reminders

Many students turn off renewal right after paying (3 of the first 11 cancellations came within 5 minutes) and keep studying. They're avoiding auto-renewal, not leaving, so the cancel flow's offers never reach them. These reminders do, before access ends.

## What students get

- **Email**, once per subscription period, up to 3 days before a monthly plan ends (7 for annual). If a daily run is missed, the next one catches up. Nothing is sent in the last 12 hours.
  - Subject: "Your PastPaperPrep access ends on December 1".
  - Body: plan name, end date, "you won't be charged again", one **Keep my plan** button (`/subscription/cancel?from=reminder`, which opens on Undo cancellation), the renewal price from a read-only Stripe preview (or "your current price"), and "your saved worksheets stay".
- **On-site strip** on the dashboard, account and bank pages, in the same window: "Your plan ends on Dec 1 and won't renew. [Keep my plan]". Hide for today. An unpaid-renewal notice always takes its place.

No discount, no pause, no guilt. Owner decision, 2026-11-27.

## Who is skipped

- Paused plans.
- Plans "Keep my plan" can't keep, because the in-app undo would show "unavailable" or refuse:
  - a legacy price or product the account editor can't manage
  - another subscription that isn't canceled or expired
  - any subscription under the customer without this account's `user_id`
  - an open Checkout session or invoice
  - a scheduled change or pending update, a cancel date other than the period end, or more than one item

  The dry run lists these as `undo_unavailable`.
- Students who keep access another way: Lifetime, complimentary All Access (`source = manual`), or another plan that renews or ends later.
- Accounts without a confirmed email, or whose Stripe owner doesn't match the customer mapping.
- Anyone already reminded for that (subscription, end date).

Targeting uses billing state only. `/privacy` promises that study activity is never used to contact anyone.

## Lawful basis

This is a service message about the student's own subscription with no offer, so it needs no marketing consent (UK PECR / EU ePrivacy) and no CAN-SPAM unsubscribe. `/privacy` says we email about account and subscription matters. Adding an offer would make it marketing: it would then need consent, an unsubscribe link and a postal address.

## How it runs

- Vercel `schedules.access-end-reminders` (`vercel.json`) calls `GET /api/cron/access-end-reminders` at 09:17 and 15:17 UTC, with `Authorization: Bearer $CRON_SECRET`. No secret, or the wrong one: 401. Running twice a day keeps a retry inside Resend's 24-hour idempotency window. `CRON_SECRET` must not contain a newline, or the build fails with `INVALID_CRON_SECRET`.
- `ACCESS_END_REMINDER_MODE`:
  - `off` (default): the job does nothing and no strip shows.
  - `dry_run`: lists who would be emailed and writes nothing.
  - `send`: emails, and the strip shows.
- `?dry_run=1` always lists without writing or sending, whatever the mode.
- Sending also needs `STRIPE_PLAN_EDITOR_ENABLED=true` (the undo lives behind it), `RESEND_API_KEY` and `ACCESS_END_REMINDER_FROM` (a `@pastpaperprep.com` sender). Without them, the run refuses.
- Idempotency: `subscription_end_reminders` has primary key (subscription_id, ends_at).
  - `claim_subscription_end_reminder` takes the row before sending. `finish_…` marks it sent or failed.
  - A timed-out send, a 429 or a 5xx keeps its claim. The next run, 6 to 18 hours later, retries once with the same Resend `Idempotency-Key`, inside Resend's 24-hour dedupe. A claim is only retried after 30 minutes.
- Safety cap: more than 50 reminders due in one run aborts it.
- Measuring: rows in `subscription_end_reminders` are the sends. `cancel_undone` with `source` = `reminder` / `notice` counts the saves.

## Launch (each step needs owner approval)

1. Apply `supabase/migrations/20261128000000_subscription_end_reminders.sql` to production (`supabase db query --linked -f …`). Then read back the grants: service_role can only select and execute the two functions.
2. In Resend, create a send-only API key restricted to `pastpaperprep.com`.
3. Add these Vercel production env vars:
   - `CRON_SECRET` (random, 32+ characters)
   - `RESEND_API_KEY`
   - `ACCESS_END_REMINDER_FROM="PastPaperPrep <hello@pastpaperprep.com>"`
   - `ACCESS_END_REMINDER_MODE=dry_run`
4. Merge and deploy. Check **Schedules** in the Vercel project.
5. Dry run:
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://pastpaperprep.com/api/cron/access-end-reminders?dry_run=1" | jq
   ```
   Check each row (masked email, plan, end date, renewal price, outcome).
6. Set `ACCESS_END_REMINDER_MODE=send` and redeploy. Check the first run in Vercel's Schedules history and the `subscription_end_reminders` rows.

To stop: set the mode to `off`, or disable the schedule (`vercel schedules disable access-end-reminders`).
