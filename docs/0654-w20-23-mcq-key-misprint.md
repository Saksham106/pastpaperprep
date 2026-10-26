# 0654/23 October/November 2020: misprinted official MCQ key (2026-10-26)

Cambridge's published key for Co-ordinated Sciences 0654/23 Oct/Nov 2020 (Paper 2, Multiple Choice Extended) is out of step with the question paper for rows 8–14. Five rows carried a wrong letter on the site. They now show the corrected letter with a note saying the published key differs. 0654 2020 is a free year, so free visitors saw the wrong letters too.

## Sources

| | SHA-256 |
|---|---|
| Question paper, `igcse-coordinated-sciences-0654-topic-practice/data/raw-extension-2020/0654-2020-winter-23-question.pdf` (16 pages, internal code 0654/23/O/N/20) | `4f550f46475f2ea9e67204e85e65ac91b34bcb9cc0d289402e79706c9b7fd303` |
| Mark scheme, same folder, `0654-2020-winter-23-markscheme.pdf` (3 pages) | `3702242c8b496290a52d991a10905c625ac5efb6569814ee310e52b390d9d11c` |
| Principal Examiner Report `0654_w20_er.pdf` (60 pages), read from the PapaCambridge mirror as evidence only; never stored in Git or published | `dc3c11fbe120a4cb33b0d04b14f9a406d3cf902f880ed25b0e27b2332cf0e7f7` |

The served question paper and mark scheme are these exact bytes (the whole-paper archive pins the same two hashes).

## What is wrong

| Row | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|
| Mark scheme key | D | B | B | A | D | D | B | B |
| Examiner report key table | D | B | B | **B** | D | D | B | B |
| This paper's question | limewater, 10 breaths | auxin on one side | haploid cells | pedigree | ecosystem | eutrophication | sulfur + NaCl | most molecules |
| Answer to that question | **B** | **D** | B | **B** | **A** | D | **D** | B |

Key rows 8–14 hold the answers to questions 9–15, and row 15's B is also question 8's answer. The key was keyed to an order in which question 8 came after question 15. Rows 10, 13 and 15 carry the right letter by coincidence. The mark scheme and the examiner report's key table also disagree on row 11.

The question paper is the paper candidates sat: the examiner report's comments follow its numbering. "Question 12" (the ecosystem definition) was answered extremely well. "Question 14" is described as obtaining sodium chloride from a mixture with insoluble sulfur, which candidates understood very well; that is filtration then crystallisation, D, not the keyed B. "Question 17" names hydrogen combustion as the correct answer D, which matches this paper.

## Checks

- **Two independent solves.** I solved Q7–Q16 from the paper. A separate reviewer, given only the rendered question pages and no key, solved all 40. Both give Q8–Q15 = B D B B A D D B, all at high confidence. On the other 32 rows the blind solve matched the key except Q34, where the reviewer misread the diagram; D (total internal reflection) is right, as the examiner report also states.
- **Crops are not shifted.** The `mcq-answer-v2` crops (`docs/science-mcq-answer-row-repairs.md`) clip each question to the mark-scheme row whose printed number token is that question number. They copy the printed key faithfully, misprint included. A fresh check with pdfplumber (a different parser from the original PyMuPDF audit) covered all 3,240 repaired 0654 rows: each candidate WebP's SHA equals the overlay SHA, the pinned PDF hash matches, and the recorded bounds hold exactly the row's own number and the production `answer` letter. 0 failures. The 39 unrepaired rows are `0654-2023-summer-22`, whose letters the 2026-10-13 re-verification already matched to the key.
- **No other misaligned paper.** Every one of the 3,279 0654 MCQ rows has an explanation written against the key, with instructions to flag disagreements. Only `0654-2020-winter-23` has a run of flags (q8, q9, q11, q12, q14). The single-row flags elsewhere (`0654-2020-summer-13-q5`, `0654-2022-summer-1x-q17`, `0654-2022-summer-22-q24`) dispute wording, not row order. This is evidence, not a full independent solve of every 0654 paper.

Scripts and outputs are in `../research/mcq-key-misprint-0654-w20-23/` (`check_rows.py`, `check_rows.out`, `read_keys.py`, `keys.json`).

## Repair

Students never see the answer crop on an MCQ row with a letter: "Show answer" and PDF answers show the letter chip. The wrong letters came from the production `answer` field, so the repair is a reviewed-letter override, not new crops:

- `docs/0654-w20-23-mcq-key/mcq-answer-letters.json` (SHA-256 `7ae13a88b172860bed582ab608b4b49470aea5daedb2b5226b4d3ee49995643a`): q8 B, q9 D, q11 B, q12 A, q14 D. Each note says Cambridge's published key prints a different letter and that the answer shown is corrected, so the correction is never presented as official.
- Merged into `src/data/reviewed-mcq-answer-letters.json` like the May 2026 additions (receipt: `docs/reviewed-mcq-answer-letters.md`).

No storage object changes. The free index (`public/free-assets/*.json`) is generated from the asset manifest at build, so free visitors get the corrected letters on the next deploy. The whole-paper library keeps serving Cambridge's original mark-scheme PDF unchanged.

## Follow-ups

- The five held explanations (`research/explanations/igcse-coordinated-sciences-0654/0654-2020-winter-23-q{8,9,11,12,14}.json`) say "official answer may be wrong". Once this lands, rewrite them against the corrected letters before publishing. This belongs to the explanations session.
- Rollback: revert this change. The original key and crops are untouched.
