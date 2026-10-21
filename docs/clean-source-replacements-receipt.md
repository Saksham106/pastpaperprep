# Clean copies of host-stamped papers in Full past papers: receipt (21 October 2026)

A read-only scan of all 5,480 published Full past papers PDFs found 419 that carry a "bestexamhelp.com" stamp. The stamp is one vertical line in the right margin of page 1. The owner approved finding and publishing clean copies in chat. Scan evidence is in `research/stamp-scan/`.

| Bank | Stamped PDFs | Years |
|---|---:|---|
| Mathematics 0580 | 112 | 2016–2019 |
| Additional Mathematics 0606 | 111 | 2016–2019 |
| Biology 0610 | 84 | 2019 |
| Physics 0625 | 84 | 2019 |
| Economics 0455 | 28 | 2019 |

There are 210 question papers and 209 mark schemes, spread across 210 papers. Every other bank, all IB banks included, scanned clean.

The topic banks are unaffected: their crops come from inside pages, never the cover.

## Clean copies
Sources:
- pastpapers.co: 261
- smartexamresources.com: 106
- cienotes.com: 51
- smarteduhub.com: 1

Every accepted copy:
- has no host stamp on `scan-source-watermarks.py` (all 419 re-scanned before upload);
- has the same page count as the file it replaces;
- has identical text on every page once the stamp is removed;
- carries Cambridge producer metadata (Acrobat Distiller or Adobe PDF Library).

One exception was accepted on review: the 0606 June 2018 Paper 22 mark scheme. It differs only in page 4's hidden text layer ("PUBLISHE"/"PUBLISHED" and one digit). The copy is byte-identical on two mirrors, and its render difference matches the other accepted files.

Rejected mirrors:
- papers.xtremepape.rs and dynamicpapers.com: every file is stamped.
- smartexamresources' 2017 0580 June/November question papers: a visible per-question overlay.

## Publish
- **Replacement map:** `data/paper-archives/clean-source-replacements.json` (stamped SHA-256 → clean SHA-256, bytes, pages, source URL).
- **Manifest update:** `scripts/apply-clean-source-replacements.mts` rewrites the manifests. It fails unless each replacement names its exact paper and role.
- **Publish:** `scripts/publish-added-free-papers.mts`. Plan: 419 PDFs (426.0 MB). Upload is add-only (check-absent → put → read-back): 419 of 419 read back, with 0 conflicts.
- **Download names:** unchanged.
- **Stamped objects:** stay in the bucket, unreferenced. Deleting them needs separate owner approval.
- **Log:** `docs/clean-source-replacements-r2-upload-log.jsonl`.
