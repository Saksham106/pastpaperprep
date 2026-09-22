# Jev 2026-09-21 correction reconciliation

The final overlay contains **62 corrected rows** and **17 held rows**. Held rows
are not applied to production data.

| Bank | Corrected | Held | Note |
| --- | ---: | ---: | --- |
| Biology 0610 | 19 | — | Applied corrections |
| Chemistry 0620 | 37 | — | Applied corrections |
| Economics 0455 | 6 | — | Applied corrections |
| Maths 0580 | 0 | 1 | `0580-2026-june-23-q25` is held as `reject-current-correct` |

The 0580 row is already correctly classified on `origin/main` as `Probability`
with `Combined and conditional probability`. It is therefore excluded from the
applied correction overlay. Its held record contains source evidence only; no
Jev provenance is added to the unchanged question row.

The overlay remains fail-closed and idempotent: all 62 applied corrections must
match their recorded expected source state, all 17 held rows must remain
unchanged, and unrelated rows must remain byte-equivalent.
