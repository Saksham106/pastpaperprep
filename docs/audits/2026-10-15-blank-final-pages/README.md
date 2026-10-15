# Final BLANK PAGE question images (2026-10-15)

Many science question crops ended with the exam's closing page: "BLANK PAGE" plus Cambridge's
"Permission to reproduce… / Copyright Acknowledgements" paragraph. Questions showed it on the site
and printed it as "Question N (continued)" in PDFs (first reported on `0610-2020-s-31-q9`, page 20).
The earlier review (`reviewed-blank-qp.json`, 887 entries) covered only strict near-white blanks.

**Change:** 778 more images are listed in `src/data/reviewed-blank-qp.json`, which hides them from
the site, worksheets and PDF exports. Storage objects, release manifests and receipts are untouched.

| Bank | Added | Total listed |
|---|---|---|
| Biology 0610 | 232 | 438 |
| Chemistry 0620 | 190 | 459 |
| Co-ordinated Sciences 0654 | 141 | 403 |
| Physics 0625 | 215 | 365 |
| **All** | **778** | **1,665** |

**Method (automated, not an independent blind review):**
`python3 -I scripts/audit-blank-question-pages.py --projects <dir with the *-topic-practice repos> [--write | --check]`

- The source question-paper page text, before the acknowledgements paragraph, is only BLANK PAGE, the
  page number, the copyright footer, the component code and barcodes.
- The released image bytes match the storage manifest SHA-256.
- The middle of each image has no dark pixels.
- Every question keeps at least one other image.
- The source PDF is the copy named by the row's provenance or already pinned by reviewed entries.

**Validation:** the same rule re-finds all 887 earlier entries, with the same source PDF SHA-256 for
each. A visual sample of the new images showed only BLANK PAGE and the acknowledgements text. The
Chemistry audited-classification seal still reproduces once this projection is undone.

`receipt.json` lists every added image with its bank, question, path, image SHA-256, source page
and source PDF SHA-256. It is sealed in `reviewed-blank-qp.json` under
`evidenceSha256["2026-10-15-blank-final-pages-receipt.json"]`.
