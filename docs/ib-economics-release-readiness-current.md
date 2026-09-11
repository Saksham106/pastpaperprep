# IB Economics release-readiness consolidation — current

**Captured:** 2026-09-10
**Decision:** **LOCAL PREVIEW READY; PRODUCTION NOT READY**
**Publication/deployment:** not performed or authorized by this review.

This is a read-only consolidation of the current app checkout, the private Economics source checkout, the sealed source validators, and the actual normal-path browser/PDF evidence. It does not grant production approval.

## Repositories and existing state

- App: `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep`
  - branch `main`
  - HEAD `476e5d3f50bfa4f8cb636e4d5102e5ebc6f0eb7a`
  - already dirty: existing Economics integration plus other changes; `git diff --stat` reported 19 tracked files and 204 insertions/51 deletions, with additional untracked Economics docs/data/tests/routes.
- Read-only source: `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice`
  - branch `master`
  - HEAD `03c3fb0c1032fb0584547b8a03f3b25b8a3f8755`
  - already dirty: two tracked reviewer-result edits and a broad untracked release artifact tree.
- The existing status and diffs were inspected before this document was created. No existing source, app, test, data, migration, generated index, private evidence, external system, server, upload, deployment, or commit was changed.

## Evidence read back and verified

### Source-stage closure

The source repository's actual validators were executed with its pinned interpreter:

```text
.venv/bin/python -> Python 3.11.14
validate_final_classifications(final-classifications.json) -> []
validate_release_inputs(release-inputs.json) -> []
```

Current source seals, recomputed from the files:

| Artifact | SHA-256 | Scope/result |
|---|---|---|
| `data/classification/final-classifications.json` | `28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb` | 184 selected final tuples; `published: false` |
| `data/classification/release-inputs.json` | `0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39` | 1,637 release inputs; 132 raw PDFs, 475 question WebPs, 869 mark-scheme WebPs |
| `data/classification/release-taxonomy.json` | `75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c` | `economics-release-taxonomy-2026-09-09-human-capital-v1` |

The source artifacts report 111 HL questions/42 papers, 89 SL questions/32 papers, 200 expanded level rows, 184 unique canonical IDs, and 16 shared HL/SL IDs. The source-side question and mark-scheme image manifests still carry historical `pending_visual_review` status; the strict final/release validators pass, but that status is not evidence of full-corpus visual signoff.

The source manifest explicitly records `rights.status: unknown_publication_blocking` and keeps raw acquisition private. For this consolidation, source copyright is treated as **user-attested for the stated corpus and therefore not an engineering release blocker**, per the requested decision boundary. This is not independent legal verification or fabricated rights approval; the existing historical status remains visible in the source artifacts.

### App runtime data

The copied app runtime files were compared byte-for-byte by hash with the source site outputs:

- `src/data/local-preview/ib-economics-hl.json`: 111 rows/42 papers, SHA-256 `bf18f568dcd896679b19bb95ae2ea79a02cca54b54787cd35bbc3e356781da93`.
- `src/data/local-preview/ib-economics-sl.json`: 89 rows/32 papers, SHA-256 `266d49669674396fad35812225d1306eda76f4faeafb886a102a1f23d5a32e47`.
- `src/data/ib-economics-taxonomy.json`: SHA-256 `75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c`.

The mounted source asset tree contains 475 question WebPs and 869 official-mark-scheme WebPs (1,344 unique derived files). The local runtime references 557 question images and 1,047 mark-scheme images across its 200 expanded rows. No source PDF is served by the local asset route; raw PDFs remain in the private source checkout under `data/raw/`.

### Actual normal-path browser/PDF evidence

The authoritative private machine-readable evidence was read from:

`/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/ib-economics-normalpath-browser-qa.json`

It records a clean normal-path run (`normalPath: true`, `fetchShim: false`, `cacheOverride: false`, `monkeypatch: false`) using fresh browser task pages, with no 500 responses or runtime errors in:

`/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/next-server-normalpath.log`

Recorded browser scope and read-back values:

| Check | HL | SL |
|---|---:|---:|
| Hydrated catalog | 111 | 89 |
| Microeconomics membership | 59 | 44 |
| Global economy membership | 60 | 48 |
| 2025 filter | 29 | 25 |
| Question image | `complete=true`, `1191x182` | `complete=true`, `1191x156` |
| Official answer pages | 3 decoded pages: `1191x1455`, `1191x1525`, `1191x1525` | same dimensions |

The same first-question flow produced browser-triggered PDFs, read back and verified with PyMuPDF:

- `/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/ib-economics-hl-normalpath-browser.pdf` — 1,062,642 bytes, 4 pages, 5 image objects on every page, SHA-256 `dbd5dfb0aed09b233738c61873ee5e6668d94c5944df9c754618c96afa4d938e`.
- `/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/ib-economics-sl-normalpath-browser.pdf` — 1,075,083 bytes, 4 pages, 5 image objects on every page, SHA-256 `bbb4325260de094251299c9a4cb19829a78ed717f97d69579ff8fe59ee9ce019`.

The PDFs are 1 question page plus 3 official-answer pages for the tested question. This is the requested normal-path scope, not a claim that every question was browser-rendered.

### Fresh app checks run during this consolidation

```text
11 focused Vitest files passed; 54 tests passed
npm run lint -> exit 0
npx tsc --noEmit -> exit 0
```

