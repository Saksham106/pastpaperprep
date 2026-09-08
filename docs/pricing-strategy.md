# Custom-bank pricing decision

Reviewed 2026-09-08.

## Decision

PastPaperPrep sells access by exact question-bank breadth. The pricing page has three choices and no cart:

| Plan | Monthly | Annual display | Annual charge | Access |
| --- | ---: | ---: | ---: | --- |
| One Bank | $6/month | $4/month | $48/year | Exactly one selected current bank |
| Build Your Plan (Most Popular) | $6/month for the first bank, then +$4/month per additional bank through five | $4/month for the first bank, then +$3/month per additional bank through five | $48/year for the first bank, then +$36/year per additional bank through five | Exactly the selected one-to-five current banks |
| All Access | $25/month | $18/month | $216/year | Every current bank and additions during the subscription |

A selection of six or more banks automatically resolves to All Access. The server, not the browser, derives the Stripe price and quantity. Custom bundles use the dedicated `bundle_custom` product semantics and persist the exact canonical bank IDs selected by the customer.

Existing fixed single-bank, subject-pair, founding, and All-Access subscriptions remain valid and grandfathered. They continue to use their existing internal product IDs and allowlisted Stripe prices. New custom purchases never overwrite those meanings.

Free access remains a meaningful set of complete older exam years.

## Product rules

- The canonical bank IDs are the slugs in `src/lib/banks.ts`.
- A custom bundle must contain one through five distinct known IDs.
- Unknown IDs, duplicates, empty selections, malformed metadata, and quantities that do not equal the selected-bank count fail closed.
- Six or more distinct known selections become `bundle_all` with quantity one.
- Checkout accepts only a product and interval; price IDs, quantity, and custom metadata are reconstructed server-side.
- Stripe webhook handling verifies the subscription metadata, selected-bank set, quantity, interval-specific price, and subscription item before persistence.
- Entitlement access is limited to the stored custom selected-bank set; it is never inferred from quantity alone.

## Why this structure

- One Bank gives a clear entry point for students who need one course.
- Build Your Plan charges for the exact breadth a student needs while rewarding multi-bank study without a cart or hidden feature gates.
- All Access is the simple choice for broad-coverage users, tutors, and students selecting six or more banks.
- Every paid plan includes the same study tools; only access breadth changes.
- Annual prices are shown as effective monthly amounts with the exact yearly charge directly below them.
- The middle plan is the default recommendation because it handles the common multi-bank case without making All Access a decoy.

## Measurement and decision gates

Track pricing views, selected bank IDs, billing interval, checkout starts, successful subscriptions, first question viewed, first answer reveal, first PDF export, renewal, cancellation, and plan mix. Review after either 100 paid starts or eight weeks, whichever is later. Do not add more tiers before that review.

Market research in the remainder of this document is positioning context, not conversion evidence for PastPaperPrep. Prices remain assumptions until first-party behavior is measured.

## Market evidence

- Revision Village lists Single Course Gold at $249 billed once and all-course Gold at $499 billed once. Sources: https://www.revisionvillage.com/revision-village-gold and https://www.revisionvillage.com/teacher-pricing
- Exam-Mate lists topical past-paper access at $12 for one month, $65 for six months, $120 for 12 months, and $220 for 24 months. Sources: https://www.exam-mate.com/topicalpastpapers/pricing and https://www.exam-mate.com/exams/pricing
- Seneca advertises free IGCSE courses with optional premium packages. Source: https://senecalearning.com/en-gb/igcse
- IB Math Revision separates individual access from school licensing. Sources: https://ibmathrevision.com/index.html and https://ibmathrevision.com/subscribe-schools.html
- Kognity uses school-led pricing and is an institution comparator rather than a direct substitute. Source: https://www.kognity.com/pricing
