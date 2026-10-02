# Biology MCQ answer-crop repair

## Candidate scope

The candidate replaces 99 exact Biology MCQ answer images. It does not rewrite the sealed 4,913-question runtime, classifications, questions, prior upload receipts, or existing blank-page exclusions. Active production viewer/PDF signing uses an exact-ID/path projection, following the existing reviewed-crop projection pattern.

The repaired objects are new create-only keys under a distinct repair subnamespace; old objects remain available for rollback. All 99 new objects passed full remote GET SHA-256, byte-size, and content-type checks, bound to the new immutable manifest and receipt.

## Diagnosis and audit

The original MCQ crop detector selected the earliest matching numeral in a positional band. Cover headings such as Paper 1 / Paper 2 therefore owned an answer crop. The corrected detector first identifies Question/Answer columns in a real Mark/Marks table, then requires the question number and independently keyed A–D letter inside the same row.

The active-source-bound audit checked 4,000 MCQ records across 100 source-pinned papers: 99 confirmed missing-number/answer crops, 3,900 passing source-token checks, and one held active/source mismatch (`0610-2025-w-23-q2`, a previously repaired asset). The earlier unjoined audit reported 100 defects; that is superseded by this active-manifest reconciliation. This is not an all-bank or written-answer audit.

## Evidence and reproducibility

- Audit SHA: recorded in `data/storage/igcse-biology-0610.mcq-repairs.manifest.json`.
- Candidate manifest and remote verification receipt: same directory.
- Minimal client projection: `src/data/reviewed-mcq-answer-repairs.json`; contains no answer letters or credentials.
- Source generator: `igcse-biology-0610-topic-practice/scripts/full_segmentation_adapter.py`; regression `tests/test_mcq_answer_table_ownership.py` (five real-PDF cases passed).
- Preserved generator backup and audit script: `research/crop-repair-20261001/biology-mcq/` outside the app repository.

Rollback: revert this projection/helper and normalization change. Never delete or overwrite the historical objects as part of this repair.
