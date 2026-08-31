# 0606 finalized production target

This directory is the pinned provenance bundle for the reviewed full 0606 bank.

- `reviewed-production-target.json`: exact 1,633-record target; SHA-256 `695c0310314771077fef8666a7572cb7884f3f2318fa8afcd7b924f1c65f87b2`.
- `final-corrections.json`: exact 129 reviewed records, 118 changed and 11 kept; SHA-256 `8bf05339c97376891241af6bcbc4419365dc48e3d4249b6cee91ebad8a4afb12`.
- `production-baseline-overlay.json`: ordered baseline pinned to the prepared app raw bank, including nonclassification hashes for all 1,633 IDs.
- `correction-overlay-manifest.json`: correction records with decisions, evidence, recommended/final tuples, and artifact hashes.
- `runtime-taxonomy.json`: snapshot of the source runtime taxonomy and its pinned source hash.

`apply_0606_production_target.py` consumes this bundle fail-closed. The reviewed tuple's `skills` are primary-owner fine labels; app `subtopics` and `detailedSubtopics` use the sorted union of primary and structured secondary fine labels because the app schema has no separate structured `skills` field. App `secondaryTopics` remains the existing string-array schema. Correction evidence is copied into `classificationEvidence.provenance` with the correction artifact SHA, record ID, decision, and changed/no-op flag.
