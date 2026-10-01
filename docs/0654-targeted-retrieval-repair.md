# 0654 targeted missing-section repair

Adds 65 current-section links across 64 unchanged served source records. Jev screened 200 source-text candidates against four exact definitions in the Cambridge 2025–27 PDF (SHA 6d46e4a07a512a12c80cbfc0d0715e2b4198f1faf76a5bb8d31f8d97ab6274f2), then an independent reader adjudicated 65 full texts. Parent checked counterexamples and corrected one missed Energy flow assignment: 2021 winter 33 q4 part (d) asks the principal energy source. 2023 March 22 q12 is not added just because its diagram says energy flow.

| Section | Before | Candidate |
|---|---:|---:|
| Drugs B14.1 | 0 | 4 |
| Energy flow B18.1 | 0 | 1 |
| Carbon cycle B18.3 | 0 | 20 |
| The nucleus P5.1 | 0 | 40 |

The nucleus is the Physics atomic-nucleus section, not a biological cell nucleus. Existing source/runtime bytes, all 4,721 IDs, prior primary ownership and prior labels are preserved. Additions have exact row identity/text fingerprints, source SHA, official definition binding and per-row evidence. Other 18 bank immutable indexes are byte-identical to deployed baseline.

Validation: targeted tests 9/9; TypeScript, ESLint, index generation, webpack production build, diff check pass. Full suite 1,190 pass / 2 pre-existing CSS failures, identical exact failing names to current-main baseline. Candidate immutable index hash 1a166cf7dd91 (full hash in manifest).

Assurance: source-transcript and bounded full-text adjudication, not fresh full printed-paper/asset verification. Narrow closure of four empty filters; other thin filters remain a separate queue. Not yet deployed.
