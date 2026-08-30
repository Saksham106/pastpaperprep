# 0580 classification-v2 overlay

`scripts/generate_classification_v2_overlay.py` builds a new, canonical overlay
artifact from three frozen inputs:

- the complete frozen `src/data/raw/igcse.json`-shaped source;
- the refined 0580 taxonomy;
- a complete `production-review-root` produced by the production-aware review
  workflow.

It first invokes `validate_classification_v2_production_review.validate` and
requires `status=PASS` with `reviewed=expected=1629` by default. It refuses an
existing output path, rejects source/review/taxonomy drift, requires an exact
source-ID partition, verifies every reviewed `nonClassificationSha256`, and
writes `questions.json`, `overlay-report.json`, and `overlay-manifest.json`
atomically. The source and review artifacts are never modified.

## Fixture invocation

Use fixture-specific expected counts while testing:

```bash
python3.11 scripts/generate_classification_v2_overlay.py \
  --source-questions /tmp/fixture/source.json \
  --refined-taxonomy /tmp/fixture/taxonomy.json \
  --production-review-root /tmp/fixture/production-review \
  --output-root /tmp/fixture/overlay-one \
  --expected-source-count 3 \
  --expected-reviewed 3 \
  --expected-exact 0 \
  --asset-root /tmp/fixture
```

The default exact-match guard is 1055, with a complete disjoint 2684-question
partition of 1629 reviewed decisions plus 1055 source-blind exact matches.
The generator refuses to overwrite any output and does not mutate the source,
taxonomy, or review root.

The runtime mapper updates only classification fields already present in the
source. For 0580, which has no stored `skills` or `searchText`, it does not
synthesize either field. The application derives runtime skills as the union
of existing `subtopics` and `detailedSubtopics`, and builds transient search
text with the same normalization semantics used by `src/lib/questions.ts`.
`contextTags` are copied from an explicitly prescribed taxonomy-gap review
decision only when the source schema already contains `contextTags`.

## Tests

```bash
python3.11 scripts/test_generate_classification_v2_overlay.py -v
```

The test proves canonical deterministic rebuilds, source immutability,
output-overwrite refusal, pinned non-classification hash rejection, runtime
field mapping, and explicit context-tag handling.
