# IB Economics local runtime repair and browser/PDF QA

**Captured:** 2026-09-10
**App:** `/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep`
**Read-only source:** `/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice`

## Outcome

- Local Next development runtime is unblocked on the Apple-silicon host.
- Real Ego browser QA completed for hydrated HL and SL bank pages.
- Question images, official answer images, topic/secondary-membership filters, year filters, and browser-triggered client PDF downloads were exercised.
- No app/source files, `package.json`, `package-lock.json`, generated bank data, deployment, commit, push, or external system was changed.
- Production remains out of scope and blocked by the existing rights/publication status.

## Root-cause reconciliation

The earlier `Ready in 341ms`/`Ready in 307ms` message was only Next's readiness banner. The same process then failed while loading configuration or compiling the first page. The durable first repro was:

```text
Ready in 307ms
Failed to load SWC binary for darwin/arm64 while loading next.config.ts
__NEXT_RC__1
```

Live inspection showed an Apple-silicon host (`uname -m=arm64`) but the default shell Node was the Rosetta x64 build (`v26.4.0`, `process.arch=x64`, `/usr/local/Cellar/node/26.4.0/bin/node`). The lockfile pins Next `16.3.4` and the arm64 SWC package at `16.3.4`, but the arm64 SWC package was absent while the x64 variant was present.

Installing the exact locked arm64 SWC tarball exposed the next missing platform dependency during real page compilation: `lightningcss-darwin-arm64@1.32.0`. Native Vitest then exposed two more missing optional variants: `@rollup/rollup-darwin-arm64@4.63.0` and `@esbuild/darwin-arm64@0.28.2`.

The repair was deliberately minimal: exact lock-matching tarballs were fetched with `npm pack`, integrity-checked against `package-lock.json`, and extracted only into the missing `node_modules` package directories. No blind upgrade, lockfile rewrite, `package.json` edit, or `node_modules` deletion was used. The server was then started with the native arm64 Node `v22.22.0`.

## Runtime and live health evidence

Server command:

```text
NODE_ENV=development PASTPAPERPREP_ENABLE_LOCAL_IB_ECONOMICS_PREVIEW=true PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT=/Users/sakshamgoel/Documents/ProjectsInternships/ib-economics-topic-practice /Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin/node ./node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100
```

- Server log: `/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/next-server.log`
- Native launch reported `Ready in 324ms` and `Running next.config.ts took 25ms`.
- Live listener remained on `127.0.0.1:3100` (final listener PID `95234`).
- Final HTTP checks: HL index `200`, `111` rows; SL index `200`, `89` rows; both bank pages `200` and contained the Question explorer.
- The server log records `200` responses for the bank pages, local indexes, signed assets, question/mark-scheme WebPs, and both PDF asset requests. No post-repair SWC, lightningcss, Rollup, or esbuild error remained.

### Installed exact lock-matching variants

| Package | Locked/installed version | Lock integrity verified |
|---|---:|---|
| `@next/swc-darwin-arm64` | `16.3.4` | `sha512-iBr3I5LZNk5/bgl5//iTgD2tcym14MX0Xo7fD//u9dYAEgGzza1y9oywluPtf74YnOswVdH1908aK9xVz7zQTw==` |
| `lightningcss-darwin-arm64` | `1.32.0` | `sha512-RzeG9Ju5bag2Bv1/lwlVJvBE3q6TtXskdZLLCyfg5pt+HLz9BqlICO7LZM7VHNTTn/5PRhHFBSjk5lc4cmscPQ==` |
| `@rollup/rollup-darwin-arm64` | `4.63.0` | `sha512-oI+ECtUcli0y0fi4xpW82GdPIXdTkI8G8DSjG2LRuw09fPAGykaWYH/hXxiKuTxiAjiPSTIIuYUqof5Z2hShWw==` |
| `@esbuild/darwin-arm64` | `0.28.2` | `sha512-n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw==` |

The pre-existing x64 variants remained in place; the native arm64 runtime and all four arm64 variants were independently verified with `file` and package metadata.

## Unit/route checks (separate from HTTP/browser proof)

Command:

