# Analytics events

PostHog receives two kinds of data.

- **Anonymous by default.** The browser client is cookieless, memory-only and creates no person profiles. Every event below is sent this way for every visitor.
- **Identified only with consent.** With analytics consent (v2, at most 180 days old), the same browser events are also sent as `consented_<name>`, linked to the visitor. Server conversion events are then linked to the account (`account:<id>`).

Without consent, server conversions are still counted, anonymously:
- `distinct_id` is `anon:<uuid>`
- there is no person profile
- `identified` is false

No email, name or account ID is ever sent without consent.

## Browser events (`trackProductEvent`)

| Event | Where | Properties |
|---|---|---|
| `$pageview` | every page | (path) |
| `question_filter_change` | bank page | `bank`, `filter` |
| `answer_reveal` | bank page | `bank`, `freePreview` |
| `pdf_builder_open` | Save PDF / Download PDF | `bank`, `questionCount` |
| `pdf_export_attempt` / `_success` / `_error` | Download PDF | `bank`, `questionCount`, `content` |
| `pdf_upgrade_view` | PDF prompt for people without access | `bank` |
| `upgrade_prompt_view` / `_click` / `_dismiss` | upgrade prompts | `bank`, `placement` |
| `free_gate_view` / `_elevated` / `_dismiss` / `_signup_click` / `_signin_click` | 20-question sign-up prompt | `bank`, `limit`, `remainingCount` |
| `pricing_view` | pricing page load | `product?`, `from?`, `interval`, `signedIn`, `hasPaidAccess`, `bankCount` |
| `billing_interval_change` | pricing | `interval` |
| `bank_selection_change` | pricing builder | selection size |
| `checkout_start` / `checkout_auth_required` / `checkout_redirect` / `checkout_error` | checkout buttons | `interval`, `productId` |
| `checkout_cancelled` | pricing with `?checkout=cancelled` (Stripe cancel) | none |
| `checkout_returned` | account with `?checkout=success` or `lifetime-pending` | `status` |
| `browser_error` | uncaught browser errors | sanitized |

`placement` is one of `top_note`, `feed_teaser`, `feed_timeline`, `locked_card`, `practice_milestone`, `signup_gate`, `pdf_dialog`. The same value travels to pricing as `?from=`, so `pricing_view.from` shows which prompt sent the visitor.

## Server events

| Event | Source | Properties |
|---|---|---|
| `conversion_outcome` | sign-up confirmation, Stripe `invoice.paid`, lifetime checkout | `outcome` (`signup_confirmed`, `payment_initial_paid`, `payment_renewal_paid`, `lifetime_paid`), `product?`, `interval?`, `identified` |
| `$exception` | unhandled server errors (`onRequestError`) | `route`, `router_kind`, `route_type`, `error_code` |
| `$exception` with `error_source: handled_response` | a key API route answered 5xx (`withFailureReporting`) | `route`, `error_code` (HTTP status), `reason` (the route's error message) |
| `$exception` with `error_source: auth_provider` | auth provider failures | `auth_phase`, `provider_code` |

`conversion_outcome` is deduplicated by source (invoice ID or Checkout Session ID), so Stripe retries count once.

## Funnels to create in PostHog

1. **Upgrade prompt to paid:** `upgrade_prompt_view` → `upgrade_prompt_click` → `pricing_view` → `checkout_start` → `conversion_outcome` (outcome is `payment_initial_paid` or `lifetime_paid`). Break down by `placement` and `bank`.
2. **Free account:** `free_gate_view` → `free_gate_signup_click` → `conversion_outcome` (outcome is `signup_confirmed`).
3. **Checkout drop-off:** `pricing_view` → `checkout_start` → `checkout_cancelled` / `checkout_returned`.
4. **Handled failures:** `$exception` where `error_source = handled_response`, broken down by `route` and `reason`. Alert on spikes for `/api/assets/sign` and `/api/billing/checkout`.

Because anonymous events have no person, funnels mixing browser and server events should use **unique sessions or totals**, not unique users, for people without consent.
