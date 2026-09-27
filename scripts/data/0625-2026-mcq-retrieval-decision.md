# Physics 0625: bounded 2026 MCQ retrieval correction

Scope: **exactly 14** original “Other”-only MCQs across eight 2026 QP/MS pairs. Original frozen queue, baseline commit, applicable official Cambridge 2026–28 syllabus, paired PDF SHA-256 hashes, per-row assessed-operation notes and exact labels are pinned in `0625-2026-mcq-retrieval-targets.json`. The separate `0625-2026-mcq-jev-evidence.json` is a bounded TypeSafe Jev suggestion record, **not** the adjudication. The earlier broad/narrow Jev pilot scored only 7/12 and 4/6; agreement on these constrained options does not establish model calibration.

The independent QP/MS reviews and printed 2026–28 syllabus govern retrieval:

- Measurement group: ruler or measuring-cylinder selection and measured quantities map to section 1.1 and the existing **Physical quantities and measurement techniques** filter. `s-12-q1` and `s-13-q1` have density contexts, yet the answer turns on the *measuring method*, not calculating density; no Density label is added.
- `m-12-q1` is explicitly **broad-only**: volume divided by time has no one-to-one narrow syllabus objective. It receives only the **Motion, forces and energy** parent, with **empty subtopics/detailedSubtopics**. Its gap status stays untouched; it must not appear under the 1.1 measurement-detail filter.
- `m-12-q3`: weight from mass and gravitational field strength, §1.3.
- `s-11-q3`: near-Earth free-fall acceleration, §1.2.
- `m-12-q13`, `s-11-q12`, `s-12-q12`, `s-13-q12`: Celsius-to-kelvin temperature conversion, §2.1.3 (printed core objective 2), under the existing broad **Gases and temperature** filter. This is a topic retrieval label, not a claim that each question tests a gas law.

The two other original 2026 “Other”-only Physics rows, `m-32-q2` and `s-31-q2`, are multipart with genuinely different operations and **remain unchanged**; do not assign one question-level topic by analogy. No Chemistry, 0654, Biology or billing records are touched.

Thirteen rows change the four runtime fields `primaryTopic`, `primaryTopicId`, `subtopics`, `detailedSubtopics`; the one broad-only row changes just the first two and keeps both detail arrays empty. Private-index rows likewise change `primaryTopic`/`subtopics` for thirteen rows and only `primaryTopic` for the broad-only row; the public generated index additionally projects its derived `skills`. All 14 keep `classificationReviewStatus: unresolved_taxonomy_gap` and historical `classificationProvenance`: this is student retrieval, **not** a fabricated reclassification decision. All 5,775 other Physics rows, including the prior 144 practical repairs, the source question text, image URLs, QP/MS reference, asset manifest and verified storage receipt stay byte/field-equivalent. A second sealed-content layer pins the new whole-bank content digest without rewriting the original practical repair seal; replays and guards check both.

Release gates: exact baseline replay, source-hash review, focused/tamper tests, TypeScript, lint, generated-index diff, production build, full-suite differential, independent adversarial review, then student-visible live filter/image checks. Historical full-suite failures are not evidence of this change unless candidate-only.
