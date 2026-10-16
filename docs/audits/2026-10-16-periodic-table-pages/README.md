# Periodic Table pages on question crops (2026-10-16)

Cambridge Chemistry 0620 and Co-ordinated Sciences 0654 papers print "The Periodic Table of
Elements" on their last page. Segmentation attached that page to each paper's final question, so
students saw it as part of that question and PDFs printed it as "Question N (continued)".

**Change:** 375 crops are added to `src/data/retired-question-crops.json` (page furniture). This hides
them from the site, worksheets and PDF exports. Storage objects, release manifests and receipts are
untouched.

| Bank | Retired |
|---|---|
| Chemistry 0620 | 211 |
| Co-ordinated Sciences 0654 | 164 |

**Method (automated):**
`python3 -I scripts/audit-periodic-table-pages.py --projects <dir with the *-topic-practice repos> [--write | --check]`

- The source page carries the Periodic Table heading.
- Once the table's own vocabulary is removed, nothing is left. That vocabulary is element numbers,
  symbols, names and masses, Group I–VIII, the key, lanthanoids/actinoids and the r.t.p. note.
  The blank-page audit's acknowledgement and page-furniture patterns are removed too.
- The released bytes match the storage manifest.
- Every question keeps another image.

`0654-2025-winter-31-q5` mentions the Periodic Table in a question and is correctly left alone.
Its own test pins that. A visual sample of matched pages showed only the Periodic Table.

`receipt.json` lists each retired crop with its image SHA-256, source page and source PDF SHA-256.
