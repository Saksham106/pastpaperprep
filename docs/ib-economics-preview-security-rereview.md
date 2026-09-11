# IB Economics local-preview security re-review

## Verdict

**PASS — localpreviewonly. Production remains blocked: rights status is `unknown_publication_blocking`.**

Both blockers from `docs/ib-economics-preview-independent-review.md` are independently closed in the current source:

1. The preview gate requires both `NODE_ENV === "development"` and `PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW === "true"`.
2. The asset reader canonicalizes the mounted root, mounted Economics asset root, and requested target before invoking the reader, then rejects targets outside the canonical asset root.

This is not production approval. The Economics banks remain local-preview candidates with `productionEnabled: false`, no entitlement product, and rights status `unknown_publication_blocking`.

## Scope and non-modification boundary

- App reviewed: `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep`.
- Inputs read: `docs/ib-economics-preview-independent-review.md`, `docs/ib-economics-preview-fixes.md`, the gate/routes/security tests, asset-access and original-bank access code, and the relevant production-bank/index files.
- The checkout was already dirty with the Economics integration and unrelated changes before this review. No existing source, test, data, generated index, external system, commit, upload, deployment, or server was changed by this review.
- The existing server was retained: `127.0.0.1:3100`, PID `99072`. No second server and no build were started.
- This report is the only file created by this review: `docs/ib-economics-preview-security-rereview.md`.

## Gate closure

Source inspection of `src/lib/banks.ts:225-230` and all four local-preview routes confirms that the same explicit gate is checked before local index, signing, PDF, or asset delivery. The gate matrix was exercised independently against the helper and the index route:

| `NODE_ENV` | Flag `true` | Gate helper | Index route |
|---|---:|---:|---:|
| unset | yes | `false` | HTTP `404` |
| empty | yes | `false` | HTTP `404` |
| `test` | yes | `false` | HTTP `404` |
| `staging` | yes | `false` | HTTP `404` |
| `preview` | yes | `false` | HTTP `404` |
| `production` | yes | `false` | HTTP `404` |
| `development` | yes | `true` | HTTP `200` |

The explicit flag is also denied when it is not exactly `"true"`. The routes do not inspect `Host`, `X-Forwarded-Host`, or `X-Forwarded-Proto`; the forwarded-header regression test passed, and a real request carrying all three spoofed headers still served only the valid development request rather than changing authorization.

## Canonical containment closure

`src/lib/local-preview.ts:51-64` now performs this order:

1. `realpath(resolve(sourceRoot))` for the mounted source root.
2. `realpath` of the mounted `site/assets/ib-economics` root.
3. Validated candidate resolution under the mounted root.
4. `realpath(candidate)` for the requested target.
5. Containment check against the canonical mounted asset root.
6. Only then `reader(canonicalTarget)`; the default reader is `readFile`.

The route at `src/app/api/local-preview-assets/[...path]/route.ts:9-18` has no independent read path and delegates to this helper. The focused symlink test creates an allowed-looking WebP symlink to an outside file, injects a reader, and asserts both rejection and zero reader calls. It passed. Traversal, raw PDF, unknown-bank, and absolute/root-resolution cases are covered by the local-preview boundary tests and the route test; live traversal and raw-PDF requests both returned `404`.

A behavioral old-order probe confirmed the regression is meaningful: a read-before-containment implementation calls its reader once on the outside-target symlink (`readerCalled: 1`). The current injected-reader test requires `0`, so it would fail that implementation. The historical pre-fix source is not present in committed Git history; no repository mutation was performed to manufacture a red run.

## Targeted and full verification

Fresh execution, independent of the worker report:

```text
Focused local-preview/security suite:
  4 test files passed
  18 tests passed

Full Vitest:
  82 test files passed
  389 tests passed

Original asset/access safety suite:
  5 test files passed
  28 tests passed

npm run lint:
  passed

npx tsc --noEmit:
  passed
```

The focused suite covered the explicit environment matrix, local-bank counts and loading, protected index shape, entitlement denial, local signing/PDF selection, valid mounted image delivery, traversal rejection, outside-target symlink rejection before reader invocation, and forwarded-header spoofing.

The prior gate regression is also directly distinguishable from the old predicate: the old `NODE_ENV !== "production" && flag === "true"` behavior returns `true` for unset, empty, `test`, `staging`, and `preview`; the current implementation and route matrix return `false`/`404` for each.

## Safe assets and original bank access

- `authorizeLocalPreviewAssetRequests` accepts only the two Economics preview slugs and canonical question/answer IDs; local sign/PDF routes remain behind the explicit development gate and use private/no-store responses.
- The original `/api/assets/sign` and `/api/pdf/sign` paths continue using the production authorization functions, entitlements, and private asset signing. The original asset/access, private-assets, question-delivery, and signed-assets tests passed: 28/28.
- `hasBankAccess` explicitly denies both Economics local-preview slugs, including with an active `bundle_all` entitlement.
- The live server checks passed: valid local index `200`, valid mounted WebP with spoofed headers `200 image/webp`, traversal `404`, and raw PDF `404`.

## Production twelve-bank protection

- The current production `BANKS` slug sequence is byte/sequence-equivalent to `HEAD`: exactly these 12 slugs, with no Economics slug: `igcse`, `igcse-additional`, `ib-hl`, `ib-sl`, `ib-ai-hl`, `ib-ai-sl`, `ib-chemistry-hl`, `ib-chemistry-sl`, `ib-physics-hl`, `ib-physics-sl`, `ib-biology-hl`, `ib-biology-sl`.
- `BANKS.length` remains `12`; production-mode `getAvailableBanks` remains `12` and contains no Economics bank.
- `src/lib/bank-index-manifest.ts` is unchanged from `HEAD`.
- Economics remains outside paid access and production catalog/index behavior. Rights are unresolved, so no production publication or entitlement conclusion is authorized.

## Final disposition

**PASS localpreviewonly.** Both security blockers are closed and the required tests/gates pass. Keep the Economics preview development-only and do not promote, publish, monetize, or deploy it until publication rights are independently established and a separate production release review approves that change.
