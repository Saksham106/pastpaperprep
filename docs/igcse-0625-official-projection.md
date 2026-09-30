# Physics 0625 official student-filter projection (local candidate)

**Not merged or deployed.** This is a non-destructive display/search projection over the sealed production questions; it does not claim a complete printed-paper semantic relabel of older rows.

## Official sources and scope

- Cambridge IGCSE Physics 0625 [2026–28 syllabus](https://www.cambridgeinternational.org/Images/697209-2026-2028-syllabus.pdf), downloaded as `~/.hermes/cache/scratch/ppp-official/0625.pdf`. SHA-256 is pinned in `src/data/igcse-physics-0625-official-2026.json`. The six content-topic headings and all 71 printed numbered section/subsection headings are represented separately; 24 are parent sections, 47 are their finer numbered children. Parent selection also finds child-addressed questions.
- Cambridge [2023–25 syllabus](https://www.cambridgeinternational.org/images/595430-2023-2025-syllabus.pdf), hash and PDF-index receipt in `~/.hermes/cache/scratch/official-filter-readiness/physics-0625-2023-to-2026-headings.json`. All 71 code addresses match the 2026 tree; 70 titles match verbatim, and §6.1 changes only from “Earth and the Solar System” to “The Earth and the Solar System.” This comparison is about headings, not every teaching statement or Core/Supplement applicability.
- The source 2020–22 classification codes are **not** interpreted as 2026 addresses. An older source label maps to a current heading only on exact title **and** matching owning content topic. This is a structural crosswalk, not printed-paper validation of each older question. Other older rows go into one compact Earlier group.

## Preservation and gaps

All **5,789 unique IDs** remain in both production source and generated public index; zero missing/extra IDs and zero year mismatches. Exact projection counts: 4,040 rows have current official headings (2,513 from 2023–26 codes, 1,527 from exact-title older matches), 1,309 older rows remain in Earlier, 424 experimental/practical rows stay in their own group, and **16 current 2026 content rows have no official section code** and are explicitly shown as “Questions needing section review” rather than being misfiled as earlier-syllabus questions. Practical is a separate topic, **not an invented 72nd official content section**; its old subtopic token remains filterable where present in the source (387 rows), while the practical topic itself reaches all 424. No question is dropped. Source subtopic, topic, detail code, classification provenance, and skills are retained as search aliases and for old URL compatibility, not printed as legacy labels on the question card/PDF. A broad topic filter can still include an older question carrying that source-topic alias; its card says Earlier and it does **not** appear under an unsupported numbered official-section filter.

Exact-ID review queue: `~/.hermes/cache/scratch/igcse-0625-official-review-queue.json` (1,309 older + 16 current rows). The 1,527 older exact-title projections and 2023–26 per-question code validity still need source-level semantic stratification before any broad correctness claim. The current 16 require QP/MS adjudication rather than a guessed section. The generated index manifest changes only for 0625 among the 19 banks.

## Local gates (not deployment)

- Focused projection and original finalized-release tests: **7/7 passed**, including the 144 repaired practical rows and sealed-source assertions.
- ESLint, `git diff --check`, TypeScript (`--max-old-space-size=8192`), and production-gated Next Webpack build (206 pages) passed. Default 4 GB TypeScript heap failed locally; 8 GB completed.
- Local anonymous Ego readback: nine topic choices (six official, Earlier, Experimental, Review), 73 subtopic choices (71 official + Earlier + Review), all 5,789 after clearing `free=1`; Earlier filtered to 1,309 and Review to 16. The local browser showed an asset-loading alert because the local dummy Supabase target has no assets; paid image rendering was not verified.
- No PR, merge, or live production change.
