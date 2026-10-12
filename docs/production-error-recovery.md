# Production error recovery

## Purpose and scope

This change fixes the Economics asset-provider mapping, gives account/dashboard pages a neutral recovery state after a narrowly identified provider failure, and makes server errors diagnosable without collecting credentials or personal data. It is not a provider-service upgrade, a change to billing authorization, or permission to merge/deploy.

## Economics image signing

IB Economics HL and SL were absent from the R2 provider mapping. Their verified release receipt (`docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt.json`) places the two namespaces in R2. Free previews must use that provider too, rather than assuming a retained Supabase copy.

The pre-change live diagnostic sampled one free question per canonical bank: 17 signer responses succeeded and both Economics responses failed. Further real-question/answer failures plus nonexistent-ID 404 controls isolated Economics signing, not manifest loading. This is bounded signer evidence, not a corpus-wide render audit or attribution of every historical 503.

The provider map pins both Economics preview and premium delivery to R2. Existing paid checks, download allowance, free-year selection, URL lifetimes, and caching are retained. The PDF Economics regression uses an R2 presigner mock because its old Supabase fixture encoded the wrong store.

## Future-issued JWT errors

Production evidence: the dashboard render logged `PGRST303: JWT issued at future`, and the corresponding Supabase entitlement lookup returned HTTP 401. A streamed Next.js render can still have HTTP 200, so status-only error searches are insufficient.

The affected Supabase project's Settings → General → Service versions showed PostgREST **14.5** during this investigation. Upstream released explicit fixes:

- [PostgREST 14.17](https://github.com/PostgREST/postgrest/releases/tag/v14.17): JWT validation uses wrong current time due to an auto-update bug (#5159).
- [PostgREST 14.18](https://github.com/PostgREST/postgrest/releases/tag/v14.18): sporadic PGRST303 future-issued JWT errors (#5196).
- [PostgREST 16.3](https://github.com/PostgREST/postgrest/releases/tag/v16.3): the same sporadic-error fix.

Version age supports an upstream-clock-bug explanation; it does not prove the precise clock skew of the observed request. Application recovery is a mitigation, not evidence the provider defect is repaired.

Only exact future-issued-JWT failures from idempotent, user-scoped entitlement reads qualify for bounded recovery. Mixed errors, other authorization failures, and malformed results remain failures. Never replace failed access verification with empty/anonymous access, retry mutations, refresh tokens in a loop, loosen RLS/JWT checks, or show checkout as a recovery action.

## Provider remediation: separate operator decision

1. Request a targeted managed PostgREST rollout from Supabase for the affected project. Include the observed 14.5 version, UTC failure window, route, and redacted PGRST303 error. Ask for 14.18 or a newer fixed release (or a fixed supported 16.x release).
2. Do not restart or upgrade the whole project just to test the hypothesis. A project upgrade changes more than PostgREST and can interrupt production; obtain a maintenance decision, compatibility/backup review, and downtime approval first.
3. After provider maintenance, read the installed service version back and inspect fresh authenticated access logs. A successful reload alone does not prove the intermittent upstream fault is gone.

No support request, restart, upgrade, billing mutation, storage migration, or production deployment is part of this PR.

## Telemetry verification and release hold

Keep server and browser evidence distinct. Server reporting must not imply a random exception identity is a real user. Use bounded allowlisted context for route, bank, provider, failure stage/code, environment, and opaque occurrence correlation. Do not report raw exception messages, arbitrary request paths/query strings, cookies, JWTs, emails, or signed asset URLs. Source maps remain private.

Before merge, review the isolated PR and its focused/full differential tests, lint, typecheck, production build, and privacy checks. This PR overlaps open changes to the asset routes in #213 and signed URL lifetime changes in #212; resolve those against the latest main and rerun the same owning tests if either lands first.

After an explicitly approved merge and exact-deployment verification:

- Fetch Economics HL/SL free-year question and answer signer responses and then GET the actual image bytes; require successful WebP responses and verify no session is required for free content.
- Verify paid-year anonymous denial and retain entitlement/allowance enforcement; use only an approved entitled test identity for mutation-backed quota checks.
- Verify signed-in account/dashboard normal content and exact provider-failure recovery, with no paid/unpaid claim in the recovery state.
- Confirm PostHog and Vercel receive matching privacy-safe diagnostic fields; do not resolve old issues on code review alone.

Vercel previews intentionally lack production-only storage credentials. A preview shell and mock-backed tests do not verify live storage delivery. Do not broaden secret environment scope merely to make preview signing pass.
