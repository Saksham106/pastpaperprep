# Bank page speed

Date: 2026-10-10
Status: approved in conversation (ranked plan; free-question links may be shared through the CDN for up to 15 minutes)

## Goal

Opening `/banks/[slug]` should show question images almost at once, with the same or lower Vercel Fluid Active CPU. Paid access stays exactly as strict as today.

## Baseline (production, 10 Oct 2026)

- Lighthouse mobile:
  - `/banks/igcse`: score 67, LCP 4.9 s, CLS 0.28, 632 KB JS (gzip).
  - `/banks/ib-chemistry-hl`: score 78, LCP 2.9 s, CLS 0.35.
- The bank HTML is static (CDN HIT, 148 ms). The first question image starts at **5.9 s cold** (about 0.6 s warm), because three requests run one after another:
  1. hydrate
  2. `GET /api/banks/bootstrap` (1.0 s cold, even for anonymous visitors)
  3. `POST /api/assets/sign` (3.9 s cold)
  4. then the image
- On a cold start, `/api/assets/sign` loads and normalizes the whole bank. Locally that took 150–860 ms of CPU and 270 MB–1 GB of memory, depending on the bank. `/api/study-state` does the same just to check that a question ID exists.
- Every page ships a 2 MB raw (262 KB gzip) client chunk. Most of it is the 0580 section-review ledger (1.3 MB JSON) and the 0610 era registry, which only server-side normalization needs.

## Decisions

### 1. No waterfall for anonymous visitors

- Supabase auth cookies are readable in the browser (`httpOnly: false`). If `document.cookie` has no `sb-*-auth-token` cookie, the explorer resolves access as anonymous locally and does not call `/api/banks/bootstrap`. When the cookie exists, bootstrap runs exactly as today.
- Free questions start signing as soon as the URL state is hydrated, without waiting for bootstrap (see 2). Locked questions still wait for bootstrap.
- The anonymous free-question cap (`ANONYMOUS_FREE_QUESTION_LIMIT`) and all upgrade UI behave as today.

### 2. CDN-cached links for free questions

- **New route** `GET /api/assets/free?bank=<slug>&id=<questionId>&kind=question|answer`:
  - It ignores cookies and sessions.
  - It answers only questions where `isPreviewQuestion(bank, id)` is true. Any other ID returns **403** with `Cache-Control: private, no-store`.
  - It signs with a 3600 s expiry, using the same provider choice as today (`previewAssetSignOptions`).
  - It returns the same asset shape as the POST route (`urls`, `details`, `displayCrops`), plus `expiresIn: 3600` and `maxAge: 900`.
- **Caching:**
  - A success response sends `Cache-Control: public, max-age=0, s-maxage=900`. The CDN then shares it for 15 minutes, so a cached link always has at least 45 minutes left.
  - Errors and 4xx responses are never cacheable.
- **One question per request**, so the cache key does not depend on the visitor's filters and hit rates stay high. HTTP/2 makes 24 small GETs cheap.
- **Proxy:** the matcher excludes this path, so cached hits run no proxy code.
- **Client:**
  - Free question images always use this route, for every visitor including subscribers. This doesn't change allowance accounting, because free paths are never counted today.
  - Locked or paid images keep using `POST /api/assets/sign`, unchanged.
  - The client assumes the worst-case CDN age: it treats an asset as expired after `expiresIn − maxAge − 300` seconds (40 minutes).
- **Download allowance:** `/api/assets/sign` behaviour is unchanged, and `consume_download_allowance` still applies only to premium paths.

### 3. Build-time server asset manifest

- **Generation:** a prebuild step (also run before tests) writes one server-only JSON per bank to `src/generated/asset-manifest/<bank>.json`. The directory is gitignored and not under `public/`. Each file maps question ID → `{ questionAssetPaths, markschemeAssetPaths, summary, accessibleText, solution, sourceQuestionUrl, sourceMarkSchemeUrl }`.
- **Same source as today:** the generator calls the existing `loadBankQuestions` under the build's own environment, so the manifest comes from the same normalization code the routes use now. Banks are processed one at a time to keep memory bounded.
- **Readers:** `authorizeAssetRequests`, the free route and `/api/study-state` read the manifest through a small cached loader, `loadBankAssetManifest(bank)`. Access checks (`canViewQuestionAsset`, `canViewAnswer`, `hasBankAccess`) are unchanged. `getQuestionRichDetails` is fed manifest fields instead of a full question.
- **Unchanged routes:** `/api/pdf/sign`, worksheets and search keep the full loader in this PR.

