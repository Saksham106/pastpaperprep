# App branch feat/ib-ai-may-2026 (IB AI HL+SL May 2026): ready for owner decisions

Done and committed: raw bank splice (75 HL + 52 SL rows, existing rows byte-identical), whole-paper archive entries (9 HL + 6 SL), review receipts, tests, runbook (`docs/ib-ai-may-2026-official-papers.md`), upload plans (`docs/ib-ai-may-2026-r2-upload-plan.json`, `docs/ib-ai-may-2026-free-papers-upload-plan.json`).
Nothing uploaded, nothing merged, no PR.

Waiting on the owner: approval for the two uploads (415 crops / 27.6 MB to `pastpaperprep-assets`, 30 PDFs / 25.8 MB to `pastpaperprep-free`). After the PDF upload run `scripts/publish-added-free-papers.mts verify` (rewrites `src/data/paper-archive-readback.json`); `src/lib/whole-paper-public.test.ts` fails until then by design.
Source repos: `../../../ib-maths-ai-{hl,sl}-topic-practice-may-2026` (branch feat/official-may-2026), their `PAUSED.md` hold the source-side state.

## Owner review fixes (PR #300, reviewed head 342210b)
- P2 AI HL TZ3 P3 Q2: Functions secondary + quadratic-modelling skill via `docs/audits/ib-ai-may-2026-review-overlay.json` (applied by `scripts/add_ib_ai_may_2026.py`, checked by the review generator); archive runtimeSha256 and review receipt regenerated; test added.
- P2 catalog: ib-ai-hl 484/57/2021-2026, ib-ai-sl 386/44/2021-2026; test asserts agreement with runtime data.
- Docs: r2:sync is not create-only; runbook, planner comments and plan precondition reworded.
- Other 126 rows scanned: no further changes.
