# BLANK PAGE question images (2026-10-15)

Many science question crops included an exam page with nothing but "BLANK PAGE". Most were the
paper's closing page, which also carries Cambridge's "Permission to reproduce… / Copyright
Acknowledgements" paragraph; others were mid-paper blank pages of the 2024–2026 layout, with
"DO NOT WRITE IN THIS MARGIN" side text and barcodes. Questions showed them on the site and printed
them as "Question N (continued)" in PDFs (first reported on `0610-2020-s-31-q9`, page 20). The
earlier review (`reviewed-blank-qp.json`, 887 entries) covered only strict near-white blanks.

**Change:** 1,065 more images are listed in `src/data/reviewed-blank-qp.json`, which hides them from
the site, worksheets and PDF exports. Storage objects, release manifests and receipts are untouched.

| Bank | Added | Total listed |
|---|---|---|
| Biology 0610 | 305 | 511 |
| Chemistry 0620 | 286 | 555 |
| Co-ordinated Sciences 0654 | 210 | 472 |
| Physics 0625 | 264 | 414 |
| **All** | **1,065** | **1,952** |

**Method (automated, not an independent blind review):**
`python3 -I scripts/audit-blank-question-pages.py --projects <dir with the *-topic-practice repos> [--write | --check | --dump FILE]`

- The **whole** source question-paper page text, once the known copyright-acknowledgement sentences
  (each 2019–2026 wording) are removed, is only BLANK PAGE and page furniture: page number,
  copyright footer, component and document codes, barcodes, margin notes, and the known
  PapaCambridge rehosting stamp on superseded 2026 Chemistry sources. Text extraction order is not
  trusted; nothing is skipped.
- The released image bytes match the storage manifest SHA-256.
- The middle of each image has no dark pixels.
- Every question keeps at least one other image.
- The source PDF is the copy named by the row's provenance or already pinned by reviewed entries.

`--check` fails if any released blank page is unlisted, and re-verifies every receipt entry against
its pinned source page.

**Validation:**
- The rule accepts all 887 earlier entries, each with its pinned source PDF SHA-256.
- Visual samples of both groups showed only BLANK PAGE, acknowledgements and margin furniture.
- The Chemistry audited-classification seal still reproduces once this projection is undone.
- A first, looser rule found 778 of these. A review noted that it skipped text after the
  acknowledgements, and the stricter whole-page rule found 287 more of the same kind.

`receipt.json` lists every added image with its bank, question, path, image SHA-256, source page
and source PDF SHA-256. It is sealed in `reviewed-blank-qp.json` under
`evidenceSha256["2026-10-15-blank-final-pages-receipt.json"]`.