```text
/Users/sakshamgoel/.nvm/versions/node/v22.22.0/bin/node ./node_modules/vitest/vitest.mjs run src/lib/ib-economics-local-preview.test.ts src/lib/local-preview-asset-security.test.ts src/lib/local-preview-route.test.ts src/lib/local-preview.test.ts
```

Result: **4 files passed, 18 tests passed**, exit code `0`.

Full output is preserved at `/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/unit-tests.log`. These are unit/route checks only; they are not counted as browser or HTTP proof.

## Real Ego browser proof

One Ego TaskSpace (`spaceId=3`) was used. The HL page was hydrated through a browser transport shim that changed only the stale `force-cache` request for `/api/local-preview-index/ib-economics-hl` to `no-store`; the request returned `200` with `111` rows and the DOM then showed the full catalog. This was needed because the pre-repair failed response remained cached in the existing browser page. The SL cold page hydrated normally with `89` rows. This transport/cache observation is retained as a QA caveat, not hidden as a pass.

### HL

- Hydrated result: **111 questions**, no alert after the cache-bypassed index request.
- First question image after scroll-into-view: `complete=true`, `naturalWidth=1191`, `naturalHeight=182`.
- First card answer opened through **Show answer**; all three official mark-scheme pages were requested and decoded after scrolling: `1191x1455`, `1191x1525`, `1191x1525`.
- Filter checks used counts computed from the live index and asserted against the rendered result heading:
  - Microeconomics topic membership (primary or secondary): `59` expected / `59 questions` rendered.
  - Global economy topic membership (primary or secondary): `60` expected / `60 questions` rendered.
  - Year `2025`: `29` expected / `29 questions` rendered; sampled cards all began with `2025`.
- Browser-triggered PDF: selected the first question, opened the real PDF dialog, clicked **Build PDF**, received a browser `download` event with `failure=null`, and saved `/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/ib-economics-hl-browser.pdf`.

### SL

- Hydrated result: **89 questions**, no alert.
- First question image after scroll-into-view: `complete=true`, `naturalWidth=1191`, `naturalHeight=156`.
- First card answer opened through **Show answer**; all three official mark-scheme pages were requested and decoded after scrolling: `1191x1455`, `1191x1525`, `1191x1525`.
- Filter checks used counts computed from the live index and asserted against the rendered result heading:
  - Microeconomics topic membership (primary or secondary): `44` expected / `44 questions` rendered.
  - Global economy topic membership (primary or secondary): `48` expected / `48 questions` rendered.
  - Year `2025`: `25` expected / `25 questions` rendered; sampled cards all began with `2025`.
- Browser-triggered PDF: selected the first question, opened the real PDF dialog, clicked **Build PDF**, received a browser `download` event with `failure=null`, and saved `/Users/sakshamgoel/privateQAevidence/ib-economics-runtime-repair-browser-qa/ib-economics-sl-browser.pdf`.

### Download verification

PyMuPDF reopened both saved browser downloads and verified four pages with nonempty image objects on every page (one question page plus three official-answer pages):

| Artifact | Bytes | Pages | Image objects per page | SHA-256 |
|---|---:|---:|---|---|
| `ib-economics-hl-browser.pdf` | `1,062,642` | `4` | `[5, 5, 5, 5]` | `c3c4da06177467cb6f9b4238e589943ffa0f200ea9488c0518bd704327fd57b9` |
| `ib-economics-sl-browser.pdf` | `1,075,083` | `4` | `[5, 5, 5, 5]` | `84d38c606ea238860f28da35b9ca5ad2cf4670b721c441305b0eb89a16045b16` |

## Remaining issues and boundary

- The initial documented x64/Rosetta launch still reproduces the misleading readiness-banner-then-SWC failure; use the native arm64 Node command above for this checkout.
- A stale cached HL index response produced a browser `500` for the component's `force-cache` fetch after the earlier failed server attempt. The actual QA used an in-page no-store transport shim and recorded the caveat. No app code was changed to mask it.
- No logged-out/entitled production browser mode was exercised; this remains a development-only preview with the explicit flag and source mount.
- No publish, deploy, commit, push, or cleanup of the repository's pre-existing dirty state was performed.
