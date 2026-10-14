# IB Maths AA May 2026: official papers replace donated reconstructions

October 2026.

## What was wrong

The May 2026 AA papers came from student-donated scans on IB Docs ("More Papers M26"), before the IB's own release reached any mirror:

- **AA HL:** `2026-may-tza-p1|p2|p3`, 26 questions. Question images were rebuilt cards marked "verified reconstruction", with independent solutions and no official markscheme.
- **AA SL:** `m26-math-aasl-p1-tza|p1-c|p2-tza|p2-tzc`, 36 questions. No official markscheme; one question image was reconstructed.

None of these papers appeared in the full past papers, because the archive requires an official markscheme.

## What changed

- **Sources.** The official May 2026 papers and markschemes for all three time zones come from papers.xtremepape.rs, a mirror of the IB release (IB Docs still had only the donated scans). All are clean IB originals: InDesign papers and Word markschemes, with no third-party marks.
- **Matching.** Content matching shows donated TZA = official TZ1 and donated TZC = official TZ3.
- **Topic practice.**
  - AA HL has 78 official questions (TZ1–TZ3, Papers 1–3); AA SL has 54 (TZ1–TZ3, Papers 1–2). Every question has an official markscheme crop.
  - Source repositories: branch `feat/official-2026` in `ib-maths-aa-hl-topic-practice` and `ib-maths-aa-topic-finder`.
  - The app banks were spliced, so every surviving record is byte-identical.
  - The reviewed production targets (now 893 and 596), the official AA subtopic overlay (132 reviewed rows; the 805 kept rows are unchanged) and the new review manifests `docs/audits/ib-{hl,sl}-official-2026-review.json` cover the new questions. The 2026-08 audit files stay as historical evidence.
- **Old ids.** `src/data/question-id-aliases.json` maps each retired id to its official replacement. Worksheets, saved questions, study progress, PDF export and shared links resolve it, so saved work keeps opening.
- **Full papers.** 9 AA HL and 6 AA SL May 2026 papers were added, all self-markable.

## Receipts

- 430 new question and markscheme crops (23.1 MB) were uploaded to `pastpaperprep-assets` through `wrangler login`. Each key was confirmed absent before the put, and every object was read back by SHA-256 and size. The receipt is `../research/official-sources-20261013/r2-upload-aa-2026.receipt.json`.
- The 30 May 2026 AA PDFs were uploaded to `pastpaperprep-free` with `scripts/publish-free-papers.mts`.

## Owner follow-ups

- Delete the 64 images of the 62 retired questions (26 HL, 38 SL) from `pastpaperprep-assets`: `ib-hl/questions/2026-may-tza-*` and `ib-sl/questions/m26-math-aasl-*` (script: `../research/official-sources-20261013/owner-cleanup/delete-retired-aa-2026-images.sh`). `npm run r2:verify` reports them as unexpected until then.
- No worked explanations exist yet for the new 2026 ids. The retired ones had none either.
