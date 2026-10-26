# MCQ answer letters from the official mark schemes (2026-10-13)

The answer letters come from the official mark-scheme PDFs in the sibling source repos. App data was read at
`origin/main` `fff59044e2da7bd76a38ae2e0474e17273b42210` with `git show`, and nothing in the app or source repos was changed.

## Deliverables

| File | What it is |
|---|---|
| `reviewed-mcq-answer-letters.json` | The overlay, `{version: 1, banks: {slug: {questionId: {answers, note}}}}`: 8,127 rows. Re-verified IGCSE science letters are not in it; they stay in production data. |
| `evidence.json` | One entry per row (23,686 rows) and per paper (634 papers): PDF path, SHA-256, manifest check, page, read A, read B, glyph check, edit scan, HL/SL cross-check, decision and reason. |
| `existing-letter-disagreements.json` | Re-verification of the app's existing `answer` letters. **0 disagreements in 15,556 rows.** |
| `manual_review.json` | The written decisions from looking at rendered keys (92 rows). |
| `review-renders/` | The rendered pages and contact sheets those decisions cite, plus a random spot check of 24 rows (all correct). |
| `scripts/` | The pipeline (`run_all.sh`). `work_*.json` holds intermediate outputs. `appdata/` is the snapshot, which `scripts/snapshot_appdata.sh` rebuilds. |

## Method

1. **Inventory** (`inventory.py`). MCQ rows per paper come from production JSON:
   - Economics 0455: `paper == 1`.
   - IB: `component` P1 or P1A.
   - IGCSE sciences: rows with an `answer`.
   - 2026 rows not yet in the app: the worktrees' segmentation manifests (`0455-2026-{m-12,s-11,s-12,s-13}`, `0610-2026-s-{11,12,13,21,22,23}`).

   Each paper maps to `<paperId>-markscheme.pdf` in the repo's raw folders. Its SHA-256 must appear in that repo's acquisition manifests or download reports, and 628 of 634 do. The other 6 are the clean 0620 May/June 2026 keys in `research/papacambridge-clean-20261013/sources/`, used as instructed; no manifest records them. Every chosen PDF was checked for PapaCambridge/StudyHatch metadata or text, and none had it. `review-staging/` was never read.
2. **Read A** (`read_a.py`, PyMuPDF words):
   - IGCSE: integer words under the `Question` header are question numbers. Each row runs from its number to the next number. The answer cell is every word in that band between the Question column and the `Marks` header.
   - IB: `N.` tokens. The answer is the words on the same baseline up to the next `N.`.
3. **Read B** (`read_b.py`, pdfplumber/pdfminer, a different parser):
   - IGCSE: ruled-table extraction. Cells come from the drawn table lines.
   - IB: character-clustered text lines, parsed as a regex token stream.
   - Three IB Biology 2022 keys broke pdfminer's xref parser. They were re-saved structure-only (no content cleaning) before reading B; `readB_structureRewrite` marks them.
4. **Extra gates**, added because text-only reads can miss what is actually printed:
   - *Glyph check* (`glyph_check.py`): each letter is cropped from a 300 dpi render and compared with leave-one-out templates of the same letter from the same PDF.
   - *Edit scan* (`edit_scan.py`): looks for white-outs, overlaid images, letters re-set in another font, invisible text and annotations over key cells.
   - *IB HL/SL cross-check* (`cross_level.py`): 1,453 questions printed in both the HL and SL paper must have the same key in the two PDFs.
5. **Acceptance:** read A == read B, a single letter A–D, glyph check consistent and no edit or cross-check flag. The paper's keyed count must also equal the app's row count (removed questions excepted). For the re-verified 0620 2019–2020 papers, where the app holds only some rows, the key must be complete (40) and contain every app row. Anything else went to visual review (`manual_review.json`). The result was 8,038 overlay rows auto-accepted. Another 89 overlay rows were decided or confirmed by looking at the rendered key, and 3 were excluded.

Apple Vision OCR was tried as an image read and rejected: it drops isolated single letters. tesseract is x86-only on this machine.

## Counts per bank

| Bank | MCQ rows | Letters accepted | Excluded | Missing PDFs |
|---|---:|---:|---:|---:|
| igcse-economics-0455 (2019–2025, 49 papers) | 1,465 | 1,465 | 0 | 0 |
| igcse-economics-0455 2026 (m-12, s-11/12/13) | 120 | 119 + 1 official removal | 0 | 0 |
| ib-biology-hl | 1,200 | 1,200 | 0 | 0 |
| ib-biology-sl | 930 | 930 | 0 | 0 |
| ib-chemistry-hl | 1,200 | 1,200 (2 are "A or C") | 0 | 0 |
| ib-chemistry-sl | 900 | 900 (2 are "A or C") | 0 | 0 |
| ib-physics-hl | 1,200 | 1,200 | 0 | 0 |
| ib-physics-sl | 875 | 872 | 3 (see below) | 0 |
| igcse-biology-0610 2026 May/June (s-11…23) | 240 | 240 | 0 | 0 |
| **Overlay total** | **8,130** | **8,127** | **3** | **0** |
| Re-verify igcse-biology-0610 | 4,000 | 4,000 agree | – | 0 |
| Re-verify igcse-chemistry-0620 | 4,038 | 4,038 agree | – | 0 |
| Re-verify igcse-physics-0625 | 4,239 | 4,239 agree | – | 0 |
| Re-verify igcse-coordinated-sciences-0654 | 3,279 | 3,279 agree | – | 0 |

