# Pepper allowances: weekly credits by plan, plus credit packs

Status: approved by the owner on 2026-11-25 (revision 3) and built on `feat/pepper-allowances`. The production migration has not been applied.

## Cost per message

- **Measured:** on the #528/#529 previews, Sonnet 5.5 at medium effort cost $0.012–$0.021 a message, averaging $0.016. That's 7 messages from the `helper_usage` token logs, priced at $2 in, $10 out, $0.10 cache read and $2.50 cache write per million tokens.
- **Caps:** every message has a fixed limit on tool rounds and reply length, so no single message can run away.
- **Production usage so far:** 25 messages from one account (owner testing). There's no student data yet.

## Weekly, not daily

- **Students study in sessions,** often once or twice a week. A daily limit cuts them off mid-session and wastes the days they don't log in. A weekly allowance lets them do a lot at once.
- **Claude does the same:** a weekly limit that resets at a fixed time, shown as a usage bar.
- **Reset:** every Monday at 00:00 UTC, the same for everyone. The panel says "resets Monday" in the student's own time zone. A fixed day is easier to understand than a rolling window.
- **Why not every two weeks:** a student who uses everything early would wait up to 13 days. That's too long right before an exam.
- **Abuse guard:** no account can spend more than 1,000 credits in one day. A student studying hard won't reach it; it only stops scripts.

## Credits with fixed costs

Credits are a display unit at 10× the message count. They aren't tied to token spend.

| Action | Credits |
|---|---|
| A message (hint, explain, chat, find a paper) | 10 |
| A message with a photo (mark my working) | 20 |
| An exact paper, topic or subject open (rules, no AI) | 0 |

- **Predictable:** the student always knows what a message costs, and 1,000 credits sounds better than 100 messages.
- **Photos cost double:** they send more tokens and produce longer marking. Doubling the price covers that with room to spare.
- **Refunds:** if no reply reaches the student, the exact credits go back to the week or pack they came from.

## Allowance per plan

**Rule:** worst case (every credit used every week: 4.35 weeks × weekly messages × $0.016) stays below each plan's monthly price after Stripe fees (5.8%).

| Plan | Pays (monthly / annual) | Credits a week | Messages a week | vs free | Worst-case month | Net income a month |
|---|---|---|---|---|---|---|
| Free account | $0 | 150 | 15 | — | $1.04 | — |
| One bank | $6 / $4 | 700 | 70 | 4.7× | $4.87 | $5.65 |
| 2 banks | $10 / $7 | 1,200 | 120 | 8× | $8.35 | $9.42 |
| 3 banks | $14 / $10 | 1,700 | 170 | 11× | $11.83 | $13.19 |
| 4+ banks | $18 / $13 | 2,200 | 220 | 15× | $15.31 | $16.96 |
| All Access and Lifetime | $25 / $18, or $299 once | 3,000 | 300 | 20× | $20.88 | $23.55 (Lifetime: $299 covers 13 months at the maximum) |

- **Worst case assumes no photos.** Photos are priced at double, so they only lower our cost per credit.
- **The annual-plan edge case:** only an annual payer who spends every credit every week costs more than they pay. On One bank that's about $1 a month over. The site-wide cap still bounds total spend, and the cost logs let us lower a plan's credits if it runs hot.
- **How the server picks the tier:**
  - `lifetime_all_access` or `bundle_all` → All Access, including complimentary grants
  - anything else → the number of distinct banks the account can open (1, 2, 3, 4+), adding up across subscriptions. A grandfathered subject pair counts as 2.
- **Trials:** trialing counts as paid.
- **Mid-week upgrades:** an upgrade takes effect on the next message. The new weekly total applies, minus what was already spent this week.

## Credit packs (one-time)

| Pack | Price | Messages | Our cost at $0.016 | Net after fees (2.9% + 30¢ + 1.5% intl) | Net ÷ cost |
|---|---|---|---|---|---|
| 1,000 credits | $4.99 | 100 | $1.60 | $4.47 | 2.8× |
| 3,000 credits | $12.99 | 300 | $4.80 | $12.12 | 2.5× |

- **Order of use:** pack credits are used only after the week's plan credits run out, oldest expiry first.
- **Expiry:** pack credits expire 12 months after purchase.
- **Site-wide cap:** pack-paid messages skip the site-wide daily cap, because they're prepaid. They still stop when the kill switch is off, and they count toward the 1,000-a-day abuse guard.
- **Who can buy:** any signed-in account, free ones included.
- **Better value on a plan:** at about 5¢ a message, packs cost more than any plan (One bank works out at about 2¢), so subscribing stays the better deal.
- **Refunds and disputes:** a Stripe refund or dispute removes that pack's unused credits.
- **Why packs before an add-on:** packs fit exam-season bursts and have no renewals to manage. A monthly add-on can come later if pack buyers come back.

## What students see

- **Percentage first:** this week's plan credits are shown as "% left", because a scale of 100 is easier to read than raw credits. The bar shows the same share. Credits sit beside it.
- **Pepper panel:** "53% left · 640 credits · resets Sun 7 PM", with "+ 1,000 pack" when the student has pack credits. The reset shows in the student's own time zone, so Monday 00:00 UTC appears as Sunday evening in the Americas.
- **Photos:** while a photo is attached, the line reads "A photo uses 20 credits · 1,410 left".
- **Out of credits:** the panel says when credits come back and offers "Get more credits" (packs on /account), plus "Upgrade" for free accounts.
- **/account:** a Pepper card shows the percentage, the weekly credits, the bar, the pack balance and its first expiry, and buttons for both packs.

## Build

- **Migration:** a new forward migration.
  - `helper_usage_weekly(user_id, week_start, credits_used)`, with the per-day abuse guard kept in `helper_usage_daily`.
  - `helper_credit_packs`, with a unique Stripe checkout session id, so a pack is credited exactly once.
  - RLS: owners can read their own rows; only the service role can write.
  - `consume_helper_credits` charges the week first, then a pack, atomically, under a per-user lock.
  - `release_helper_credits` refunds to the original week or pack.
  - Both RPCs are service role only. The server passes in the plan's weekly total and the message cost it derived, so a client can't choose its own.
- **Code:**
  - `allowance.ts` derives the tier from entitlements.
  - The Pepper panel and /account show the balance.
- **Stripe:**
  - Checkout uses `mode=payment` with inline `price_data`, like Lifetime, so no new live products or prices.
  - The existing webhook credits the pack once, after checking paid status, amount, currency and pack metadata.
  - Refund and dispute events remove unused credits.
- **Your OK first:** applying the production migration, and any live purchase test.

## Rollout

1. **Migration first, with the owner's OK:** apply `20261126000000_helper_weekly_credits.sql` to production before this code deploys. Until then the code fails closed: Pepper answers "Could not check your credits" and nothing is spent. Read back the ACLs afterwards: only `service_role` may execute the four functions, and students may only select their own rows.
2. **Stripe needs nothing new.** Packs use inline `price_data`. The live webhook already sends `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` and `charge.dispute.created` (read 2026-11-25).
3. **Unchanged:** the v2 daily RPCs stay in place so older Pepper previews keep working. Retire them in a later migration.
4. **First live pack purchase:** the owner does it, then checks the pack row and the /account balance.

## Decisions (approved 2026-11-25)

1. Weekly credits: 150 / 700 / 1,200 / 1,700 / 2,200 / 3,000, resetting Monday 00:00 UTC.
2. Costs: 10 credits a message, 20 with a photo, 0 for rule answers.
3. Packs: $4.99 for 1,000 credits and $12.99 for 3,000, and free accounts can buy them.
