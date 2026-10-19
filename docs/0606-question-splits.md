# Reviewed 0606 question split: 0606-2024-june-22 Q10/Q11

Found 2026-10-18 while writing the 0606 2024 explanations: the explanation for `0606-2024-june-22-q10` totals 8 marks, but the runtime row says 16. Package: `../research/0606-2024-june-22-q11-split/` (`build_split.py`, two byte-identical builds).

## Defect

The served crop `questions/0606-2024-june-22-q10.webp` (1070×3174) is stitched from QP pages 14 and 15. Page 15 is Q11 ("In the binomial expansion of (2 + x/2)^n … [8]"). So the bank has no `-q11` row, Q10 carries Q11's text, and its marks are 16 = 8 + 8. The paper still totals 80, which is why the marks census did not catch it.

The question paper (SHA-256 `55b4c2f0…`) prints Q10 as [1] + [5] + [2] = 8 and Q11 as [8]. The official mark scheme (SHA-256 `a8848c96…`, "Maximum Mark: 80", 12 of 12 pages) ends at 10(c) and has no Q11 rows.

## Sources checked

Every mirror serves the same incomplete scheme:

- Best Exam Help (the pinned copy), PapaCambridge and pastpapers.co: the same 296,563 bytes.
- papers.xtremepape.rs: a 270,464-byte Ghostscript re-save from December 2025 with the same 12 pages and the same labels, ending at 10(c). It was downloaded to a scratch folder, compared and deleted.
- Exam Easy: timed out.
- Cambridge's public page: lists only components 11 and 21.

## Repair

- **Q10** is served as the page-14 segment of today's crop: rows 0–1599, the first segment of its pinned print geometry. It is copied pixel-for-pixel from the served object and saved as lossless WebP. It keeps its printed 8 marks and gets a reviewed transcription, because the delivered text carried Q11 and barcode control characters. Its classification already covered Q10 only.
- **Q11** is held out of the bank as a question-paper-only record. The bank does the same for June 2026 component 23 ("do not publish a question-paper-only record"). Runtime serves 72 of the paper's 80 marks.

`scripts/build-reviewed-0606-question-splits.mjs <package> [--check]` writes `src/data/reviewed-0606-question-splits.json` and `data/storage/0606-question-splits.manifest.json`: 1 object of 27,476 bytes under `repairs/0606-question-split-v1-f1374ccfc06ee77f`. The overlay is bound to the raw paths, marks and text hash, and is applied in four places:

- question paths, marks and text in `src/lib/questions.ts`;
- print geometry in `src/lib/print-geometry.ts` and `src/lib/verified-0606-client.ts`;
- marks in the public index;
- the explanation publisher's marks check.

The raw bank, its 1,633-row base and every sealed 0606 receipt are unchanged.

## Upload (owner approval)

`scripts/upload-reviewed-0606-question-splits.mjs` (scoped token or `--via-wrangler`) uploads create-only, re-reads the object in full and writes `data/storage/0606-question-splits.receipt.json`.

## Follow-up

- After this ships, clear `needs_review` on the held Q10 explanation (8 marks, Q10 only) and publish it.
- Q11 stays out until an official mark scheme with Q11 appears.
- An anchor audit of all 147 0606 question papers found no other merged questions in the 126 papers with a usable text layer. The 2016 papers (except 2016-november-23) and the 2026 papers yield no question-number words and still need another check, such as OCR.
