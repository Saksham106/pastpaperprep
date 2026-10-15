# App branch feat/ib-ai-may-2026 (IB AI HL+SL May 2026): ready for owner decisions

Done and committed: raw bank splice (75 HL + 52 SL rows, existing rows byte-identical), whole-paper archive entries (9 HL + 6 SL), review receipts, tests, runbook (`docs/ib-ai-may-2026-official-papers.md`), upload plans (`docs/ib-ai-may-2026-r2-upload-plan.json`, `docs/ib-ai-may-2026-free-papers-upload-plan.json`).
Nothing uploaded, nothing merged, no PR.

Waiting on the owner: approval for the two uploads (415 crops / 27.6 MB to `pastpaperprep-assets`, 30 PDFs / 25.8 MB to `pastpaperprep-free`). After the PDF upload run `scripts/publish-added-free-papers.mts verify` (rewrites `src/data/paper-archive-readback.json`); `src/lib/whole-paper-public.test.ts` fails until then by design.
Source repos: `../../../ib-maths-ai-{hl,sl}-topic-practice-may-2026` (branch feat/official-may-2026), their `PAUSED.md` hold the source-side state.
