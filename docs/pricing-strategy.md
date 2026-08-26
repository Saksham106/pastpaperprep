# Bank-based pricing decision

Reviewed 2026-08-26.

## Decision

PastPaperPrep sells access by breadth, not by artificial feature restrictions:

| Plan | Monthly | Annual | Annual savings | Access |
| --- | ---: | ---: | ---: | --- |
| One bank | $5 | $48 ($4/month effective) | $12 (20%) | Any one of six banks |
| Subject pair | $8 | $72 ($6/month effective) | $24 (25%) | IGCSE Maths, IB AA, or IB AI pair |
| All banks | $12 | $96 ($8/month effective) | $48 (33.3%) | All current banks and additions during the subscription |

Free access remains a meaningful set of complete older exam years. Existing All-Access subscriptions remain on their current Stripe price unless the subscriber changes plans.

## Why this structure

- A student normally needs one course, so the entry plan stays near the familiar $5 monthly price while tying the purchase to the bank they actually need.
- Related pairs serve the real middle case without forcing six-bank access: IGCSE 0580 + 0606, IB AA SL + HL, or IB AI SL + HL.
- All-bank access is materially more valuable to tutors and broad-coverage users, so it should not be priced like a single student course.
- The paid ladder has three choices. Every paid plan includes the same tools; only access breadth changes. This avoids fake feature gating.
- Annual discounts increase with commitment breadth: 20% for one bank, 25% for a subject pair, and 33.3% for all banks. The pricing page displays clean whole-dollar monthly equivalents first and the annual charge directly below it, so the savings are clear without hiding the actual bill.
- The launch ladder uses clean whole-dollar monthly prices: $5, $8, and $12. Nine-ending prices can feel materially cheaper when they cross a left digit ($4.99 versus $5.00), but that same effect makes the ladder harder to scan. PastPaperPrep is choosing clarity and trust over a one-cent charm-price nudge, then testing the assumption with real conversion data.
- The middle plan is the default recommendation: it gives two related banks for less than buying two single-bank subscriptions, without making All Banks a fake decoy.

## Market evidence

First-party pages checked 2026-08-26:

- Revision Village lists Single Course Gold at $249 billed once and all-course Gold at $499 billed once. Its teacher page separately lists EducatorPro at $199/year, showing that individual-course, all-course, and educator value are materially different. Sources: https://www.revisionvillage.com/revision-village-gold and https://www.revisionvillage.com/teacher-pricing
- Exam-Mate's topical-past-paper pricing lists $12 for one month, $65 for six months, $120 for 12 months, and $220 for 24 months. Its exam-builder pricing is higher and separates parent and teacher offers. Sources: https://www.exam-mate.com/topicalpastpapers/pricing and https://www.exam-mate.com/exams/pricing
- Seneca advertises free IGCSE courses with optional premium packages. That supports retaining a useful free layer rather than relying on a token trial. Source: https://senecalearning.com/en-gb/igcse
- IB Math Revision separates individual access from school licensing and advertises school licences from €490/year. This is evidence for keeping true classroom/team features out of the current individual pricing ladder until PastPaperPrep actually ships them. Sources: https://ibmathrevision.com/index.html and https://ibmathrevision.com/subscribe-schools.html
- Kognity uses school-led pricing rather than a public low-cost student subscription, making it an institution comparator rather than a direct substitute. Source: https://www.kognity.com/pricing

These are positioning references, not conversion evidence for PastPaperPrep. The launch prices remain assumptions until view-to-checkout, checkout-to-paid, renewal, cancellation, and plan mix are measured.

Pricing-psychology references checked 2026-08-26:

- Thomas and Morwitz found that nine-ending prices are perceived as smaller mainly when the leftmost digit changes, such as $4.99 versus $5.00. DOI: https://doi.org/10.1086/429600
- Manning and Sprott found that left-digit effects can alter choice between options. DOI: https://doi.org/10.1086/597215

These studies justify testing $4.99 against $5.00; they do not prove that charm pricing will improve retention, trust, or revenue for this specific student product. Start with the clearer ladder and test rather than pretending the answer is universal.

## Measurement and decision gates

Track pricing views, selected product, billing interval, checkout starts, successful subscriptions, first question viewed, first answer reveal, first PDF export, renewal, and cancellation. Review after either 100 paid starts or eight weeks, whichever is later. Do not add more tiers before that review.
