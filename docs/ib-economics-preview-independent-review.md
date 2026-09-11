# IB Economics local-preview independent review

## Verdict

**FAIL-CLOSED: FAIL. Disposition: LOCAL-ONLY, non-production.**

The sealed Economics data and current local preview work in the existing development server, but this review cannot return a fail-closed PASS because the implementation has two security-control gaps:

1. The feature gate is not explicitly development-only: with the flag set, `NODE_ENV` values `""`, `"staging"`, and `"test"` all enable it (`src/lib/banks.ts:225-227`). Only `"production"` is denied. An unset or nonstandard deployment environment therefore opens the unauthenticated local preview routes.
2. The asset route reads the resolved candidate before checking its canonical `realpath` (`src/app/api/local-preview-assets/[...path]/route.ts:17-21`). A symlink to a file outside the mounted Economics asset tree returns 404, but the outside file has already been read. Containment must be established before any read.

No production enablement, upload, deploy, merge, push, or rights approval is granted. The source remains `unknown_publication_blocking` and the app disposition is local preview only.

## Scope and non-modification boundary

- App: `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep`.
- Review output owned by this review: this file only.
- Source/data/code was read-only. No implementation, test, generated index, source repository, commit, upload, or deployment was changed.
- The existing preview server was reused: Next PID `98199`, listener `127.0.0.1:3100`. No second server or build was started.
- The app checkout was already dirty with the Economics integration and unrelated existing changes; those changes were inspected, not attributed to this review.

## Verification performed

### Source seals and runtime closure

The source repository validators returned empty error lists:

- `validate_final_classifications`: `[]`.
- `validate_release_inputs`: `[]`.
- Current source hashes:
  - `final-classifications.json`: `28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb`.
  - `release-inputs.json`: `0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39`.
  - `release-taxonomy.json`: `75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c`.

The copied runtime hashes match the documented seals:

- HL: `bf18f568dcd896679b19bb95ae2ea79a02cca54b54787cd35bbc3e356781da93`, exactly **111** rows.
- SL: `266d49669674396fad35812225d1306eda76f4faeafb886a102a1f23d5a32e47`, exactly **89** rows.
- Runtime taxonomy: `75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c`.
- HL/SL membership intersection: exactly **16 shared question IDs**; HL-only `95`, SL-only `73`, combined unique canonical IDs `184`.
- Runtime rows have unique IDs within each level and nonempty question/official-mark-scheme image arrays and HTTPS source URLs.
- Source asset inventory is **475 question WebPs + 869 official-mark-scheme WebPs = 1,344** derived images.

Parent-reported source-stage `197` tests and app-worker `387` tests had passed before this review. Per the resume instruction, this review used targeted checks rather than starting another full run.

### Targeted app tests

Fresh targeted Vitest run:

```text
5 test files passed
28 tests passed
```

It covered the local bank registry, exact counts, shared rows, taxonomy/filter behavior, protected index metadata, entitlement denial, local route denial, signing, PDF selection, mounted image delivery, and traversal rejection.

### Production exclusions and unchanged commercial surface

- `BANKS` remains exactly **12** production banks; Economics is absent from it.
- Under `NODE_ENV=production` with the Economics flag forced true: `getAvailableBanks()` returned `12`, `getBank("ib-economics-hl")` was undefined, and `generateStaticParams()` returned `12` entries with no Economics slug.
- The Economics slugs are absent from the public index manifest and the `ProductId`/paid-product mappings. `hasBankAccess("ib-economics-hl", bundle_all)` and the SL equivalent both return false.
- All **12** current public index files exist under the unchanged `PUBLIC_BANK_INDEX_FILES` manifest and each file’s SHA-256 begins with the hash embedded in its manifest filename. The manifest itself is byte-identical to `HEAD`.
- A byte comparison of **41** tracked billing/Stripe/entitlement/custom-bundle/Supabase-migration files found no changes except the intentional `src/lib/access.ts` local-bank exclusion. No billing file or migration changed.
- The two historical taxonomy audit snapshots changed only their `sourceSha256` fields, from the old hash `4f4eaa...` to the current `src/lib/taxonomy.ts` hash `ccd21c6f002194ec93278d11483f1770cb34d8fab88adf3a63ddd2e41719261d`. The current taxonomy diff adds only Economics imports/order/subtopic branches; no existing AI-HL or 0606 snapshot topic content changed. These one-line provenance refreshes are justified by the shared source file change.

### Gate, auth, path containment, and HTTP checks

- Production gate check passed: `NODE_ENV=production` denies the preview even when the flag is `true`.
- HTTP requests carrying spoofed `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers did not influence the gate. On the existing development server, valid local index requests returned 200 as expected; a production bank index, traversal path, and raw PDF path returned 404.
- The local sign/PDF routes intentionally do not consult user entitlements, but they accept only the two local Economics slugs and are reachable only through the feature gate. The local slugs remain outside paid access.
- Valid local assets returned private/no-store responses and `image/webp`; invalid bank, traversal, and `.pdf` paths returned 404.
- A temporary symlink probe pointed an allowed `.webp` path at an outside file. The route returned 404, confirming response-side rejection, but source inspection and execution order confirm the outside target was read before the realpath check. This is the second fail-closed blocker above.

### Search, secondary topics, and subtopics

The runtime and API semantics were exercised independently:

- `/api/questions/search?...q=Microeconomics` returned **59** HL IDs, including primary and secondary-topic matches.
- `q=Automatic stabilizers and evaluation` returned **1** ID (`2023-may-none-hl-p2-q01`).
- `q=Foundations` returned **2** IDs, proving secondary-topic search is not limited to primary labels.
- Direct filtering with `topics: ["Microeconomics"]` plus a detail from `secondarySubtopics` returned **6** rows without relabeling their primary topics.
- Combining Microeconomics with the macro-owned subtopic `Automatic stabilizers and evaluation` returned the one row that actually carries both topic membership and that detail.
- Economics content subtopics remain separate from `skill.*` identifiers; search includes both content and skill text, while the Economics subtopic filter does not expose skills as content subtopics.

### Browser checkbox observation

The initial snapshot was taken before the asynchronous full index had finished loading and showed only three topic checkboxes. After waiting for the index, the UI showed the expected four topics: Foundations, Microeconomics, Macroeconomics, and Global economy. A real click on `Topics: Microeconomics` selected only that checkbox and produced one active-filter chip with **59 questions**.

`Automatic stabilizers and evaluation` is a macro-owned subtopic and is not initially shown under the Microeconomics context; the component exposes outside-context subtopics through its explicit “Show other subtopics” path. The code uses independent checkbox state and a topic/subtopic intersection, so the parent’s unexpected simultaneous Microeconomics + Automatic stabilizers selection is consistent with a browser coordinate/stale-snapshot click artifact; this review found no reproducible checkbox state bug.

## Required closure before any non-local disposition

1. Make the gate allow only the intended development process (with test behavior explicitly isolated) and deny unset, staging, preview, and every other non-development `NODE_ENV`.
2. Canonicalize and containment-check the candidate before `readFile`; reject symlinked/outside targets without reading them.
3. Add regression tests for unset/staging gate values, HTTP-header spoofing, and an outside-target symlink.
4. Re-run the independent read-only review against the corrected HEAD. Existing source/app test passes do not replace this fresh fail-closed review.

## Files created or modified

- Created: `docs/ib-economics-preview-independent-review.md`.
- No other file was modified by this review.
