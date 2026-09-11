# IB Economics production candidate — local only

Status: **local candidate generated; production disabled**.

This integration keeps the existing 12-bank production catalog and public index bytes unchanged. Economics is exposed only when both flags are explicit:

```text
PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION=true
PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED=true
```

The existing development-only mounted-source preview remains separate and still requires `NODE_ENV=development` plus `PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW=true`.

## Local artifacts

- `src/data/production/ib-economics-hl.json` — 111 questions / 42 papers.
- `src/data/production/ib-economics-sl.json` — 89 questions / 32 papers.
- `src/data/private-index/ib-economics-hl.json` and `ib-economics-sl.json` — derived candidate indexes, not public static files.
- `src/data/ib-economics-runtime-manifest.json` — source, classification, taxonomy, runtime, and derived-manifest seals.
- `docs/ib-economics-asset-manifests/ib-economics-hl-upload-manifest.json` and `ib-economics-sl-upload-manifest.json` — referenced WebP objects only; `upload: false`, no raw PDFs.
- `supabase/migrations/20260911010000_add_ib_economics_candidate.sql` — inactive product/bank allowlists only; no Stripe price IDs.

The derived manifests use exact bank namespaces (`ib-economics-hl/...` and `ib-economics-sl/...`) and preserve shared HL/SL source identity without cross-bank key collisions.

## Verified locally

- Source final-classification, release-input, taxonomy, runtime, and image hashes are anchored.
- All 200 expanded HL/SL runtime rows materialize with canonical IDs, HTTPS question/mark-scheme provenance, and approved classification evidence.
- Public/private index tests reject rich text, provenance, source URLs, and asset paths from metadata responses.
- Locked, entitled, quota-exhausted, signing-failure, and 50-question PDF paths remain server-authoritative and fail closed.
- Existing public bank-index hashes are asserted unchanged.
- Existing local-preview route, traversal, symlink, entitlement-denial, and PDF behavior remains covered.

## Remaining external release gates

1. Independent source/content review and rights/publication decision; the source's historical rights status remains `unknown_publication_blocking`.
2. Authoritative private object-storage provisioning for both namespaces, upload/read-back/hash verification, signed browser reads, and rollback authority. Nothing was uploaded.
3. External billing/product setup: product activation, real Stripe price catalog tuples, webhook allowlists, entitlement read-back, and quota/RPC verification. No Stripe IDs were invented and no billing/DB operation was run.
4. Full-corpus browser/PDF delivery QA and independent release review, including locked/entitled/revoked paths and mixed-provider exports.
5. Explicit release authorization before enabling the two flags, applying the migration, deploying, or publishing.
