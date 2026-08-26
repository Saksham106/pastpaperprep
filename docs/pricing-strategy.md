# Bank-based pricing decision

Reviewed 2026-08-26.

## Decision

PastPaperPrep sells access by breadth, not by artificial feature restrictions:

| Plan | Monthly | Annual | Annual savings | Access |
| --- | ---: | ---: | ---: | --- |
| One bank | $2.99 | $29.99 | $5.89 (16.4%) | Any one of six banks |
| Subject pair | $4.99 | $49.99 | $9.89 (16.5%) | IGCSE Maths, IB AA, or IB AI pair |
| All banks | $8.99 | $89.99 | $17.89 (16.6%) | All current banks and additions during the subscription |

Free access remains a meaningful set of complete older exam years. Existing All-Access subscriptions remain on their current Stripe price unless the subscriber changes plans.

## Why this structure

- A student normally needs one course, so the entry paid plan should be cheaper than the old all-bank offer.
- Related pairs serve the real middle case without forcing six-bank access: IGCSE 0580 + 0606, IB AA SL + HL, or IB AI SL + HL.
- All-bank access is materially more valuable to tutors and broad-coverage users, so it should not be priced like a single student course.
- The paid ladder has three choices. Every paid plan includes the same tools; only access breadth changes. This avoids fake feature gating.
- Annual discounts are consistent at roughly 16.5%, close to the 12-month discount visible in comparable products rather than the old 33.2% discount.

## Market evidence

First-party pages checked 2026-08-26:

- Revision Village lists Single Course Gold at $249 billed once and all-course Gold at $499 billed once. Its teacher page separately lists EducatorPro at $199/year, showing that individual-course, all-course, and educator value are materially different. Sources: https://www.revisionvillage.com/revision-village-gold and https://www.revisionvillage.com/teacher-pricing
- Exam-Mate's topical-past-paper pricing lists $12 for one month, $65 for six months, $120 for 12 months, and $220 for 24 months. Its exam-builder pricing is higher and separates parent and teacher offers. Sources: https://www.exam-mate.com/topicalpastpapers/pricing and https://www.exam-mate.com/exams/pricing
- Seneca advertises free IGCSE courses with optional premium packages. That supports retaining a useful free layer rather than relying on a token trial. Source: https://senecalearning.com/en-gb/igcse
- IB Math Revision separates individual access from school licensing and advertises school licences from €490/year. This is evidence for keeping true classroom/team features out of the current individual pricing ladder until PastPaperPrep actually ships them. Sources: https://ibmathrevision.com/index.html and https://ibmathrevision.com/subscribe-schools.html
- Kognity uses school-led pricing rather than a public low-cost student subscription, making it an institution comparator rather than a direct substitute. Source: https://www.kognity.com/pricing

These are positioning references, not conversion evidence for PastPaperPrep. The launch prices remain assumptions until view-to-checkout, checkout-to-paid, renewal, cancellation, and plan mix are measured.

## Measurement and decision gates

Track pricing views, selected product, billing interval, checkout starts, successful subscriptions, first question viewed, first answer reveal, first PDF export, renewal, and cancellation. Review after either 100 paid starts or eight weeks, whichever is later. Do not add more tiers before that review.
