# Tracking Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make purchases, the pricing funnel and handled server failures visible in PostHog, anonymously when there's no consent.

**Architecture:**
- Extend `captureConversionOutcome` with an anonymous fallback and a `lifetime_paid` outcome.
- Add a `withFailureReporting` route wrapper on top of `captureServerException`.
- Add small client trackers on pricing and account.
- Thread `from` through upgrade links.

**Tech Stack:** Next.js 16 route handlers, posthog-node, posthog-js via `trackProductEvent`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-tracking-gaps-design.md`

## Global Constraints

- **No identity without consent.** Anonymous events use `distinct_id: anon:<event-uuid>` and `$process_person_profile: false`.
- **Analytics never changes an outcome:** no throws, response bodies unchanged, and no extra latency beyond the existing 1.5s capture bound.
- **Only allowlisted property keys reach `captureServerException`.** Add `reason` to `SAFE_PROPERTY_KEYS`. `reason` must match `/^[\x20-\x7E’]{1,80}$/`.
- **`from` values come from `UpgradePlacement`.** Anything else is dropped.

## Review Focus

1. **The consented path is byte-for-byte unchanged:** same distinct_id, same `$process_person_profile: true`.
2. **The webhook never fails or returns a different status** because of analytics, including the new lifetime capture.
3. **`withFailureReporting` with a streaming or non-JSON 5xx body:** it must not throw, and must not consume the body sent to the client (clone first).
4. **Route handlers that take a `context` param** (worksheets/[id]) still receive it.
5. **`?from=` with an injection-like value** is dropped, not echoed.

---

### Task 1: Anonymous conversion counts and lifetime purchases
**Files:** `src/lib/server-conversion-analytics.ts` (+test) and `src/app/api/stripe/webhook/route.ts` (+test).
- [ ] **Tests:** update the "does not capture X consent" and "fails closed" cases. They now expect exactly one fetch whose body has `distinct_id` starting `anon:`, `properties.$process_person_profile === false` and `properties.identified === false`, and no `account:` anywhere in the body. Add: `lifetime_paid` with product `lifetime_all_access` keeps the product. The consented case asserts `identified: true`.
- [ ] **Implement:**
  - Compute `consented` from the existing checks instead of returning early.
  - Build `distinct_id = consented ? stableAnalyticsDistinctId(userId) : "anon:" + eventUuid("anon:" + eventKey)`, set `$process_person_profile: consented` and `identified: consented`.
  - Add `"lifetime_paid"` to the outcome union and `"lifetime_all_access"` to PRODUCTS.
  - Webhook: after successful `fulfill_lifetime_purchase` (before the conversion finish), call `await captureConversionOutcome({ outcome: "lifetime_paid", eventKey: \`stripe:checkout:${session.id}\`, userId, occurredAt: new Date((session.created || event.created) * 1000).toISOString(), product: LIFETIME_OFFER.productId, interval: null })`.
  - Webhook test: mock capture and assert it is called once for a verified lifetime payment. If the existing webhook tests make this impractical, record a Ruling and cover it with a focused unit test.
- [ ] Commit: `feat(analytics): anonymous conversion counts and lifetime purchases`.

### Task 2: Report handled server failures
**Files:** create `src/lib/route-failure-reporting.ts` (+test); modify `src/lib/server-error-tracking.ts` (SAFE keys) and the 11 route files listed in the spec.

```ts
export function withFailureReporting<Args extends unknown[]>(route: string, handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    const response = await handler(...args);
    if (response.status >= 500) void reportHandledFailure(route, response);
    return response;
  };
}
```

- `reportHandledFailure` clones the response, reads the JSON `error` (try/catch), validates `reason`, and calls `captureServerException(new Error("Handled server failure"), { error_source: "handled_response", route, error_code: String(status), reason })`.
- It runs fully inside try/catch. Unhandled throws propagate untouched; `onRequestError` already reports those.
- [ ] **Tests:**
  - A 503 JSON response is reported with route, code and reason.
  - 200 and 400 are not reported.
  - A non-JSON 500 is reported without a reason.
  - A long or odd reason is dropped.
  - The returned response body is still readable and equal.
  - A thrown handler rejects and isn't reported.
  - Context args pass through.
- [ ] Wrap each route: rename `export async function POST(` to `async function handlePOST(` and add `export const POST = withFailureReporting("/api/…", handlePOST);`. Run the existing route tests unchanged.
- [ ] Commit: `feat(telemetry): report handled 5xx responses from key API routes`.

### Task 3: Pricing and checkout funnel events; `from` on upgrade links
**Files:**
- `src/lib/upgrade-copy.ts` (`upgradeHref(bank, placement?)`, `isUpgradePlacement`)
- `src/components/QuestionExplorer.tsx` and `src/components/FreeQuestionSignupGate.tsx` (pass placements)
- `src/app/pricing/page.tsx` (parse `from`, `checkout`)
- `src/components/PricingContent.tsx` (`pricing_view`, `checkout_cancelled`)
- new `src/components/CheckoutReturnTracker.tsx`, used in `src/app/account/page.tsx`
- tests

- [ ] **Tests:**
  - `upgradeHref("igcse", "feed_teaser")` is `/pricing?product=bank_igcse&from=feed_teaser`.
  - Explorer upgrade links include `from` per placement.
  - PricingContent sends `pricing_view` once with `{ product: "bank_igcse", from: "top_note", interval: "monthly", signedIn, hasPaidAccess, bankCount }`.
  - `checkout_cancelled` is sent when `checkoutStatus="cancelled"`.
  - Account `CheckoutReturnTracker` sends `checkout_returned` with `{ status: "success" }`.
  - The page drops unknown `from`.
- [ ] **Implement** as specified. Each tracker uses a `useEffect` with a ref guard, so it sends once.
- [ ] Commit: `feat(analytics): pricing view, checkout cancel/return, and upgrade placement attribution`.

### Task 4: Events doc and verification
- [ ] Write `docs/analytics-events.md`. Cover every `trackProductEvent` name and its properties, the server events (`conversion_outcome`, `$exception` sources), consent behaviour, and the funnels to create in PostHog:
  1. upgrade_prompt_view → upgrade_prompt_click → pricing_view → checkout_start → conversion_outcome (payment_initial_paid/lifetime_paid)
  2. free_gate_view → free_gate_signup_click → conversion_outcome(signup_confirmed)
  3. pricing_view → checkout_cancelled
- [ ] Run `npm run lint && npm run typecheck && npm test && npm run build`.
- [ ] Commit: `docs: analytics events and funnels`.
