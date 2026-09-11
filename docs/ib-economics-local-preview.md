# IB Economics HL/SL local preview

This is a development-only preview integration. It does not add either Economics bank to the production catalog, public bank-index files, billing, entitlements, Supabase, or production asset storage.

## Source release seals

The read-only source repository is:

```text
/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice
```

The source rereview document records a PASS for local preview. Before refreshing the copied runtime records, run the source validators from the source repository:

```bash
cd /Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice
.venv/bin/python - <<'PY'
import json, sys
from pathlib import Path
root = Path('.')
sys.path.insert(0, str(root / 'scripts'))
from build_final_classifications_overlay import validate_final_classifications
from build_release_input_manifest import validate_release_inputs
print(validate_final_classifications(json.loads((root / 'data/classification/final-classifications.json').read_text()), root))
print(validate_release_inputs(json.loads((root / 'data/classification/release-inputs.json').read_text()), root))
PY
shasum -a 256 data/classification/final-classifications.json data/classification/release-inputs.json data/classification/release-taxonomy.json
```

The verified seal values used for this preview are:

```text
final-classifications.json  28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb
release-inputs.json         0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39
release-taxonomy.json       75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c
```

The copied local runtime records are sealed against the final artifact. Their runtime hashes are:

```text
src/data/local-preview/ib-economics-hl.json bf18f568dcd896679b19bb95ae2ea79a02cca54b54787cd35bbc3e356781da93
src/data/local-preview/ib-economics-sl.json 266d49669674396fad35812225d1306eda76f4faeafb886a102a1f23d5a32e47
src/data/ib-economics-taxonomy.json         75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c
```

These are preview-artifact counts, not production catalog counts: the local records contain the verified HL/SL question and paper sets, with their 16 shared question IDs represented in both level views. No production count, price, quota, or entitlement has been changed.

## Local asset setup

The source asset tree contains 475 question WebPs and 869 official-mark-scheme WebPs (1,344 total) under the mounted path. The local runtime JSON contains metadata and relative WebP paths only; these assets are read from the source checkout, with no asset upload or raw-PDF copy.

```bash
export NODE_ENV=development
export PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW=true
export PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT=/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice
```

The resolver serves only paths below:

```text
$PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT/site/assets/ib-economics/questions/<question-id>/*.webp
$PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT/site/assets/ib-economics/markschemes/<paper-or-question-id>/*.webp
```

It fails closed unless the explicit non-production feature flag is set, rejects traversal and unknown banks, and returns private/no-store responses. The local index and signing/PDF routes are separate from the existing authenticated Supabase routes. Local preview is not an entitlement bypass: Economics is absent from paid products and `hasBankAccess` returns false for both local slugs.

## Exact local verification commands

Run from the app repository with one already-installed native Node runtime and the existing lockfile dependencies:

```bash
cd /Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep
npx vitest run src/lib/ib-economics-local-preview.test.ts src/lib/local-preview.test.ts src/lib/local-preview-route.test.ts
npm test
npm run lint
npx tsc --noEmit
npm run build
```

The targeted integration suite covers exact HL/SL counts and paper/session/era scope, primary versus secondary topic filtering, subtopic/skill separation, protected metadata, entitlement denial, source provenance hashes, all 16 shared records, complete question/mark-scheme image sets, signing, PDF image preservation, feature-gate denial, and route traversal rejection.

## Pending gates

- Rights/publication review is still blocking production enablement (`unknown_publication_blocking`).
- The two slugs remain excluded from `BANKS`, generated public index files, checkout selection, Stripe/ProductId definitions, Supabase migrations/storage, production static params, and production deployment.
- No external payments, storage uploads, deploy, merge, or push is part of this preview.
- Parent visual/browser QA and any final product approval remain pending; this document makes no browser or screenshot claim.