Economics has 1,465 P1 rows, not the ~1,045 expected, because production now includes 2019–2020. The 2026 rows match the 0455 and 0610 worktree pipelines' own letters (360/360, counting s-11 Q26, which is null there too).

**Coverage gaps:** none. Every in-scope paper has a local official key.

## Official exceptions

- **"A & C" (two answers accepted)** in IB Chemistry, November 2023:
  - HL TZ1 and TZ2 Q19: `answers ["A","C"]`, note "A or C accepted".
  - SL TZ1 and TZ2 Q17: same.
- **Removed:** `0455-2026-s-11-q26`. The key says the question was removed from the paper (0 marks). It is in the overlay as `answers: []` with a note, so **the app loader must accept an empty `answers` array** (or drop that entry).
- **Discounted questions with no app row** (nothing to write):
  - 0455: 2021-w-11/12/13 Q22, 2022-m-12 Q22, 2025-s-11 Q10.
  - 0654-2023-summer-22 Q17.
  - 0625-2024-s-21 Q14.
- **Key typo:** 0455-2020-m-12 prints question "113" between rows 12 and 14. It was read as Q13 = D, confirmed visually.

## Needs owner judgment

1. **Three IB Physics SL keys contradict the HL key for the identical question, and the physics agrees with HL.** They are excluded, so the app keeps showing the official image. The HL rows are in the overlay.

   | SL row | SL key | Same question in HL | HL key | Physics |
   |---|---|---|---|---|
   | `2019-november-tz0-sl-p1-q4` | B | `…hl-p1-q5` | C | Area under the a–t graph = 10 m/s → C |
   | `2023-may-tz2-sl-p1-q7` | C | `…hl-p1-q7` | B | 48M J in 2 s = 24M W → B |
   | `2024-may-tz1-sl-p1-q29` | A | `…hl-p1-q23` | C | P ∝ r²T⁴ → 1/4 → C |

2. **20 IB key cells were edited inside the official PDFs.** They show white-outs, overlaid images, letters re-set in Arial over ArialMT, and one IB editorial stamp (title `EDT_EN`, 2022-06-27). In each case the printed (rendered) letter was taken, after checking it visually. Two cases stand out:
   - **`ib-biology-hl 2022-may-tz1-hl-p1-q28`:** the text layer says **B**, but the stamp prints **C**, and the overlay uses **C** (the biology confirms C). Reads A and B agreed on B here, and only the glyph check caught the difference. The app's `markschemeTranscript` for this row also says "28. B".
   - **`2025-may-tz2-hl-p1a-q39`** has no letter in the text layer, only a pasted image of C.

   The full list of edited cells is in `evidence.json` (`editScan`).

## Notes

- The pipeline runs in a fresh `/tmp/mcqvenv` built from the arm64 0455 Python (numpy, pdfplumber, pymupdf 1.28.2, pillow). Nothing was installed globally.
- `git fetch origin` was run once in the app checkout to read `origin/main`. It only updated remote-tracking refs.

## Import into this repository

The research files above (`evidence.json`, `review-renders/`, `scripts/`, …) stay in `../research/mcq-answer-letters-2026-10/`; this receipt and the imported overlay are what the app keeps.

`npx tsx scripts/import-reviewed-mcq-answer-letters.mts ../research/mcq-answer-letters-2026-10/reviewed-mcq-answer-letters.json` writes `src/data/reviewed-mcq-answer-letters.json`, keeping only rows this checkout has. Import of 2026-10-13 on `origin/main` `fff5904`:

| | |
|---|---|
| Source overlay SHA-256 | `15d10333310abe4420463ffa924912234ff7d9e98509d90be27c57775cd2170e` (8,127 entries) |
| Imported overlay SHA-256 | `a97275a9a5b0f5e09fa5db7a59ef7558989e09ae22687733c0a6fe2a28aebb91` (7,767 entries) |
| Kept | 0455 1,465 · IB Biology HL 1,200 / SL 930 · IB Chemistry HL 1,200 / SL 900 · IB Physics HL 1,200 / SL 872 |
| Dropped, rows not landed yet | 359: `0455-2026-{m-12,s-11,s-12,s-13}` (119) and `0610-2026-s-{11,12,13,21,22,23}` (240). Re-run the import once those papers are on `main`. |
| Dropped, removed by the board | `0455-2026-s-11-q26` (`answers: []`); the loader still rejects empty `answers`. |
| Notes normalized | A note that only restates a multi-letter answer is set to `null`, since the chip already reads "A or C": the four IB Chemistry November 2023 "A or C accepted" rows. |

