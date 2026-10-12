# PR229 explorer lifecycle verification

Baseline: `af99676` (this worker's isolated worktree). No provider calls, real browser cookies, generated bank sources, or full-repository gates were used.

## RED

The first mounted-signout regression was added and run before production edits:

```sh
npx vitest run src/components/QuestionExplorer.lifecycle.test.tsx --maxWorkers=1
```

Result: **1 failed**. The original question image still had `https://assets.example/A.webp` after deleting the test session cookie and calling the real `setSessionHint(false)` helper.

The expanded lifecycle tests were also exercised against the original Explorer implementation by temporarily reversing only its local diff, then restoring that diff:

```text
Test Files  1 failed (1)
     Tests  10 failed (10)
```

Observed failures included retained signed images/practised state after account changes, B waiting on A's signer, late bootstrap access written into A's cache after signout, stale bank-local catalog state, no reaction to focus/visibility/CookieStore changes, and adoption of a paid image cached under `anonymous`.

The added A-B-A regression was separately exercised against the original Explorer:

```text
Test Files  1 failed (1)
     Tests  1 failed | 10 skipped (11)
```

An additional vertical regression exposed a late A answer issuing `/api/study-state` after B took over even after the initial lifecycle boundary fix. It failed with `expected ... length 0 but got 1`; callback dispatch/completion guards fixed it.

## GREEN

Final focused command (Node 22.22.0, Vitest 3.2.7):

```sh
npx vitest run \
  src/components/QuestionExplorer.lifecycle.test.tsx \
  src/components/QuestionExplorer.test.tsx \
  src/components/QuestionExplorer.hydration.test.tsx \
  src/components/QuestionExplorer.asset-telemetry.test.tsx \
  src/components/QuestionExplorer.explanation.test.tsx \
  --maxWorkers=1
```

```text
Test Files  5 passed (5)
     Tests  101 passed (101)
```

The existing raw hydration test printed React testing-environment `act(...)` warnings; assertions passed. Focused ESLint on the three changed source/test files and `git diff --check` both exited zero with no diagnostics.

## Boundaries and integration

- `QuestionExplorer` is now keyed by actual session owner and bank. Owner/bank remounts clear component-local links, merged details, answer panels, study/access/export state, worksheet state, and pending ownership together.
- Requests capture the mount's owner. Completion checks both current cookies and the mount's active-generation ref. Old mounts remain dead even if an equal owner identifier returns in A-B-A.
- No private-cache read/write uses the `anonymous` fallback. A null owner bypasses private cache reuse.
- `setSessionHint` emits a narrow session-change event. Subscription also observes CookieStore changes, focus, storage, and visibility without auth polling or additional auth network calls.
- Cache-worker APIs remain untouched; the parent will integrate its opaque exact-cookie owner implementation.
- Quota/prefetch intent stays untouched. Parent integration must preserve `scopeIsCurrent()` at the beginning of the signer completion/finally path, before releasing pending keys or bumping the free-prefetch retry epoch.
- Existing warm cached-access signing, same-session reopening, valid answers, image retry, explanation behavior, and URL hydration passed the focused regressions.
