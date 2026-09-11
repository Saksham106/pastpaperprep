# IB Economics local-preview security fixes

## Outcome

Both blockers from `docs/ib-economics-preview-independent-review.md` are fixed fail-closed:

1. `isLocalEconomicsPreviewEnabled` now returns true only when `NODE_ENV === "development"` and `PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW === "true"`. Unset, empty, `test`, `staging`, `preview`, and `production` deny the preview.
2. The asset route now canonicalizes the mounted source root, asset root, and requested target with `realpath` before invoking the reader. The reader receives only a canonical target contained under the canonical mounted asset root. Outside targets reached through symlinks are rejected before any `readFile`.

The existing private mounted-asset response behavior and Economics bank loading/access behavior remain intact.

## Tests added or updated

- `src/lib/ib-economics-local-preview.test.ts`
  - Requires development plus the explicit flag.
  - Covers unset, empty, test, staging, preview, and production denial.
- `src/lib/local-preview-asset-security.test.ts`
  - Creates an outside target behind an allowed-looking symlink.
  - Injects a reader and proves it is never called, rather than checking only the HTTP status.
- `src/lib/local-preview-route.test.ts`
  - Uses the development gate for successful local-preview behavior.
  - Covers forwarded-host/proto header spoofing without changing the gate.

## Actual verification

Strict TDD red phase was observed before the implementation: the new gate assertion failed under the old non-production check, and the new containment test failed because the reader helper did not yet exist. After implementation and refactor:

```text
Focused Vitest:
  4 test files passed
  18 tests passed

Full Vitest (`npm test -- --reporter=dot`):
  82 test files passed
  389 tests passed

Lint (`npm run lint`): passed
TypeScript (`npx tsc --noEmit`): passed
```

Existing local preview server verification:

```text
Listener retained: 127.0.0.1:3100, PID 99072
Local Economics index: HTTP 200
Mounted question asset with Host/X-Forwarded-Host/X-Forwarded-Proto spoofing: HTTP 200
Traversal asset path: HTTP 404
Raw PDF asset path: HTTP 404
```

No second server was started. No build was run while the development server was active. No installs, commit, push, deploy, upload, or external-system writes were performed. Existing unrelated dirty files, Economics data, and historical review artifacts were not modified by this fix.

## Files modified by this fix

- `src/lib/banks.ts`
- `src/lib/local-preview.ts`
- `src/app/api/local-preview-assets/[...path]/route.ts`
- `src/lib/ib-economics-local-preview.test.ts`
- `src/lib/local-preview-route.test.ts`
- `src/lib/local-preview-asset-security.test.ts`
- `docs/ib-economics-preview-fixes.md`
