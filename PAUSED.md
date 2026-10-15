# IB Chemistry May 2026 (app lane), 2026-10-15

Branch `feat/ib-chemistry-may-2026`. Source lane: `../ib-chemistry-topic-practice/.worktrees/may-2026` (branch feat/may-2026-official; its PAUSED.md has the lane state).
Done: rows appended (`scripts/add-ib-chemistry-2026.mjs --check`), MCQ letters (210), catalog/test counts, Full past papers (18), upload plans, runbook `docs/ib-chemistry-may-2026-official-papers.md`. Gates: lint 0 errors, typecheck, tests flags off/on (only `whole-paper-public.test.ts` readback fails until upload + `publish-added-free-papers.mts verify`), builds in both envs.
Next: owner approval for the two uploads, then `verify`, commit the refreshed `src/data/paper-archive-readback.json`, PR. No PR / merge yet.
Private archive state: `private/paper-archives/` (git-ignored); durable copy in research/ib-chemistry-may-2026-archive-state/.
