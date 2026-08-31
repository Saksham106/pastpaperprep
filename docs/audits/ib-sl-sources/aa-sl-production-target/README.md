# AA SL production target

This directory contains the immutable, validated full-bank release artifacts:

- `final-production-target.json` — exact ordered target for all 578 IDs.
- `final-corrections.json` — the 408 reviewed correction records.
- `final-provenance.json` and `final-report.json` — audit provenance and PASS report.
- `production-baseline-overlay.json` — ordered baseline tuples and per-question nonclassification hashes.
- `runtime-taxonomy.json` — pinned snapshot of the `ib-sl` ownership map in `src/lib/taxonomy.ts`.

The artifacts are pinned by SHA-256 in `scripts/aa_sl_production_audit.py` and
`src/lib/aa-sl-production-audit.test.ts`. Apply the target with:

```sh
python scripts/apply_aa_sl_production_target.py
python scripts/aa_sl_production_audit.py \
  --bank src/data/raw/ib-sl.json \
  --target docs/audits/ib-sl-sources/aa-sl-production-target/final-production-target.json \
  --baseline docs/audits/ib-sl-sources/aa-sl-production-target/production-baseline-overlay.json \
  --corrections docs/audits/ib-sl-sources/aa-sl-production-target/final-corrections.json \
  --runtime-taxonomy docs/audits/ib-sl-sources/aa-sl-production-target/runtime-taxonomy.json
```

The validator fails closed on missing/extra IDs, order drift, target/correction
partition drift, taxonomy ownership drift, nested classification mismatch,
nonclassification drift, and optional source/app tuple or nonclassification
parity mismatches.
