# IB Economics catalog discovery receipt

**Captured:** 2026-09-11 17:26 EDT
**Baseline:** merged `84a24132` (`origin/main`)
**Scope:** production catalog surfaces only; no purchases, entitlement changes, taxonomy/storage/DB/price changes, or Cambridge changes.

## Finding

The 12-entry public question-index catalog is intentional. `scripts/generate-bank-index.mjs` and `src/lib/bank-index-manifest.ts` contain only the existing 12 public indexes. Economics metadata is intentionally private: `src/app/banks/[slug]/page.tsx` selects `/api/private-bank-index/{bank}` for activated Economics, and that endpoint returns `401 {"error":"Sign in required"}` without auth. The live 12 public index files all returned HTTP 200.

The actual activated catalog is 14 entries when both existing Economics release flags are enabled:

- `getBillingBanks()` / `getAvailableBanks()` append `ib-economics-hl` and `ib-economics-sl`.
- Anonymous live `GET https://pastpaperprep.com/pricing` returned HTTP 200 with 14 checkbox controls, including `custom-bank-ib-economics-hl` and `custom-bank-ib-economics-sl`, and no current-plan account block.
- The live pricing coverage table contained both Economics rows and preview links. Existing `src/components/ib-economics-billing-gate.test.tsx` covers the enabled/disabled picker and table behavior.
- The existing All Access production browser session showed 12 included cards and did not show Economics, despite the server-side entitlement catalog being able to include both Economics slugs.

## Root cause

`src/components/DashboardContent.tsx` rendered its groups from the hard-coded `BANKS` constant (the intentionally public 12-bank index), while `src/app/dashboard/page.tsx` calculated entitlements from `getAvailableBanks()`. Therefore the dashboard dropped Economics at the final UI surface even when the activated catalog and All Access entitlement reader recognized it.

## Narrow repair

- `DashboardContent` now accepts an optional `availableBanks` catalog, defaulting to `BANKS` so the existing 12-bank behavior remains unchanged.
- The dashboard page passes the same `getAvailableBanks()` catalog used for entitlement filtering.
- Added an explicit `IB Economics` group and HL/SL card labels/links.
- Empty groups are filtered, preserving the existing disabled/default 12-bank UI.
- No checkout, entitlement, prices, public indexes, assets, migrations, storage, taxonomy, or Cambridge code was changed.

## Verification

- RED: new All Access dashboard regression failed because `IB Economics` was absent.
- GREEN: `npx vitest run src/components/DashboardContent.test.tsx src/components/ib-economics-billing-gate.test.tsx src/app/banks/ib-economics-route-activation.test.ts` — **3 files, 10 tests passed**.
- Related suite: `npx vitest run src/components/DashboardContent.test.tsx src/components/PricingContent.test.tsx src/app/pricing/page.test.tsx` — **3 files, 25 tests passed**.
- `npm run lint` — **passed**.
- `npm run build` — **passed**; generated only the intentional 12 public index files and compiled the app successfully.
- `npm test` — **85 files/418 tests passed; 4 pre-existing unrelated failures**: taxonomy seal drift in AI HL/0606 deterministic-apply tests and missing sibling Biology/Physics source asset trees. All Economics tests passed.

Deployment has not been performed by this receipt. The app fix is ready for the authorized scoped merge/deploy, followed by a fresh entitled dashboard readback confirming both Economics cards without changing user entitlements.
