# 0580 classification overlay release gate

`scripts/validate_0580_classification_overlay.py` is a read-only, fail-closed
verifier for the artifact emitted by
`scripts/generate_classification_v2_overlay.py`. It also retains compatibility
with the older synthetic fixture manifest used by the unit tests.

## Run

Validate the first build and its independent deterministic rebuild together:

```bash
python3.11 scripts/validate_0580_classification_overlay.py \
  /tmp/ppp-overlay-final-a/overlay-manifest.json \
  --rebuild /tmp/ppp-overlay-final-b/overlay-manifest.json
```

Exit status `0` is the only release approval. The real generator contract
checks the source's exact 2,684-ID order, the historical sealed
`CLASSIFICATION_FIELDS` non-classification hash, refined-taxonomy ownership,
zero unresolved taxonomy gaps, production-review `PASS` with `1629/1629`
coverage, runtime-derived skills, search/filter discoverability using the
application's normalization semantics, and identical A/B output and report
hashes. It deliberately does not require or add stored `skills` or
`searchText` fields when the 0580 source schema lacks them.

The fixture regression suite is:

```bash
python3.11 scripts/test_validate_0580_classification_overlay.py
```