### 4. Smaller client bundle

- `igcse-0580-section-retrieval-v3.mjs` is split. A new light module (`igcse-0580-syllabus.mjs`) exports `IGCSE_0580_TOPICS` and `IGCSE_0580_SECTIONS` from the syllabus JSON only. The overlay module re-exports them and keeps `project0580Sections` for server and build use.
- The 0610 module stops importing the 705 KB classification taxonomy. It uses a committed, compact era registry (code → title, topic) derived from that taxonomy instead, and a test checks that the registry equals a projection of the full taxonomy.
- An import-graph test walks the client entry modules (`QuestionExplorer` and the lib modules it imports) and fails if they reach the 0580 overlay JSON or the full 0610 taxonomy.

### 5. Images and layout stability

- The bank page preconnects to the Supabase Storage origin, and to the R2 origin for R2-backed banks.
- The first image of the first question card loads eagerly with `fetchPriority="high"`. Other images stay lazy.
- The static HTML renders the anonymous state that visitors end up seeing: the free-value strip and the Access filter group. A signed-in subscriber is the only case where they disappear after bootstrap.
- The image placeholder keeps its current size. Question images range from short strips (about 1070×163) to full pages, so a fixed reservation would add shift rather than remove it.
- **Answer prefetch on intent:** pointer-enter, focus or touch-start on "Show answer" for a free question fetches the answer through the free route. Locked or paid answers still sign only on click, so hovering never spends download allowance.

## Out of scope

- List virtualisation: pages already load 24 at a time.
- Bank pages are already static, so no ISR change is needed.
- `/pricing`, `/login`, `/worksheets/build` and the exam-style pages stay dynamic (possible follow-up).
- Search, PDF and worksheet routes keep the full loader.
- Motion and transitions get their own spec and PR after this one.

## Overlap with other work

Item 4 changes shared lib modules that the landing page also imports, so its bundle gets smaller too. No landing-page files (`src/app/page.tsx`, `MarketingHome*`) are edited. The PR will say so.

## Workspace

Work happens on this session's isolated worktree branch, `claude/goofy-mendeleev-f6808e`. The harness blocks edits outside it, so the `.worktrees/` location from AGENTS.md wasn't usable here.

## Testing

- **Free route:**
  - A free ID gives 200 with public `s-maxage=900`.
  - A paid ID gives 403 with `no-store`, even with a valid session cookie.
  - An unknown bank or ID, a bad `kind`, or a provider failure gives 4xx/5xx with `no-store`.
  - The signing expiry is 3600 s.
  - No entitlements are read.
- **`/api/assets/sign` regression:** the existing access, allowance and paid-denial tests keep passing unchanged. A new test checks that the manifest-backed lookup gives the same paths and details as the full loader for a sample of free and paid questions in at least three banks, including one R2-backed bank.
- **`/api/study-state`:** an unknown question ID is still rejected and a known one is still accepted.
- **Manifest generator:** the output is deterministic and every ID in the bank appears once.
- **Explorer:**
  - With no auth cookie, bootstrap is never fetched and free questions sign immediately.
  - With an auth cookie, bootstrap is fetched and locked questions wait for it.
  - Free assets come from the GET route and paid ones from the POST route.
  - Hovering "Show answer" prefetches only for free questions.
- **Bundle:** the import-graph test, plus the before/after client chunk size from the build output.
- **Before/after numbers in the PR:**
  - Lighthouse mobile for `/`, `/pricing`, `/banks/igcse` and `/banks/ib-chemistry-hl` (production versus Vercel preview).
  - Cold and warm waterfall timings.
  - JS size (gzip).
  - Local cold `/api/assets/sign` CPU.

## Success criteria

- The first question image starts in under 1.5 s on a cold visit (from 5.9 s).
- Bank pages reach CLS below 0.1.
- Client JS on bank pages drops by at least 150 KB gzip.
- A cold `/api/assets/sign` spends under 50 ms of CPU on lookup locally.
- Every existing access test passes, and the new paid-denial tests pass.
