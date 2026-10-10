# Tracking gaps

Date: 2026-10-09
Status: approved in conversation ("set up the stuff that's missing… do anon counts for people who haven't consented")

## Goal

Make the paid funnel and silent failures visible in PostHog. Nothing that identifies a person is sent without analytics consent.

## Decisions

- **Server conversions** (`conversion_outcome`):
  - If the account has current consent (v2, at most 180 days old), the event is sent as today, linked to the account.
  - Otherwise, including when the account lookup fails, it is sent as an **anonymous count**:
    - `distinct_id` is `anon:<uuid derived from the event key>`.
    - `$process_person_profile` is false.
    - `identified` is false.
    - It carries no account ID, email or IP-based person.
  - Event deduplication (`uuid`, `$insert_id`) is unchanged.
- **Lifetime purchases** send `conversion_outcome` with outcome `lifetime_paid` and product `lifetime_all_access`, keyed by the Checkout Session ID. This happens after successful fulfilment in the Stripe webhook.
- **Client funnel events** use `trackProductEvent`, whose baseline client is already cookieless and anonymous:
  - `pricing_view` with `{ product?, bankCount, interval, from?, signedIn, hasPaidAccess }`, sent once per pricing page load. `from` is an upgrade placement passed as `?from=`, accepted only from the known placement list.
  - `checkout_cancelled` when pricing loads with `?checkout=cancelled`.
  - `checkout_returned` with `{ status: "success" | "lifetime-pending" }` when the account page loads with that `?checkout=`.
- **Upgrade links carry their placement:** `upgradeHref(bank, placement)` gives `/pricing?product=<id>&from=<placement>`.
- **Handled server failures:**
  - Key API routes are wrapped with `withFailureReporting(route, handler)`. A 5xx response sends `captureServerException` with `error_source: "handled_response"`, `route`, `error_code` (the status) and `reason` (the response's `error` string, only if it is at most 80 characters of plain text).
  - 4xx responses aren't reported.
  - The wrapper never changes the response, and never throws.
  - Routes covered: assets/sign, pdf/sign, worksheets, worksheets/[id], billing/checkout, billing/lifetime/checkout, billing/subscription, billing/portal, study-state, banks/bootstrap and stripe/webhook.
- **Docs:** `docs/analytics-events.md` lists every product event, its properties and consent behaviour, plus the PostHog funnels to create (upgrade prompt → pricing_view → checkout_start → conversion_outcome).

## Out of scope

PostHog dashboard creation (done by the owner from the doc), changes to cookie or consent UI, and email or attribution beyond `from`.

## Testing

- Conversion analytics:
  - The consented path is unchanged.
  - Each non-consented case (unknown, legacy, rejected, expired, future, malformed, lookup failure) now sends one anonymous event, with no `account:` ID and `$process_person_profile` false.
  - `lifetime_paid` is accepted with its product.
- Webhook: a verified lifetime fulfilment calls the capture with `lifetime_paid`.
- `withFailureReporting`:
  - A 503 with `{ error }` reports route, code and reason.
  - A 400 and a 200 don't.
  - A handler that throws still throws, and isn't double-reported.
  - A reason over 80 characters, or with control characters, is dropped.
  - The response body is unchanged.
- Pricing: `pricing_view` is sent once with product and `from`; `checkout_cancelled` on `?checkout=cancelled`; an unknown `from` is dropped.
- Account: `checkout_returned` on success.
- Upgrade links include `&from=<placement>`.
