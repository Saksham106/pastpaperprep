# IB Economics HL/SL local delivery QA — current

## Verdict

**FAIL-CLOSED / local preview only.** The sealed HL/SL runtime data, direct local routes, source-derived WebP delivery, gate/access scope, and a bounded multi-image PDF export contract check passed. The actual hydrated browser pages and browser-triggered client PDF download were **not completed** because the documented local Next server cannot start in this checkout: Next exits after its readiness banner when it cannot load the macOS arm64 SWC binary. Production remains blocked by `unknown_publication_blocking` rights status.

This report owns only this file. Private machine-readable evidence and the generated PDF check are outside the repository at:

- `/Users/sakshamgoel/privateQAevidence/ib-economics-local-delivery-qa-current/evidence.json`
- `/Users/sakshamgoel/privateQAevidence/ib-economics-local-delivery-qa-current/multiimage-export-contract.pdf`

## Scope and non-modification boundary

- App: `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep`
- Read-only source: `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice`
- Existing listener check: no process was listening on `127.0.0.1:3100` before the attempt.
- The only attempted server was development-only, with the documented exact source mount:

  ```text
  NODE_ENV=development
  PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW=true
  PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT=/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice
  npx next dev --webpack --hostname 127.0.0.1 --port 3100
  ```

- No app/source files, source records, tests, generated indexes, uploads, deployment, commit, push, credentials, or external systems were changed.
- The app checkout was already dirty with unrelated and existing Economics work; that state was not attributed to this QA.

## Checks exercised and results

### Sealed source and runtime metadata

- Source validators returned empty error lists:
  - `validate_final_classifications`: `[]`
  - `validate_release_inputs`: `[]`
- Source seals matched the documented values:
  - `final-classifications.json`: `28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb`
  - `release-inputs.json`: `0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39`
  - `release-taxonomy.json`: `75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c`
- Runtime hashes matched the documented seals:
  - HL: `bf18f568dcd896679b19bb95ae2ea79a02cca54b54787cd35bbc3e356781da93`
  - SL: `266d49669674396fad35812225d1306eda76f4faeafb886a102a1f23d5a32e47`
  - Runtime taxonomy: `75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c`
- Sealed runtime rows: **HL 111**, **SL 89**, **184 unique canonical IDs**, with **16 shared IDs** represented in both level views.
- Paper scope: HL papers 1/2/3; SL papers 1/2. Both sessions are present: HL May 61 / November 50; SL May 50 / November 39.
- Year counts from the sealed runtime metadata:

  | Level | 2021 | 2022 | 2023 | 2024 | 2025 | Total |
  |---|---:|---:|---:|---:|---:|---:|
  | HL | 26 | 14 | 20 | 22 | 29 | 111 |
  | SL | 20 | 10 | 16 | 18 | 25 | 89 |

- Primary-topic counts from all 200 level rows: Global economy 85, Macroeconomics 63, Microeconomics 52.
- Secondary-topic membership counts: Global economy 54, Macroeconomics 76, Microeconomics 73, Foundations 4.
- Representative secondary-topic membership was preserved without relabeling primary topic: `2021-may-none-hl-p2-q01` is primary Global economy with secondary Macroeconomics and Microeconomics; `2021-may-none-sl-p2-q04` is primary Global economy with secondary Microeconomics.
- All 200 rows have question images, official mark-scheme images, HTTPS question provenance, HTTPS mark-scheme provenance, and `semantic_qa_approved` status.

### Direct local route delivery

These were invoked directly against the route handlers with the development gate and exact source root, independent of a running Next server:

- `/api/local-preview-index/ib-economics-hl`: HTTP 200, version 1, **111** rows, no rich text or asset URL keys.
- `/api/local-preview-index/ib-economics-sl`: HTTP 200, version 1, **89** rows, no rich text or asset URL keys.
- A mounted official-answer WebP route returned HTTP 200, `image/webp`, `private, no-store, max-age=0`, and 46,750 bytes.
- PDF asset-signing route for `2025-may-tz1-hl-p1-q01`, content `both`, returned HTTP 200 and private/no-store headers with 1 question URL plus 3 official-answer URLs.
- With the explicit preview flag disabled, the local index route returned HTTP 404.
- Focused Vitest: **5 files passed, 24 tests passed**. This covered local counts/scope, protected index shape, gate denial, entitlement denial, signing, PDF selection, mounted assets, traversal, forwarded-header behavior, and the pre-read containment regression.

### Asset completeness and decoding

- Source inventory: **475 question WebPs + 869 official-mark-scheme WebPs = 1,344**.
- Runtime references: 557 question image references + 1,047 official-answer image references = 1,604 references.
- All **1,344 unique referenced files** were located and decoded with Pillow; **0 decode errors**.
- The runtime contains 200 multi-image records. The exercised representative `2025-may-tz1-hl-p1-q01` has 1 question image and 3 official-answer images.

### Access and local-gate scope

- Gate matrix with the explicit flag set: `development=true`; unset, empty, `test`, `staging`, `preview`, and `production` are all false.
- Development preview exposes 14 banks (12 production + 2 local candidates); production exposes 12 and no Economics bank.
- `hasBankAccess("ib-economics-hl", bundle_all)` and the SL equivalent both returned false. Local delivery is a development-gated preview path, not an entitlement grant.
- The focused forwarded-header regression passed; spoofed Host / X-Forwarded-Host / X-Forwarded-Proto values did not alter authorization.

### PDF export contract check

A private four-page jsPDF artifact was generated from the exact decoded WebPs for `2025-may-tz1-hl-p1-q01` (1 question page + 3 official-answer pages). PyMuPDF verified 4 pages and nonempty image objects on every page. This verifies multi-image input ordering/page preservation at the export-contract level.

It is **not** a browser client-download pass: the app's `downloadQuestionPdf` path could not be run in a hydrated page because the local Next server could not start.

## Blockers and unexercised checks

The server attempt failed with:

```text
Failed to load SWC binary for darwin/arm64 while loading next.config.ts
```

An ego-browser attempt to `http://127.0.0.1:3100/banks/ib-economics-hl` consequently returned `ERR_CONNECTION_REFUSED`. Therefore these checks remain open and must not be reported as passed:

- hydrated HL route and hydrated SL route in a real browser;
- question-card image decoding after hydration and scroll-into-view;
- opening an official answer in the hydrated UI and checking every answer page visually;
- real browser primary/secondary topic filtering and year/level filter result counts;
- logged-out UI behavior and entitled UI behavior in a live browser session;
- browser-triggered client PDF download and inspection of its downloaded bytes;
- visual fidelity/screenshot review of the rendered question and answer pages.

The direct route, data, security, access-scope, and asset-decoding evidence above is not a substitute for those browser checks. Resume with the same documented development flags and source mount after installing or otherwise restoring the repository's expected macOS arm64 SWC dependency; do not upload, deploy, commit, or broaden the local gate.
