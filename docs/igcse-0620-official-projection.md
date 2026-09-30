# Chemistry 0620 official student-filter projection (local candidate)

**Not merged or deployed.** This is a non-destructive presentation and retrieval projection over the sealed production questions, not a printed-paper semantic rereview of every label.

## Official basis

- [Cambridge Chemistry 0620 syllabus for 2026–28](https://www.cambridgeinternational.org/Images/697205-2026-2028-syllabus.pdf), locally hash-pinned in `src/data/igcse-chemistry-0620-official-2026.json`: 12 named content topics and 49 distinct numbered sections in order.
- [2023–25 syllabus](https://www.cambridgeinternational.org/Images/595428-2023-2025-syllabus.pdf) (version 2): all 49 numbered codes **and headings** match the 2026 PDF exactly. PDF hashes and extracted page-index receipts: `~/.hermes/cache/scratch/official-filter-readiness/chemistry-0620-2023-to-2026-headings.json`. This is a heading comparison only; teaching bullets and Core/Supplement applicability have not been declared identical.
- Source `src/data/igcse-chemistry-0620-official-taxonomy.json` has the same 49 current titles and topic owners. Current-era code+detail IDs are checked against that owner. For 2026 rows without a provenance code but with a valid primary detail ID, the detail’s owner section code is projected. **All 404 questions from 2026 incorrectly carry source `courseEra=2023_2025`**; the display uses exam year and the verified matching heading trees while retaining that original era value for audit. This does not silently repair the sealed runtime. Provenance refs say `source_recorded:2023_2025:<code>` for the stale source metadata, while the section actually shown to students uses the separate `current_2026:<code>` ref.
- For pre-2023 questions, only an exact title **with the same owning topic** is mapped structurally to a current heading. Mismatched labels or no section go into the compact Earlier group. A source section label with matching source primary/secondary topic remains a separate `alias_current:<code>` retrieval ref, not a claim of verified current-code provenance; original section titles and skills remain searchable.

## Exact coverage and open review

All **5,129 unique source and generated-index IDs** remain; zero missing/extra IDs and zero year mismatches. Mutually exclusive primary dispositions: 4,093 current-only; 373 older with at least one historical component (including mixed current/historical rows); 329 current 2023–26 content without detail/code; 334 practical-primary rows. The 329 stay under “Questions needing section review,” **not** “Earlier syllabus.” A few Paper 5/6 rows have content ownership and are not automatically relabeled practical. The practical group is separate from the 49 official content sections; practical skill tokens remain searchable but are hidden from the numbered syllabus picker. Exact-ID queue: `~/.hermes/cache/scratch/igcse-0620-official-review-queue.json`.

The projection does not independently validate all older exact-title matches or all source-coded questions against QP/MS content. The 329 current no-address rows include complex multipart questions; source labels remain searchable, but their cards explicitly say section review is needed. A broad official topic can include a historical question via its original topic alias for old URL compatibility; an official section selection requires the projected current ref or an owner-checked source alias ref.

## Local verification only

- Focused projection, original release/reconciliation, audited source-seal, and exact-30-Other retrieval tests passed (13/13). Original production source and private-index seals were not rewritten. Generated public index manifest changed only for Chemistry 0620, from `3f4d46493424` to `eeede8dec587`.
- ESLint, `git diff --check`, TypeScript (8 GB heap) and production-gated Next Webpack build (206 pages) passed.
- Local anonymous Ego Browser readback found 15 topic options (12 official + Earlier + Practical + Review), 51 subtopic options (49 official + Earlier + Review), zero internal `Practical.*` options, and 5,129 total results after clearing the free-only filter. Earlier, Review and Practical deep links rendered representative cards. Exact filtered counts were asserted by tests: 373, 329 and 334 respectively. Local dummy Supabase does not verify paid image/PDF access.
- No PR, merge, deployment, or production readback.
