# Reviewed IB AI-HL matrix boundary repair

Exact cohort: `2025-november-tz0-p1-q12` and `2025-november-tz0-p1-q13`, bank `ib-ai-hl`.

Pinned official source PDF SHA-256: `2a2febabcc934f515f8637d3fa3353596e6a9d5fc7d617471bfd51eabd68cc4b`.

- Q12 is complete on source page 15, through **Total [8 marks]**. Its page-16 tail contains only document furniture and a fragment of Q13's vector. Retire that exact tail from the runtime projection, retaining the original stored asset, raw runtime, transcript and source classification.
- Q13's page-16 crop clips the first vector entry **7**. Expand its top boundary from 98.778 to 80 PDF points, retaining the width and bottom boundary. Add exactly 32 source-owned raster rows at the existing 1.75 pixel/point grid origin; preserve every previously decoded RGB pixel and save losslessly. This is narrow additive restoration, not a new whole-bank DPI assumption.
- All three original images were read from production R2 and matched by full SHA-256 and exact key. `matrix-family-live-original-readback.json` and `matrix-family/candidate.json` remain in the source research directory. Independent source review `deleg_5877d240` approved this pair only.

`src/data/reviewed-ib-matrix-head-repairs.json` is an exact old-path-bound projection. Stale paths fail closed. Only AI-HL answer normalization activates it; QP images and all other questions/banks retain their existing paths. The public index changes only Q12's answer image count from two to one.

The immutable one-object manifest and full-GET SHA/size/type receipt are under `data/storage/ib-matrix-head-repairs.*.json`. Upload is conditional create-only, uses the existing path/FD race guard, and never deletes source objects. Temporary bucket-scoped write access was revoked and its private file deleted after verified upload; production read-only tokens remain active.

Release gates include actual legacy-loader tests, index metadata, stale-path rejection, receipt binding, coexistence with earlier IGCSE repairs, production build and real-browser PDF/export verification. This does not clear the remaining IB diagnostic flags or held cohorts.
