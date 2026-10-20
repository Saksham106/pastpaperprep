# IB Computer Science HL and SL: release receipt (20 October 2026)

The owner approved the R2 upload and the billing migration in chat on 20 October 2026.

## Source
- Workspace: `ib-computer-science-topic-practice` at commit a0c91c8 (local git).
- Papers: 64 QP/MS pairs, May 2019 to May 2026, from IB Docs (May 2026 from papers.xtremepape.rs, clean and identity-checked).
- Excluded: Paper 3 (the case study). There is no Paper 2 for 2021–22: every mirror lists P1 and P3 only.
- Questions: 897 segmented, audit PASS.
- Classification:
  - Drex `drex-v1.5` ranks candidate subtopics; a blind Sonnet pass labels independently.
  - 567 questions (328 units of identical text) were adjudicated against the mark schemes. None were held.
  - 17 rows carry the array-rule overlay.
- Labelling rule: a mark takes a new-guide (2027) subtopic only where it maps cleanly. Otherwise it takes its exact old-guide (2014) subtopic, marked "(earlier syllabus)". Each question also gets an SL/HL scope tag from the cited new learning points.

## Banks
| Bank | Questions | Papers | Crops | Candidate | Finalized runtime |
|---|---:|---:|---:|---|---|
| ib-computer-science-hl | 506 | 32 | 1,560 (38.3 MB) | `9b74c704…` | `974fc314…` |
| ib-computer-science-sl | 391 | 32 | 1,141 (25.8 MB) | `371c697e…` | `b0fec7f2…` |

There is no free tier: no free years, so each bank opens locked.

## Storage (private bucket `pastpaperprep-assets`)
- Script: `scripts/upload-computer-science-wrangler.mjs --bank <slug>`, using wrangler OAuth with concurrency 2. It is create-only and never overwrites.
- For each object, the script:
  1. checks the local SHA-256 and size against the manifest;
  2. confirms the key is absent with `get`;
  3. uploads it with `put`;
  4. reads it back with `get` and compares the SHA-256 and size.
- The run was interrupted once (the session ended) and resumed from the log.
- Results: 1,560 of 1,560 and 1,141 of 1,141 verified, 0 failed.
- Logs: `docs/ib-computer-science-{hl,sl}-r2-upload-log.jsonl`.
- Receipts: `data/storage/ib-computer-science-{hl,sl}.receipt.json`.

## Billing migration
- `supabase/migrations/20261020020000_ib_computer_science_release.sql` was applied to production through the linked Supabase CLI (`db query --linked`), then recorded with `migration repair --status applied 20261020020000`.
- Read back from production:
  - `schema_migrations` contains `20261020020000 ib_computer_science_release`;
  - `bank_ib_computer_science_hl` and `bank_ib_computer_science_sl` are active;
  - each has 3 `stripe_price_catalog` rows, equal to the 3 generic `bank_igcse` rows they were copied from;
  - `is_valid_custom_bank_ids` accepts both slugs.
- No Stripe object was created or changed.

## Review repair (21 October 2026)
The owner's review of #386 raised two points.

**Migration version collision.** Main's `20261020020000_remove_daily_pdf_export_count_cap.sql` (#384) shared the numeric version that production already records for this release. Supabase keys history by version, and production has not applied the PDF migration. It is renamed to `20261020030000`, and its SQL is unchanged. The release test now asserts that every version is unique and that no later migration redefines the billing objects copied here. The PDF migration itself is not applied by this PR.

**Source text.** Table cells were joined in a scrambled order in the extracted question text. Segmentation now groups cells into visual rows, which fixed 433 question texts, among them the 2026 Figure 3 seat grid. The crops are byte-identical. A second overlay moves five explicit "access to array elements" marks to B2.2, matching their twin papers.

Both runtimes were regenerated, repinned and re-finalized. The asset manifests list the same 2,701 verified objects; only their candidate and content hashes changed. The receipts were rewritten from the unchanged upload logs, with no re-upload, and the prefixes keep the first candidates' names.