The focused tests covered local-bank counts/scope, access and entitlement denial, asset namespace validation, local path containment and traversal, signed assets, PDF selection/limits/quota calls, and local route behavior. No full app test, server, build, upload, deployment, or external mutation was run.

## Current local-preview implementation

Observed in the current app source:

- `src/lib/banks.ts` exposes the two Economics slugs only through `getAvailableBanks()` when both `NODE_ENV === "development"` and `PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW === "true"`.
- `BANKS` remains exactly the 12 production banks. `src/lib/bank-index-manifest.ts` contains no Economics entry.
- `src/lib/question-loader.ts` loads the two runtime JSON files only as local-preview data. `src/lib/questions.ts` maps their WebP references to `/api/local-preview-assets/...`, not production storage keys.
- `src/lib/local-preview.ts` canonicalizes the mounted source root, Economics asset root, and candidate with `realpath` before the reader is called; outside-target symlinks and traversal are rejected.
- The local index, asset, signing, and PDF routes all require the explicit development gate. Their responses are private/no-store. The local signing/PDF route intentionally does not consult entitlements because it is a development-only mounted-source preview.
- `src/lib/access.ts` explicitly returns false for Economics in `hasBankAccess`, including `bundle_all`; Economics is absent from the paid `ProductId` and bundle mappings.

Therefore the current local status is **PASS for the documented development-only preview**, and **not a production entitlement or publication path**.

## Explicit production blockers

1. **Production storage asset namespaces and authoritative-object verification are absent.**
   - `src/lib/assets.ts` and `storageObjectPath()` accept `ProductionBankSlug`, which deliberately excludes both Economics slugs.
   - The current local runtime paths resolve to a workstation-mounted source route. They are not R2/Supabase object keys and cannot be used as production asset delivery.
   - No Economics upload manifest, private bucket namespace, exact object read-back/hash verification, or provider split exists. The 1,344 local files and the two browser PDFs prove local source delivery only.

2. **Economics is not in the production runtime catalog/index.**
   - `BANKS`, `PUBLIC_BANK_INDEX_FILES`, the index generator's bank list, and production `generateStaticParams()` exclude Economics.
   - Production-mode `getAvailableBanks()` remains 12 banks and `getBank("ib-economics-hl"/"ib-economics-sl")` is undefined.
   - The local 111/89 runtime artifacts are not a production catalog approval; they need a production-owned catalog representation, generated public metadata index, stable content hash, and production-mode route/index tests.

3. **Paid entitlement and PDF quota integration is not provisioned for Economics.**
   - `ProductId`, `BANK_PRODUCTS`, `BANK_BUNDLES`, entitlement normalization, and the SQL product/Stripe allowlists contain no Economics product IDs.
   - Production `/api/pdf/sign` requires a paid bank entitlement and calls `consume_download_allowance`; the local Economics PDF route intentionally bypasses that boundary only because it is development-gated.
   - The quota machinery exists for current production banks (`MAX_PDF_QUESTIONS = 50`, daily limits of 3 PDFs/75 questions/1,000 signed assets), but there is no Economics product, migration/read-back, price-catalog tuple, webhook entitlement path, or entitled Economics PDF test.

4. **Full-corpus visual/release closure is not evidenced.**
   - The actual browser artifact covers a clean HL and SL normal path, filter counts, one question image, three official-answer pages, and one four-page browser PDF per level.
   - It does not establish browser rendering, answer decoding, filtering, and PDF download for all 111/89 questions. The source image manifests' `pending_visual_review` status remains a documented historical gap even though the sealed final/release validators return empty errors.

**Not a blocker in this decision:** source copyright is treated as user-attested for this named corpus. No independent rights determination is claimed, and the source's historical `unknown_publication_blocking` field is preserved rather than rewritten.

## Smallest production implementation path

Do not flip the local flag or add the slugs to `BANKS` as a shortcut. The smallest coherent path is:

1. Freeze the current source/runtime tuple and user-attested rights scope; retain the exact source, taxonomy, release-input, and runtime hashes above.
2. Add a dedicated production object-key mapping for Economics, with explicit per-bank namespace prefixes (for example, separate `ib-economics-hl/` and `ib-economics-sl/` prefixes). Derive the upload manifest from normalized runtime records, include all referenced question and official-answer WebPs, reject raw PDFs, and verify exact remote hashes/bytes and signed reads before metadata deployment.
3. Promote the runtime data through the production catalog path: add production-owned HL/SL data inputs, generate the two public metadata indexes with protected fields excluded, update the generated manifest/catalog and static parameters, and preserve the current production catalog/index hashes for the unchanged 12 banks.
4. Add explicit Economics product IDs to the application access maps and to the Supabase/Stripe product, custom-bundle, price-catalog, and webhook allowlists. Apply migrations in order and read back the resulting rows/functions; do not infer or hardcode price IDs.
5. Keep `/api/pdf/sign` server-authoritative: authenticated user, current Economics entitlement, canonical question IDs, private signed assets, then atomic `consume_download_allowance`. Add tests for logged-out denial, wrong-bank denial, valid entitled export, expired/revoked entitlement, 50-question cap, daily quota exhaustion, and signing failure without quota consumption.
6. Run a fresh production-aware release gate: source validators, deterministic runtime/index rebuild, asset verification, logged-out/entitled browser checks, mixed-provider PDF, quota/revocation checks, and rollback/previous-authority checks. Only after those gates should a separately authorized production review decide whether to publish.

Until steps 2–6 are complete, the correct disposition is **local preview only; production blocked**. No approval, upload, deployment, or publication was fabricated by this document.
