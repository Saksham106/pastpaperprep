# 0455 MS-crop repair — pilot receipt

**Date:** 2026-09-17
**Status:** COMPLETE for segmentation/assets. Runtime rewiring deliberately NOT done (see §6).

## 1. The defect (measured, not assumed)

`scripts/audit_ms_crop_coverage.py` measured every non-MCQ mark-scheme crop
against the printed ink of its source page:

- **175 / 175 structured questions** carried slivered MS crops (707 defective
  bands) in the sealed `data/segmentation/full/` manifest.
- Root cause: `segmentation_pilot._ms_page_crops` built each page's band from
  the part **label-line bboxes ±(8/15)pt**. Answer bullets, mark cells and
  level-table descriptors run 100+pt deeper than the label row, and
  continuation-page rows got top-strip slivers only
  (e.g. `0455-2021-m-22-q4` page 22 crop: 1263×**53px**, 35pt band).
- 0455's MS pages are **rotation=90 landscape tables**; all crop math runs in
  display space via `page.rotation_matrix` (this also corrected an audit-side
  coordinate-space bug: raw-space word boxes must be transformed before the
  inside-band test).

## 2. The fix (single choke point)

`segmentation_pilot._ms_page_crops` now derives each page band from the
question's **full printed row geometry**:

- top = first label row of this question on the page − 8pt (unchanged);
- bottom = deepest content line below that top, excluding page furniture
  (`MS_FURNITURE`) and later questions' label rows (same-page boundaries);
- clipped by the engine's existing 48pt header / 42pt footer margins;
- all math in display space (renderer-compatible on rotated pages).

Sealed artifacts were not edited: the repaired lane lives at
`data/segmentation/full-repaired/` (full manifest + assets + ledger), produced
by the unmodified `full_segmentation.py` pipeline from the patched engine.

## 3. Verification (control + treatment)

| Manifest | stray words | stray pages | papers affected |
|---|---|---|---|
| Sealed (defective) — **control** | 109,781 | 697 | 35 |
| `full-repaired` — **treatment** | **0** | **0** | **0** |

- Gate: per-page word attribution — every non-furniture word on every P2 MS
  page must fall inside some question's band. The old per-crop ratio rule is
  kept **informational only** (`small_share`), because pages shared by several
  questions legitimately give small per-question shares (this false-positive
  class appeared on `0455-2021-w-22` mid-page table-header repeats).
- Physical check: `0455-2021-m-22-q4` page-22 crop 1263×53px → **1263×337px**;
  `0455-2021-w-22-q2` page-11 crop 166px → 318px.
- Coverage: crop pages now equal `marking_rubric.pages` for every question.
- Determinism: two independent subset builds of `0455-2021-m-22` + `w-22`
  produced **byte-identical** `full-manifest.json` (sha `a4a7ba63895865fd…`).

## 4. Second defect found during the pilot (row loss, open)

`docs/row-loss-census-0455.json`: the sealed manifest offers **1,225**
questions (1,220 candidates + 5 officially discounted); the live runtime
serves **1,189**. **31 candidate rows are missing** from the v5 classification
artifacts (`full-selected-v5-additive/…` carry 1,190 rows and contain none of
the 31) and the loss is pinned as an expected count in
`pastpaperprep/src/lib/igcse-runtime.ts` (`[1189, 70]`). This is a separate,
pre-existing defect: silent row loss in the classification lineage, sealed
into the runtime. Fixing it requires a reviewed classification-side change and
an operator decision (this lane's scope was crops only).

## 5. Reproduction

```bash
# audit (control):            .venv/bin/python scripts/audit_ms_crop_coverage.py 0455
# audit (repaired lane):      AUDIT_MANIFEST_0455=data/segmentation/full-repaired/full-manifest.json \
#                               .venv/bin/python scripts/audit_ms_crop_coverage.py 0455
# rebuild:                    .venv/bin/python scripts/full_segmentation.py --output data/segmentation/full-repaired
```

Engine change is one function (`_ms_page_crops`) plus one regex (`MS_FURNITURE`);
the durable ledger's code-hash gate forces the fresh build by design.

## 6. Deliberately out of scope (next steps, in order)

1. **Runtime rewiring** — point the runtime generator at the repaired manifest,
   re-emit `src/data/local-preview/igcse-economics-0455.json`, unpin/raise the
   `[1189, 70]` count, and re-run focused tests + `tsc --noEmit`. Operator call
   because it touches the app repo.
2. **Row-loss repair** (§4) — restore the 31 dropped rows through the
   classification lineage with review, never by hand-editing runtime JSON.
3. **Port to 0610/0625/0654/0620** — same defect class (each bank's engine
   carries an equivalent band rule; physics also has QP slivers, 0654/0610 have
   mark-null and furniture debts per the cross-bank audit
   `pastpaperprep/docs/ms-crop-coverage-audit-all.json`).