Re-import of 2026-10-14, once the 2026 papers landed with PR #282: same source overlay (`15d10333…`), imported overlay SHA-256 `56f8b685ae1f7e3752888775d25ff71627b6522fc419d5f81664b14232556849` (8,126 entries). It adds the 119 Economics 0455 2026 letters and the 240 Biology 0610 May/June 2026 letters (which agree with the official `answer` on those rows); `0455-2026-s-11-q26` is still dropped as removed by the board, and no row is dropped as not landed.

The three excluded IB Physics SL rows have no entry, so they keep showing the official mark-scheme image. `src/lib/mcq-answer-letters.test.ts` pins the imported SHA-256.

Import of 2026-10-15 (IB Chemistry May 2026, branch `feat/ib-chemistry-may-2026`): the source overlay (`15d10333…`) plus the 210 official May 2026 IB Chemistry letters (`docs/ib-chemistry-may-2026/mcq-answer-letters-2026.json`, SHA-256 `c513c55fa201414c39367fa69e87de8548c729d6915f471d26148f08533e34a8`: HL 120, SL 90, TZ1 to TZ3 Paper 1A). Imported overlay SHA-256 `fa942b3cb66fa874ab6a52acdcc8a713279e2176b182da0675917f77a52670fd` (8,336 entries; Chemistry HL 1,320, SL 990). Each key was read three independent ways (the mark-scheme text layer, a blind visual read of the rendered key pages, and a reviewer reading the served answer crop), all 210 agree, and the 67 HL/SL questions with identical text carry identical keys. Nothing is dropped.

Import of 2026-10-15 (IB Biology May 2026, PR for `feat/ib-biology-may-2026`): the source overlay (`15d10333…`) plus the 210 official May 2026 IB Biology letters (`docs/ib-biology-may-2026/mcq-answer-letters-2026.json`, SHA-256 `6ea073620eca9521ee2d07642e7a40296c0bb29feec3f2bb3bdb57156c99ded7`: HL 120, SL 90, TZ1 to TZ3 Paper 1A). Imported overlay SHA-256 `324d5073b51565f75fd7014ce41e44250ca91b804a57401a74808a761f8fec71` (8,336 entries; Biology HL 1,320, SL 1,020). Each paper's key was read two independent ways (`read_mcq_keys_2026.py` in the source lane), the 32 HL/SL twin questions carry identical keys, and every letter matches the row's own `markschemeTranscript`. Nothing is dropped.

Combined re-import after both merged (IB Biology and IB Chemistry May 2026, run with both addition files over the source overlay `15d10333…`): imported overlay SHA-256 `76c456527f053db418d61b2e66f4afdfc06bc0e52df7e184820efd997e06e53d` (8,336 entries; Biology HL 1,320, SL 1,020; Chemistry HL 1,320, SL 990). This supersedes the per-bank overlay hashes above.

Import of 2026-10-15 (IB Physics May 2026, `feat/ib-physics-may-2026`): the source overlay (`15d10333…`) plus the 195 official May 2026 IB Physics letters (`docs/ib-physics-may-2026/mcq-answer-letters-2026.json`, SHA-256 `75d8347ee954d60f2bb58cc34d808e144db2ca4c6193e580e2eebb8b0ab0a214`: HL 120, SL 75, TZ1 to TZ3 Paper 1A). Imported overlay SHA-256 `ef8c95f022c6d5d2256a02667fea364da4495a85436656b20cdc87148a345af7` (Physics HL 1,320, SL 947). Each paper's key was read two independent ways (the PDF text layer in the source lane's segmentation audit, and a letter-by-letter visual read of the rendered key page), the 41 HL/SL twin questions carry identical keys, and every letter matches the row's own `markschemeTranscript`. Nothing is dropped.

Combined re-import after Biology, Chemistry and Physics (IB May 2026, run with all three addition files over the source overlay `15d10333…`; the Biology, Chemistry and Physics addition SHA-256s are `6ea07362…`, `c513c55f…` and `75d8347e…` as pinned above): imported overlay SHA-256 `25d84993b7417afaf12b6868eb1bd8326a6ff637f083498a5398d5bf71f4c69f` (8,741 entries; Biology HL 1,320, SL 1,020; Chemistry HL 1,320, SL 990; Physics HL 1,320, SL 947). Against the Chemistry branch overlay it only adds the 195 `ib-physics` keys. This supersedes the per-bank overlay hashes above.

Import of 2026-10-26 (0654/23 Oct/Nov 2020 key misprint, receipt `docs/0654-w20-23-mcq-key-misprint.md`): the source overlay (`15d10333…`), the three IB May 2026 additions above, and `docs/0654-w20-23-mcq-key/mcq-answer-letters.json` (SHA-256 `7ae13a88b172860bed582ab608b4b49470aea5daedb2b5226b4d3ee49995643a`). That file corrects five rows (`0654-2020-winter-23-q8` B, `q9` D, `q11` B, `q12` A, `q14` D) where Cambridge's printed key is out of step with the paper; each note says the published key differs. Imported overlay SHA-256 `51743d5653ffc9e9e2c85f90a1617eb3d4021194ea703292c6f3b9220f23ebcd` (8,746 entries). It only adds those five `igcse-coordinated-sciences-0654` rows; every other 0654 letter still comes from production data.
