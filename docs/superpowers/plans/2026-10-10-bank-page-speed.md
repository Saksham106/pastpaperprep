# Bank Page Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show bank-page question images in under 1.5 s on a cold visit, with the same or lower Vercel Active CPU and unchanged paid access.

**Architecture:**
- A build-time, server-only asset manifest replaces whole-bank normalization in the hot routes.
- Free questions get a cookie-less GET route that the CDN caches.
- The explorer stops waiting on bootstrap for anonymous visitors and renders the anonymous default in the static HTML.
- Client modules import compact taxonomy slices instead of server-only ledgers.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest + Testing Library, Supabase Storage / Cloudflare R2 signed URLs, tsx for build scripts.

**Spec:** `docs/superpowers/specs/2026-10-10-bank-page-speed-design.md`

## Global Constraints

- Paid (non-preview) question and mark-scheme assets must never be served by the cacheable route, and must never be cached publicly.
- Free route success: `Cache-Control: public, max-age=0, s-maxage=900`. Signing expiry: `3600` seconds. Every error: `Cache-Control: private, no-store, max-age=0`.
- `POST /api/assets/sign` keeps its access checks and `consume_download_allowance` behaviour unchanged.
- The generated manifest lives in `generated/asset-manifest/` (gitignored) and is never under `public/`.
- Don't edit `src/app/page.tsx` or `src/components/MarketingHome*`.
- No new runtime dependencies.
- Copy stays as it is. Add no new helper text.
- Before the PR: `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass. When running vitest directly, exclude `.claude/**` and `.worktrees/**`:

  `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' <files>`
- Work in this worktree (`claude/goofy-mendeleev-f6808e`). Never touch other branches or stashes.

## Review Focus

1. **A paid ID on the free route, with a subscriber's auth cookie attached.** Expect 403 with `no-store`, and no signing call. Test: Task 2, Step 1, "rejects paid ids even with a session cookie".
2. **A CDN-served free link up to 15 minutes old.** The client expiry must be conservative (`expiresIn − maxAge − 300` s) so lazily loaded images don't fail. A failed image re-signs through the free route. Tests: Task 2, Step 5, "treats cached free links conservatively"; Task 3, Step 1, "re-signs a failed free image through the free route".
3. **A production manifest file that is missing or was built for another runtime mode.** The loader falls back to the full loader instead of returning 500. Test: Task 1, Step 1, "falls back when the generated file is missing".
4. **An auth cookie whose session has expired.** Bootstrap runs and returns anonymous. Free images must still load without waiting for it. Test: Task 3, Step 1, "signs free questions before bootstrap resolves".
5. **A subscriber with an auth cookie.** Bootstrap still runs, locked questions sign through POST after it resolves, and the provisional free filter isn't applied after mount. Test: Task 4, Step 1, "keeps the member view provisional until bootstrap".

---

### Task 1: Server asset manifest

**Files:**
- Create: `src/lib/asset-manifest.ts`
- Create: `src/lib/asset-manifest.test.ts`
- Create: `scripts/generate-asset-manifest.mts`
- Modify: `src/lib/question-loader.ts` (export `bankRuntimeCacheKey`)
- Modify: `src/lib/question-delivery.ts` (add `richDetailsFor`)
- Modify: `src/lib/asset-access.ts` (add `authorizeManifestAssetRequests`)
- Modify: `src/app/api/assets/sign/route.ts`
- Modify: `src/app/api/study-state/route.ts`
- Modify: `package.json` (`generate:asset-manifest`; `prebuild` runs it)
- Modify: `.gitignore` (`/generated/`)
- Modify: `next.config.ts` (`outputFileTracingIncludes`)
- Test: `src/app/api/assets/sign/route.test.ts` (existing, must stay green), `src/app/api/study-state/route.test.ts` (create if missing)

**Interfaces:**
- Produces:
  - `type AssetManifestEntry = { questionAssetPaths: string[]; markschemeAssetPaths: string[]; details: QuestionRichDetails }`
  - `buildBankAssetManifest(questions: readonly UnifiedQuestion[]): Record<string, AssetManifestEntry>`
  - `assetManifestFileName(slug: BankSlug): string`, which returns `"<slug>.<production|preview>.json"`
  - `loadBankAssetManifest(slug: BankSlug, options?: { directory?: string; useGenerated?: boolean }): Promise<ReadonlyMap<string, AssetManifestEntry>>`
  - `richDetailsFor(bankSlug: BankSlug, questionId: string, details: QuestionRichDetails, entitlements: readonly AccessEntitlement[], now?: Date, allowLocalPreview?: boolean): QuestionRichDetails`
  - `authorizeManifestAssetRequests(bankSlug, requests, entitlements, now?): Promise<Array<AssetRequest & { paths: string[]; details: QuestionRichDetails }>>`
  - `bankRuntimeCacheKey(slug: BankSlug): string` (now exported)

- [ ] **Step 1: Write the failing tests**

`src/lib/asset-manifest.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetManifestFileName, buildBankAssetManifest, loadBankAssetManifest } from "@/lib/asset-manifest";
import { loadBankQuestions } from "@/lib/question-loader";
import type { BankSlug } from "@/lib/banks";

describe("bank asset manifest", () => {
  it.each(["ib-sl", "igcse-additional", "igcse-economics-0455"] as BankSlug[])("matches the full loader for %s", async (slug) => {
    const questions = await loadBankQuestions(slug).catch(() => null);
    if (!questions) return; // gated bank not enabled in this environment
    const manifest = buildBankAssetManifest(questions);
    expect(Object.keys(manifest)).toHaveLength(questions.length);
    for (const question of [questions[0], questions[Math.floor(questions.length / 2)], questions.at(-1)!]) {
      expect(manifest[question.id]).toEqual({
        questionAssetPaths: question.questionAssetPaths,
        markschemeAssetPaths: question.markschemeAssetPaths,
        details: {
          summary: question.summary,
          accessibleText: question.accessibleText,
          solution: question.solution,
          sourceQuestionUrl: question.sourceQuestionUrl,
          sourceMarkSchemeUrl: question.sourceMarkSchemeUrl,
        },
      });
    }
  });

  it("is deterministic", async () => {
    const questions = await loadBankQuestions("ib-sl");
    expect(JSON.stringify(buildBankAssetManifest(questions))).toBe(JSON.stringify(buildBankAssetManifest([...questions])));
  });

  it("reads a generated file when present", async () => {
    const directory = mkdtempSync(join(tmpdir(), "asset-manifest-"));
    writeFileSync(join(directory, assetManifestFileName("ib-sl")), JSON.stringify({
      "x-q1": { questionAssetPaths: ["a.webp"], markschemeAssetPaths: [], details: { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null } },
    }));
    const manifest = await loadBankAssetManifest("ib-sl", { directory, useGenerated: true });
    expect(manifest.get("x-q1")?.questionAssetPaths).toEqual(["a.webp"]);
  });

  it("falls back when the generated file is missing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "asset-manifest-empty-"));
    const manifest = await loadBankAssetManifest("ib-sl", { directory, useGenerated: true });
    const questions = await loadBankQuestions("ib-sl");
    expect(manifest.size).toBe(questions.length);
  });
});
```

Add to `src/app/api/study-state/route.test.ts` (create it with the same Supabase mocking pattern as `src/app/api/assets/sign/route.test.ts`):

```ts
it("rejects unknown questions before authentication", async () => {
  const response = await POST(new Request("https://pastpaperprep.com/api/study-state", { method: "POST", body: JSON.stringify({ bank: "ib-sl", questionId: "not-a-question", action: "save" }) }));
  expect(response.status).toBe(400);
  expect(getClaims).not.toHaveBeenCalled();
});
it("accepts a known question", async () => {
  const response = await POST(new Request("https://pastpaperprep.com/api/study-state", { method: "POST", body: JSON.stringify({ bank: "ib-sl", questionId: "2017-may-p1-tz1-q1", action: "attempt" }) }));
  expect(response.status).toBe(200);
});
```

(If `route.test.ts` for study-state already exists, add only these two cases to it.)

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/asset-manifest.test.ts`

Expected: FAIL, "Cannot find module '@/lib/asset-manifest'".

- [ ] **Step 3: Implement**

`src/lib/question-loader.ts`: change `function bankRuntimeCacheKey` to `export function bankRuntimeCacheKey`.

`src/lib/question-delivery.ts`: add the following below `getQuestionRichDetails`, then make `getQuestionRichDetails` return `richDetailsFor(question.bankSlug, question.id, { summary: question.summary, accessibleText: question.accessibleText, solution: question.solution, sourceQuestionUrl: question.sourceQuestionUrl, sourceMarkSchemeUrl: question.sourceMarkSchemeUrl }, entitlements, now, allowLocalPreview)`.

```ts
/** Same gating as prepareQuestionsForDelivery, for callers that hold only manifest fields. */
export function richDetailsFor(
  bankSlug: BankSlug,
  questionId: string,
  details: QuestionRichDetails,
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
  allowLocalPreview = false,
): QuestionRichDetails {
  const localPreview = allowLocalPreview && isLocalEconomicsBank(bankSlug);
  const canViewQuestion = localPreview || canViewQuestionAsset(bankSlug, questionId, entitlements, now);
  const canViewQuestionAnswer = localPreview || canViewAnswer(bankSlug, questionId, entitlements, now);
  return {
    summary: canViewQuestion ? details.summary : "",
    accessibleText: canViewQuestion ? details.accessibleText : "",
    solution: canViewQuestionAnswer ? details.solution : null,
    sourceQuestionUrl: canViewQuestion ? details.sourceQuestionUrl : null,
    sourceMarkSchemeUrl: canViewQuestionAnswer ? details.sourceMarkSchemeUrl : null,
  };
}
```

(Import `type BankSlug` from `@/lib/banks`.) Keep `getQuestionRichDetails`'s exact output: the existing tests in `src/lib/question-delivery*.test.ts` must stay green.

`src/lib/asset-manifest.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BankSlug } from "@/lib/banks";
import { bankRuntimeCacheKey, loadBankQuestions } from "@/lib/question-loader";
import type { QuestionRichDetails, UnifiedQuestion } from "@/lib/questions";

export type AssetManifestEntry = { questionAssetPaths: string[]; markschemeAssetPaths: string[]; details: QuestionRichDetails };

export const ASSET_MANIFEST_DIRECTORY = join(process.cwd(), "generated", "asset-manifest");

export function buildBankAssetManifest(questions: readonly UnifiedQuestion[]): Record<string, AssetManifestEntry> {
  const manifest: Record<string, AssetManifestEntry> = {};
  for (const question of questions) {
    manifest[question.id] = {
      questionAssetPaths: question.questionAssetPaths,
      markschemeAssetPaths: question.markschemeAssetPaths,
      details: {
        summary: question.summary,
        accessibleText: question.accessibleText,
        solution: question.solution,
        sourceQuestionUrl: question.sourceQuestionUrl,
        sourceMarkSchemeUrl: question.sourceMarkSchemeUrl,
      },
    };
  }
  return manifest;
}

/** The runtime mode is part of the name, so a flag flip never reads a manifest built for the other mode. */
export function assetManifestFileName(slug: BankSlug): string {
  return `${bankRuntimeCacheKey(slug).replace(":", ".")}.json`;
}

const cache = new Map<string, Promise<ReadonlyMap<string, AssetManifestEntry>>>();

async function readGenerated(directory: string, slug: BankSlug) {
  try {
    return JSON.parse(await readFile(join(directory, assetManifestFileName(slug)), "utf8")) as Record<string, AssetManifestEntry>;
  } catch {
    return null;
  }
}

/**
 * Asset paths and rich details for one bank, without normalizing the whole corpus.
 * Production reads the prebuild output; everywhere else (and when that file is missing)
 * it derives the same data from the full loader.
 */
export function loadBankAssetManifest(
  slug: BankSlug,
  { directory = ASSET_MANIFEST_DIRECTORY, useGenerated = process.env.NODE_ENV === "production" }: { directory?: string; useGenerated?: boolean } = {},
): Promise<ReadonlyMap<string, AssetManifestEntry>> {
  const key = `${directory}:${useGenerated}:${bankRuntimeCacheKey(slug)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const loaded = (async () => {
    const generated = useGenerated ? await readGenerated(directory, slug) : null;
    const record = generated ?? buildBankAssetManifest(await loadBankQuestions(slug));
    return new Map(Object.entries(record));
  })();
  cache.set(key, loaded);
  void loaded.catch(() => { if (cache.get(key) === loaded) cache.delete(key); });
  return loaded;
}
```

`src/lib/asset-access.ts`: add the following (keep `authorizeAssetRequests` for `/api/pdf/sign`):

```ts
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import type { QuestionRichDetails } from "@/lib/questions";

export type ManifestAuthorizedAssetRequest = AssetRequest & { paths: string[]; details: QuestionRichDetails };

export async function authorizeManifestAssetRequests(
  bankSlug: BankSlug,
  requests: readonly AssetRequest[],
  entitlements: readonly AccessEntitlement[],
  now = new Date(),
): Promise<ManifestAuthorizedAssetRequest[]> {
  if (requests.length < 1 || requests.length > 20) {
    throw new Error("Asset request batch must contain between 1 and 20 items");
  }
  const manifest = await loadBankAssetManifest(bankSlug);
  const seen = new Set<string>();
  return requests.map((request) => {
    if (!request || typeof request.questionId !== "string" || (request.kind !== "question" && request.kind !== "answer")) {
      throw new Error("Asset request is invalid");
    }
    const requestKey = `${request.questionId}:${request.kind}`;
    if (seen.has(requestKey)) throw new Error("Duplicate asset request");
    seen.add(requestKey);
    const entry = manifest.get(request.questionId);
    if (!entry) throw new Error("Unknown question");
    const allowed = request.kind === "question"
      ? canViewQuestionAsset(bankSlug, request.questionId, entitlements, now)
      : canViewAnswer(bankSlug, request.questionId, entitlements, now);
    if (!allowed) throw new Error("User is not authorized for this asset");
    return {
      questionId: request.questionId,
      kind: request.kind,
      details: entry.details,
      paths: request.kind === "question" ? entry.questionAssetPaths : entry.markschemeAssetPaths,
    };
  });
}
```

`src/app/api/assets/sign/route.ts`:
- Replace `authorizeAssetRequests` with `authorizeManifestAssetRequests`.
- Replace both `details: getQuestionRichDetails(item.question, entitlements)` with `details: richDetailsFor(body.bank as BankSlug, item.questionId, item.details, entitlements)`.
- Change the imports to match. Nothing else changes.

`src/app/api/study-state/route.ts`: replace the `loadBankQuestions(...).some(...)` check with `!(await loadBankAssetManifest(bank)).has(questionId)`, and swap the import.

`scripts/generate-asset-manifest.mts`. Each bank loads in its own child process, because the loader caches every bank for the life of the process:

```ts
#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { ASSET_MANIFEST_DIRECTORY, assetManifestFileName, buildBankAssetManifest } from "@/lib/asset-manifest";
import { loadBankQuestions } from "@/lib/question-loader";

const single = process.argv.indexOf("--bank");
if (single >= 0) {
  const slug = process.argv[single + 1] as BankSlug;
  const questions = await loadBankQuestions(slug).catch(() => null);
  if (!questions) { console.log(`${slug}: not runnable in this environment, skipped`); process.exit(0); }
  const file = join(ASSET_MANIFEST_DIRECTORY, assetManifestFileName(slug));
  await writeFile(file, JSON.stringify(buildBankAssetManifest(questions)));
  console.log(`${slug}: ${questions.length} questions -> ${file}`);
  process.exit(0);
}

await mkdir(ASSET_MANIFEST_DIRECTORY, { recursive: true });
for (const name of await readdir(ASSET_MANIFEST_DIRECTORY)) await unlink(join(ASSET_MANIFEST_DIRECTORY, name));
const slugs = getAvailableBanks().map((bank) => bank.slug);
const run = (slug: string) => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], "--bank", slug], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${slug} manifest failed (${code})`)));
});
const queue = [...slugs];
await Promise.all([0, 1].map(async () => { while (queue.length) await run(queue.shift()!); }));
```

`package.json` scripts:
- Add `"generate:asset-manifest": "tsx scripts/generate-asset-manifest.mts"`.
- Change `"prebuild"` to `"npm run generate:bank-index && npm run generate:asset-manifest"`.

`.gitignore`: add `/generated/` under `# next.js`.

`next.config.ts`: inside `outputFileTracingIncludes`, add:

```ts
"/api/assets/sign": ["./generated/asset-manifest/**"],
"/api/assets/free": ["./generated/asset-manifest/**"],
"/api/study-state": ["./generated/asset-manifest/**"],
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/asset-manifest.test.ts src/app/api/assets/sign src/app/api/study-state src/lib/question-delivery src/lib/asset-access`

Expected: all PASS, including every existing sign-route access, allowance and paid-denial case.

Then run: `npm run generate:asset-manifest && ls -la generated/asset-manifest | head`

Expected: one `<slug>.<mode>.json` per available bank, and no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asset-manifest.ts src/lib/asset-manifest.test.ts scripts/generate-asset-manifest.mts src/lib/question-loader.ts src/lib/question-delivery.ts src/lib/asset-access.ts src/app/api/assets/sign/route.ts src/app/api/study-state package.json .gitignore next.config.ts
git commit -m "Asset manifest: sign and study-state stop normalizing whole banks"
```

---

### Task 2: CDN-cached free asset route

**Files:**
- Create: `src/app/api/assets/free/route.ts`
- Create: `src/app/api/assets/free/route.test.ts`
- Modify: `src/proxy.ts` (matcher)
- Modify: `src/lib/performance-architecture.test.ts` (matcher expectation)
- Modify: `src/lib/signed-assets.ts` (add `fetchFreeAssets`)
- Modify: `src/lib/signed-assets.test.ts`

**Interfaces:**
- Consumes: `loadBankAssetManifest`, `richDetailsFor` (Task 1).
- Produces:
  - Route `GET /api/assets/free?bank&id&kind`, returning `{ expiresIn: 3600, maxAge: 900, asset: { questionId, kind, urls, details, displayCrops } }`.
  - `fetchFreeAssets(bank: BankSlug, requests: readonly AssetRequest[], fetcher?: Fetcher): Promise<{ assets: Map<string, SignedAsset>; failedKeys: string[] }>`
  - `FREE_ASSET_EXPIRES_IN = 3600`, `FREE_ASSET_CDN_MAX_AGE = 900` (exported from `src/lib/signed-assets.ts`, so client and route share them).

- [ ] **Step 1: Write the failing route tests**

`src/app/api/assets/free/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, createAdminClient, createSignedUrls } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createSignedUrls: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { GET } from "@/app/api/assets/free/route";

const request = (query: string, cookie?: string) => new NextRequest(`https://pastpaperprep.com/api/assets/free?${query}`, cookie ? { headers: { cookie } } : undefined);

describe("GET /api/assets/free", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSignedUrls.mockImplementation(async (paths: string[], expiresIn: number) => ({ data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}?e=${expiresIn}` })), error: null }));
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrls })) } });
  });

  it("signs a free question for an hour and lets the CDN share it", async () => {
    const response = await GET(request("bank=ib-sl&id=2017-may-p1-tz1-q1&kind=question"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=900");
    const body = await response.json();
    expect(body.expiresIn).toBe(3600);
    expect(body.maxAge).toBe(900);
    expect(body.asset.questionId).toBe("2017-may-p1-tz1-q1");
    expect(body.asset.urls.length).toBeGreaterThan(0);
    expect(body.asset.urls[0]).toContain("e=3600");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects paid ids even with a session cookie", async () => {
    const response = await GET(request("bank=ib-sl&id=m26-math-aasl-p2-tza-q2&kind=answer", "sb-abc-auth-token=x"));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["bank=nope&id=2017-may-p1-tz1-q1&kind=question", 400],
    ["bank=ib-sl&kind=question", 400],
    ["bank=ib-sl&id=2017-may-p1-tz1-q1&kind=pdf", 400],
    ["bank=ib-sl&id=2017-may-p1-tz1-q999&kind=question", 404],
  ])("never caches errors (%s)", async (query, status) => {
    const response = await GET(request(query));
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("does not cache provider failures", async () => {
    createSignedUrls.mockResolvedValueOnce({ data: null, error: new Error("down") });
    const response = await GET(request("bank=ib-sl&id=2017-may-p1-tz1-q1&kind=question"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});
```

(Confirm with `grep -n '"2017-may-p1-tz1-q1"' src/data/raw/ib-sl.json` that the ID exists, and that `2017-may-p1-tz1-q999` doesn't. Pick another 2017 ib-sl ID if needed.)

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/app/api/assets/free`

Expected: FAIL, the module isn't found.

- [ ] **Step 3: Implement the route**

`src/app/api/assets/free/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { isPreviewQuestion } from "@/lib/access";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { getBank, type BankSlug } from "@/lib/banks";
import { previewAssetSignOptions, signPrivateAssetUrls } from "@/lib/private-assets";
import { richDetailsFor } from "@/lib/question-delivery";
import { reviewedBlankTailForSignedAsset } from "@/lib/reviewed-blank-tails";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { FREE_ASSET_CDN_MAX_AGE, FREE_ASSET_EXPIRES_IN } from "@/lib/signed-assets";

export const runtime = "nodejs";

const NO_STORE = { headers: { "Cache-Control": "private, no-store, max-age=0" } } as const;
const SHARED = { headers: { "Cache-Control": `public, max-age=0, s-maxage=${FREE_ASSET_CDN_MAX_AGE}` } } as const;

/**
 * Free-year question and answer images only. It reads no cookies, so one CDN entry serves
 * every visitor. Paid assets stay on POST /api/assets/sign with entitlement and allowance checks.
 */
async function handleGET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const bankParam = params.get("bank");
  const questionId = params.get("id");
  const kind = params.get("kind");
  if (!bankParam || !getBank(bankParam) || !questionId || (kind !== "question" && kind !== "answer")) {
    return NextResponse.json({ error: "Invalid asset request" }, { status: 400, ...NO_STORE });
  }
  const bank = bankParam as BankSlug;
  if (!isPreviewQuestion(bank, questionId)) {
    return NextResponse.json({ error: "Access required" }, { status: 403, ...NO_STORE });
  }
  const entry = (await loadBankAssetManifest(bank)).get(questionId);
  if (!entry) return NextResponse.json({ error: "Unknown question" }, { status: 404, ...NO_STORE });

  const paths = kind === "question" ? entry.questionAssetPaths : entry.markschemeAssetPaths;
  let urlByPath: Map<string, string>;
  try {
    urlByPath = await signPrivateAssetUrls(paths, FREE_ASSET_EXPIRES_IN, previewAssetSignOptions(bank));
  } catch {
    return NextResponse.json({ error: "Private assets are temporarily unavailable" }, { status: 503, ...NO_STORE });
  }
  return NextResponse.json({
    expiresIn: FREE_ASSET_EXPIRES_IN,
    maxAge: FREE_ASSET_CDN_MAX_AGE,
    asset: {
      questionId,
      kind,
      details: richDetailsFor(bank, questionId, entry.details, []),
      urls: paths.map((path) => urlByPath.get(path)),
      displayCrops: paths.map((path) => reviewedBlankTailForSignedAsset(bank, questionId, kind, path)),
    },
  }, SHARED);
}

export const GET = withFailureReporting("/api/assets/free", handleGET);
```

`src/proxy.ts` matcher: replace `"/api/:path*"` with `"/api/((?!assets/free$).*)"`.

`src/lib/performance-architecture.test.ts`: update the expected matcher list the same way, and add a case:

```ts
it("keeps the cacheable free asset route out of session middleware", () => {
  const api = new RegExp(`^${"/api/((?!assets/free$).*)".replace("/api/", "\\/api\\/")}$`);
  expect(api.test("/api/assets/free")).toBe(false);
  expect(api.test("/api/assets/sign")).toBe(true);
  expect(api.test("/api/study-state")).toBe(true);
});
```

Check that `withFailureReporting` accepts a handler that takes a `NextRequest`: `src/app/api/banks/bootstrap/route.ts` already does this.

- [ ] **Step 4: Run the route tests and confirm they pass**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/app/api/assets/free src/lib/performance-architecture.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing client tests**

Add to `src/lib/signed-assets.test.ts`:

```ts
describe("fetchFreeAssets", () => {
  const ok = (questionId: string, kind: string) => new Response(JSON.stringify({ expiresIn: 3600, maxAge: 900, asset: { questionId, kind, urls: [`https://assets.example/${questionId}.webp`] } }), { status: 200 });

  it("requests one cacheable GET per asset", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://pastpaperprep.com");
      return ok(url.searchParams.get("id")!, url.searchParams.get("kind")!);
    });
    const { assets, failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }, { questionId: "b", kind: "answer" }], fetcher);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/assets/free?bank=ib-sl&id=a&kind=question",
      "/api/assets/free?bank=ib-sl&id=b&kind=answer",
    ]);
    expect([...assets.keys()]).toEqual(["a:question", "b:answer"]);
    expect(failedKeys).toEqual([]);
  });

  it("treats cached free links conservatively", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { assets } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], async () => ok("a", "question"));
    expect(assets.get("a:question")!.expiresAt).toBe(1_000_000 + (3600 - 900 - 300) * 1000);
    vi.useRealTimers();
  });

  it("reports failures per asset instead of failing the batch", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes("id=bad")
      ? new Response(JSON.stringify({ error: "Access required" }), { status: 403 })
      : ok("good", "question"));
    const { assets, failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "good", kind: "question" }, { questionId: "bad", kind: "question" }], fetcher);
    expect([...assets.keys()]).toEqual(["good:question"]);
    expect(failedKeys).toEqual(["bad:question"]);
  });

  it("rejects a response for a different asset", async () => {
    const { failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], async () => ok("other", "question"));
    expect(failedKeys).toEqual(["a:question"]);
  });
});
```

(Add `fetchFreeAssets` to the file's existing import from `@/lib/signed-assets`, and `vi` from vitest if it isn't already imported.)

- [ ] **Step 6: Run the client tests and confirm they fail**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/signed-assets.test.ts`

Expected: FAIL, `fetchFreeAssets` isn't exported.

- [ ] **Step 7: Implement `fetchFreeAssets`**

Append to `src/lib/signed-assets.ts`:

```ts
export const FREE_ASSET_EXPIRES_IN = 3600;
export const FREE_ASSET_CDN_MAX_AGE = 900;
const FREE_ASSET_SAFETY_SECONDS = 300;

/** Free-year assets through the CDN-cached GET route; one request per asset so cache keys ignore filters. */
export async function fetchFreeAssets(
  bank: BankSlug,
  requests: readonly AssetRequest[],
  fetcher: Fetcher = fetch,
): Promise<{ assets: Map<string, SignedAsset>; failedKeys: string[] }> {
  const assets = new Map<string, SignedAsset>();
  const failedKeys: string[] = [];
  await Promise.all(requests.map(async (request) => {
    const key = signedAssetKey(request.questionId, request.kind);
    try {
      const query = new URLSearchParams({ bank, id: request.questionId, kind: request.kind });
      const response = await fetcher(`/api/assets/free?${query}`);
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (
        !response.ok || !payload ||
        typeof payload.expiresIn !== "number" || typeof payload.maxAge !== "number" ||
        !validAsset(payload.asset) ||
        signedAssetKey(payload.asset.questionId, payload.asset.kind) !== key
      ) throw new Error("Invalid free asset response");
      // A CDN copy can be up to maxAge old; expire early so a lazy image never meets a dead link.
      const lifetime = Math.max(payload.expiresIn - payload.maxAge - FREE_ASSET_SAFETY_SECONDS, 1);
      assets.set(key, { ...payload.asset, expiresAt: Date.now() + lifetime * 1000 });
    } catch {
      failedKeys.push(key);
    }
  }));
  const order = new Map(requests.map((request, index) => [signedAssetKey(request.questionId, request.kind), index]));
  return {
    assets: new Map([...assets].sort(([a], [b]) => order.get(a)! - order.get(b)!)),
    failedKeys: failedKeys.sort((a, b) => order.get(a)! - order.get(b)!),
  };
}
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/signed-assets.test.ts src/app/api/assets/free src/lib/performance-architecture.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/assets/free src/proxy.ts src/lib/performance-architecture.test.ts src/lib/signed-assets.ts src/lib/signed-assets.test.ts
git commit -m "Free asset route: CDN-cached signing for free-year questions"
```

---

### Task 3: Explorer stops waiting for anonymous visitors

**Files:**
- Create: `src/lib/supabase/auth-cookie.ts`
- Modify: `src/lib/supabase/proxy.ts` (reuse the cookie-name test)
- Modify: `src/components/QuestionExplorer.tsx`
- Test: `src/components/QuestionExplorer.test.tsx`, `src/lib/supabase/auth-cookie.test.ts`

**Interfaces:**
- Consumes: `fetchFreeAssets` (Task 2), `fetchSignedAssets` (existing).
- Produces:
  - `isSupabaseAuthCookieName(name: string): boolean`
  - `documentHasSupabaseAuthCookie(cookieHeader: string): boolean`
  - New QuestionExplorer state, `authCookiePresent: boolean`, used in Task 4.

- [ ] **Step 1: Write the failing tests**

`src/lib/supabase/auth-cookie.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { documentHasSupabaseAuthCookie, isSupabaseAuthCookieName } from "@/lib/supabase/auth-cookie";

describe("Supabase auth cookie detection", () => {
  it("matches whole and chunked auth cookies only", () => {
    expect(isSupabaseAuthCookieName("sb-abc-auth-token")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abc-auth-token.0")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abc-auth-token-code-verifier")).toBe(false);
    expect(isSupabaseAuthCookieName("ph_session")).toBe(false);
  });
  it("reads a document.cookie string", () => {
    expect(documentHasSupabaseAuthCookie("")).toBe(false);
    expect(documentHasSupabaseAuthCookie("a=1; sb-xyz-auth-token.1=abc")).toBe(true);
    expect(documentHasSupabaseAuthCookie("pastpaperprep-theme=dark")).toBe(false);
  });
});
```

Add to `src/components/QuestionExplorer.test.tsx`. Reuse the file's existing render helper and fetch mocking. The four cases render the bank explorer with `bootstrapUrl="/api/banks/bootstrap?bank=ib-sl"` and `hydrateFromLocation`, using at least one free (2017) and one paid ib-sl question in `questions`:

```ts
describe("asset loading without a member session", () => {
  afterEach(() => { document.cookie = "sb-test-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; });

  it("skips bootstrap and signs free questions through the free route when no auth cookie exists", async () => {
    // render explorer (anonymous), fetch mock answers /api/assets/free with ok assets
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/assets/free?"))).toBe(true));
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/banks/bootstrap"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/assets/sign")).toBe(false);
  });

  it("signs free questions before bootstrap resolves", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    // bootstrap fetch returns a promise that never resolves in this test
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/assets/free?"))).toBe(true));
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/assets/sign")).toBe(false);
  });

  it("signs locked questions through POST only after bootstrap grants access", async () => {
    document.cookie = "sb-test-auth-token=x; path=/";
    // bootstrap returns { access: { authenticated: true, bankAccess: true, canExportPdf: true }, studyState: { savedIds: [], attemptedIds: [] } }
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/assets/sign", expect.any(Object)));
    const signed = JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url) === "/api/assets/sign")![1]!.body));
    expect(signed.requests.every((request: { questionId: string }) => !request.questionId.startsWith("2017-"))).toBe(true);
  });

  it("re-signs a failed free image through the free route", async () => {
    // after the free image renders, fire an error event on it with fake timers advanced past expiresAt
    // expect a second /api/assets/free call for the same id
  });

  it("prefetches only free answers on hover", async () => {
    // hover "Show answer" on a free card -> /api/assets/free?...kind=answer requested
    // hover on a paid card (bootstrap grants access) -> no /api/assets/sign request with kind "answer" until click
  });
});
```

Implementation note for the executor: fill in the render and mock bodies using the patterns already in `QuestionExplorer.test.tsx` (see its tests near lines 150–320, which build `fetchMock` and render with `bootstrapUrl`). Each comment line above describes the exact mock and assertion to write. A test is done when it fails before Step 3 and passes after.

Existing tests that expect a bootstrap fetch or POST signing for free questions need `document.cookie = "sb-test-auth-token=x; path=/"` in their setup (clear it in `afterEach`). Their free-question assertions also move from `/api/assets/sign` to `/api/assets/free`. Change only those lines, and keep each test's intent.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/supabase/auth-cookie.test.ts src/components/QuestionExplorer.test.tsx`

Expected: the new cases FAIL.

- [ ] **Step 3: Implement**

`src/lib/supabase/auth-cookie.ts`:

```ts
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

export function isSupabaseAuthCookieName(name: string): boolean {
  return AUTH_COOKIE.test(name);
}

/** Supabase SSR auth cookies are not httpOnly, so the browser can tell an anonymous visit apart. */
export function documentHasSupabaseAuthCookie(cookieHeader: string): boolean {
  return cookieHeader.split(";").some((part) => isSupabaseAuthCookieName(part.trim().split("=")[0] ?? ""));
}
```

`src/lib/supabase/proxy.ts`: `hasSupabaseAuthCookie` becomes `cookies.some(({ name }) => isSupabaseAuthCookieName(name))`.

`src/components/QuestionExplorer.tsx`:

1. Imports: add `fetchFreeAssets` to the `@/lib/signed-assets` import, and `import { documentHasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";`.
2. State: add `const [authCookiePresent, setAuthCookiePresent] = useState(false);` next to `bootstrapPending`.
3. Bootstrap effect (currently `useEffect(() => { if (!bootstrapUrl) return; ... }, [bootstrapUrl]);`). At its top, after `if (!bootstrapUrl) return;`:

```ts
let cancelled = false;
if (!documentHasSupabaseAuthCookie(document.cookie)) {
  // No session cookie: the server would answer "anonymous" without touching Supabase.
  queueMicrotask(() => {
    if (cancelled) return;
    setResolvedAccess({ authenticated: false, bankAccess: false, canExportPdf: false });
    setResolvedExportMarker(undefined);
    setBootstrapPending(false);
  });
  return () => { cancelled = true; };
}
queueMicrotask(() => { if (!cancelled) setAuthCookiePresent(true); });
```

Remove the original `let cancelled = false;` line that follows, so it isn't declared twice. Leave the rest of the effect as it is.

4. Replace the `questionAssetRequests` memo with two lists:

```ts
const freeAssetRequests = useMemo(() => !locationHydrated || localPreview ? [] : shownQuestions
  .filter((question) => isPreviewQuestion(question.bankSlug, question.id))
  .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
  .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question")), assetEpoch))
  .map((question) => ({ questionId: question.id, kind: "question" as const })),
[locationHydrated, localPreview, assetEpoch, failedAssetKeys, shownQuestions, signedAssets]);
const questionAssetRequests = useMemo(() => bootstrapPending || !locationHydrated ? [] : shownQuestions
  .filter((question) => localPreview ? (resolvedAccess.bankAccess || isPreviewQuestion(question.bankSlug, question.id)) : (resolvedAccess.bankAccess && !isPreviewQuestion(question.bankSlug, question.id)))
  .filter((question) => !failedAssetKeys.has(signedAssetKey(question.id, "question")))
  .filter((question) => !isSignedAssetFresh(signedAssets.get(signedAssetKey(question.id, "question")), assetEpoch))
  .map((question) => ({ questionId: question.id, kind: "question" as const })),
[bootstrapPending, locationHydrated, localPreview, resolvedAccess.bankAccess, assetEpoch, failedAssetKeys, shownQuestions, signedAssets]);
```

5. Factor the success handler out of the existing signing effect into a function inside the component, then add a second effect for free requests:

```ts
const applySignedAssets = (assets: Map<string, SignedAsset>) => {
  setSignedAssets((current) => new Map([...current, ...assets]));
  const detailsById = new Map([...assets.values()].flatMap((asset) => asset.details ? [[asset.questionId, asset.details] as const] : []));
  if (detailsById.size) {
    setCatalogQuestions((current) => current.map((question) => {
      const details = detailsById.get(question.id);
      return details ? mergeQuestionRichDetails(question, details) : question;
    }));
  }
};
```

The existing effect's `.then` becomes `.then((assets) => { applySignedAssets(assets); setAssetError(""); })`.

New effect, placed right after it:

```ts
useEffect(() => {
  if (!bank) return;
  const pendingRequests = freeAssetRequests.filter((request) => !signingAssetKeysRef.current.has(signedAssetKey(request.questionId, request.kind)));
  if (!pendingRequests.length) return;
  const pendingKeys = pendingRequests.map((request) => signedAssetKey(request.questionId, request.kind));
  for (const key of pendingKeys) signingAssetKeysRef.current.add(key);
  fetchFreeAssets(bank, pendingRequests)
    .then(({ assets, failedKeys }) => {
      applySignedAssets(assets);
      if (failedKeys.length) {
        setFailedAssetKeys((current) => new Set([...current, ...failedKeys]));
        setAssetError("Some question images could not load.");
      }
    })
    .finally(() => { for (const key of pendingKeys) signingAssetKeysRef.current.delete(key); });
  // applySignedAssets only calls state setters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [bank, freeAssetRequests]);
```

6. In `QuestionCard`:
   - Add a prop `freeAnswer: boolean`. The caller passes `freeAnswer={!localPreview && isPreviewQuestion(question.bankSlug, question.id)}`.
   - Add a shared answer loader:

```ts
const answerRequestRef = useRef<Promise<SignedAsset> | null>(null);
const loadAnswer = () => {
  if (answerAsset) return Promise.resolve(answerAsset);
  answerRequestRef.current ??= (freeAnswer
    ? fetchFreeAssets(question.bankSlug, [{ questionId: question.id, kind: "answer" }]).then(({ assets }) => assets.get(signedAssetKey(question.id, "answer")))
    : fetchSignedAssets(question.bankSlug, [{ questionId: question.id, kind: "answer" }], fetch, localPreview).then((assets) => assets.get(signedAssetKey(question.id, "answer"))))
    .then((asset) => { if (!asset) throw new Error("Missing answer asset"); onAnswerAsset(asset); return asset; })
    .catch((error: unknown) => { answerRequestRef.current = null; throw error; });
  return answerRequestRef.current;
};
const prefetchAnswer = () => {
  if (!freeAnswer || answerOpen || answerAsset || question.markschemeImageCount < 1) return;
  void loadAnswer().then((asset) => { if (asset.urls[0]) { const image = new window.Image(); image.src = asset.urls[0]; } }).catch(() => {});
};
```

   - In `toggleAnswer`, replace the `fetchSignedAssets(...)` / `assets.get(...)` / `onAnswerAsset(asset)` lines with `await loadAnswer();`. Keep the loading and error handling around it.
   - On the answer toggle `<button className="answer-toggle" ...>`, add `onPointerEnter={prefetchAnswer} onFocus={prefetchAnswer} onTouchStart={prefetchAnswer}`.
   - Add `useRef` to the React import if it's missing. It's already imported at the top of the file.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/supabase src/components/QuestionExplorer.test.tsx src/components/QuestionExplorer.upgrade.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/auth-cookie.ts src/lib/supabase/auth-cookie.test.ts src/lib/supabase/proxy.ts src/components/QuestionExplorer.tsx src/components/QuestionExplorer.test.tsx src/components/QuestionExplorer.upgrade.test.tsx
git commit -m "Explorer: skip bootstrap for anonymous visitors, sign free questions immediately"
```

---

### Task 4: Static HTML shows the anonymous default; faster first image

**Files:**
- Create: `src/lib/asset-origins.ts`, `src/lib/asset-origins.test.ts`
- Modify: `src/components/QuestionExplorer.tsx`
- Modify: `src/components/SourceCropImage.tsx`
- Modify: `src/app/banks/[slug]/page.tsx`
- Test: `src/components/QuestionExplorer.test.tsx`, `src/components/SourceCropImage.test.tsx`

**Interfaces:**
- Consumes: `authCookiePresent` (Task 3).
- Produces:
  - `assetOriginsForBank(bank: BankSlug, env?: Record<string, string | undefined>): string[]`
  - `SourceCropImage` prop `priority?: boolean`
  - `QuestionCard` prop `priority?: boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/asset-origins.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assetOriginsForBank } from "@/lib/asset-origins";

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", R2_ACCOUNT_ID: "92278648535014b5231edfe207b9391d" };

describe("asset origins", () => {
  it("preconnects Supabase for Supabase-backed banks", () => {
    expect(assetOriginsForBank("ib-sl", env)).toEqual(["https://abc.supabase.co"]);
  });
  it("adds the R2 origin for R2-backed banks", () => {
    expect(assetOriginsForBank("igcse-chemistry-0620", env)).toEqual(["https://abc.supabase.co", "https://92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com"]);
  });
  it("skips malformed values", () => {
    expect(assetOriginsForBank("igcse-chemistry-0620", { NEXT_PUBLIC_SUPABASE_URL: "nope", R2_ACCOUNT_ID: "x" })).toEqual([]);
  });
});
```

`src/components/SourceCropImage.test.tsx`: add

```ts
it("loads a priority image eagerly with high fetch priority", () => {
  render(<SourceCropImage bankSlug="ib-sl" questionId="q" src="https://assets.example/q.webp" alt="Original question 1" priority />);
  const image = screen.getByAltText("Original question 1");
  expect(image).toHaveAttribute("loading", "eager");
  expect(image).toHaveAttribute("fetchpriority", "high");
});
it("keeps other images lazy", () => {
  render(<SourceCropImage bankSlug="ib-sl" questionId="q" src="https://assets.example/q.webp" alt="Original question 2" />);
  expect(screen.getByAltText("Original question 2")).toHaveAttribute("loading", "lazy");
});
```

`src/components/QuestionExplorer.test.tsx`: add

```ts
it("renders the anonymous default list and free strip before hydration", () => {
  // render with hydrateFromLocation and bootstrapUrl using react-dom/server renderToString
  // assert the HTML contains the first free question card ("Question 1") and the "free-value-strip" class
});
it("keeps the member view provisional until bootstrap", async () => {
  // document.cookie = "sb-test-auth-token=x; path=/"; bootstrap never resolves
  // after mount, the free-value strip is gone and the "Free only" active-filter chip is absent
});
```

For the first case, use `renderToString` from `react-dom/server` with the same props the bank page passes. For the second, follow the existing bootstrap-pending tests.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/asset-origins.test.ts src/components/SourceCropImage.test.tsx src/components/QuestionExplorer.test.tsx`

Expected: the new cases FAIL.

- [ ] **Step 3: Implement**

`src/lib/asset-origins.ts`:

```ts
import type { BankSlug } from "@/lib/banks";
import { previewAssetSignOptions } from "@/lib/private-asset-providers";

/** Image origins worth a preconnect on a bank page; signed URLs already reveal both hosts. */
export function assetOriginsForBank(bank: BankSlug, env: Record<string, string | undefined> = process.env): string[] {
  const origins: string[] = [];
  try {
    const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (supabase.protocol === "https:") origins.push(supabase.origin);
  } catch { /* not configured */ }
  const account = env.R2_ACCOUNT_ID?.trim();
  if (previewAssetSignOptions(bank).provider === "r2" && account && /^[a-f0-9]{32}$/i.test(account)) {
    origins.push(`https://${account}.r2.cloudflarestorage.com`);
  }
  return origins;
}
```

`src/lib/private-assets.ts` imports `server-only` and the AWS SDK, so move `R2_PRIVATE_BANKS`, `previewAssetSignOptions` and `premiumAssetSignOptions` into a new `src/lib/private-asset-providers.ts` (no `server-only` import, no SDK). Re-export them from `private-assets.ts` so existing imports keep working:

```ts
export { previewAssetSignOptions, premiumAssetSignOptions } from "@/lib/private-asset-providers";
```

`src/app/banks/[slug]/page.tsx`: add `import { preconnect } from "react-dom";` and `import { assetOriginsForBank } from "@/lib/asset-origins";`. Inside `BankPage`, after `if (!allQuestions) notFound();`:

```ts
for (const origin of assetOriginsForBank(slug)) preconnect(origin, { crossOrigin: "anonymous" });
```

`src/components/SourceCropImage.tsx`: add `priority?: boolean` to the props. Pass `loading={priority ? "eager" : "lazy"}` and `fetchPriority={priority ? "high" : "auto"}` to every `<Image>` it renders, including the two in `VerifiedCrop` (thread `priority` into `VerifiedCrop` too). Don't use the deprecated `priority` prop of `next/image`.

`src/components/QuestionExplorer.tsx`:
- `QuestionCard` gets `priority?: boolean` and passes `priority={priority && index === 0}` to the first `SourceCropImage` in `questionAsset.urls.map((source, index) => ...)`. The list caller passes `priority={index === 0}`.
- Add `const provisional = bootstrapPending && authCookiePresent;`.
- Change `const effectiveFreeOnly = freeOnly && !bootstrapPending && !resolvedAccess.bankAccess;` to `const effectiveFreeOnly = freeOnly && !provisional && !resolvedAccess.bankAccess;`. Update the comment above it to say the provisional filter is withheld only while a session cookie's bootstrap is pending.
- In the free-value strip line and the Access filter-group line, replace `!bootstrapPending && !resolvedAccess.bankAccess` with `!provisional && !resolvedAccess.bankAccess`.
- In `shownQuestions`, replace the first line's `!locationHydrated` early return:

```ts
if (!locationHydrated) {
  // Static HTML: the anonymous default (free filter, default sort) the server already computed.
  return hydrateFromLocation && !localPreview ? questions.slice(0, Math.min(visible, ANONYMOUS_FREE_QUESTION_LIMIT)) : [];
}
if (sharedSetView && (sharedError || Boolean(missingSharedCount))) return [];
```

  Import `ANONYMOUS_FREE_QUESTION_LIMIT` from `@/lib/free-question-gate`. Add `hydrateFromLocation`, `localPreview` and `questions` to the memo deps.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/asset-origins.test.ts src/lib/private-assets src/components/SourceCropImage.test.tsx src/components/QuestionExplorer.test.tsx src/components/QuestionExplorer.upgrade.test.tsx src/app/banks src/lib/performance-architecture.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asset-origins.ts src/lib/asset-origins.test.ts src/lib/private-asset-providers.ts src/lib/private-assets.ts src/components/SourceCropImage.tsx src/components/SourceCropImage.test.tsx src/components/QuestionExplorer.tsx src/components/QuestionExplorer.test.tsx src/app/banks/[slug]/page.tsx
git commit -m "Bank page: render the anonymous default statically, prioritise the first image, preconnect asset hosts"
```

---

### Task 5: Keep server-only ledgers out of the client bundle

**Files:**
- Create: `src/lib/igcse-0580-syllabus.mjs`
- Create: `scripts/generate-client-taxonomy-slices.mjs`
- Create: `src/data/client/biology-0610-eras.json`, `src/data/client/ib-economics-student-topics.json` (generated, committed)
- Create: `src/lib/client-taxonomy-slices.test.ts`
- Modify: `src/lib/igcse-0580-section-retrieval-v3.mjs` (re-export from the syllabus module)
- Modify: `src/lib/taxonomy-router.ts` (import 0580 topics and sections from the syllabus module)
- Modify: `src/lib/igcse-0610-official.mjs` (import the 0610 slice)
- Modify: `src/lib/taxonomy.ts` (import the economics slice)
- Modify: `src/lib/performance-architecture.test.ts` (import-graph guard)

**Interfaces:**
- Produces: `IGCSE_0580_TOPICS` and `IGCSE_0580_SECTIONS` from `@/lib/igcse-0580-syllabus.mjs`, with the same values and shapes as today.

- [ ] **Step 1: Write the failing tests**

`src/lib/client-taxonomy-slices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import full0610 from "@/data/classification/igcse-biology-0610-official-taxonomy-v2.json";
import slice0610 from "@/data/client/biology-0610-eras.json";
import fullEconomics from "@/data/ib-economics-taxonomy.json";
import sliceEconomics from "@/data/client/ib-economics-student-topics.json";
import { project0610Eras, projectEconomicsStudentTopics } from "../../scripts/generate-client-taxonomy-slices.mjs";

describe("client taxonomy slices", () => {
  it("0610 slice equals the projection of the full taxonomy", () => {
    expect(slice0610).toEqual(project0610Eras(full0610));
  });
  it("IB Economics slice equals the projection of the full taxonomy", () => {
    expect(sliceEconomics).toEqual(projectEconomicsStudentTopics(fullEconomics));
  });
});
```

Add to `src/lib/performance-architecture.test.ts`:

```ts
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

function clientImportGraph(entry: string) {
  const seen = new Set<string>();
  const resolveSpec = (from: string, spec: string) => {
    const base = spec.startsWith("@/") ? join(process.cwd(), "src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`].find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
  };
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(ts|tsx|mjs|js)$/.test(file)) return;
    for (const match of readFileSync(file, "utf8").matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
      const next = resolveSpec(file, match[1]);
      if (next) walk(next);
    }
  };
  walk(join(process.cwd(), entry));
  return [...seen].map((file) => file.replace(`${process.cwd()}/`, ""));
}

it("keeps server-only classification ledgers out of the bank explorer bundle", () => {
  const graph = clientImportGraph("src/components/QuestionExplorer.tsx");
  expect(graph).not.toContain("src/data/igcse-0580-section-retrieval-v3.json");
  expect(graph).not.toContain("src/data/classification/igcse-biology-0610-official-taxonomy-v2.json");
  expect(graph).not.toContain("src/data/ib-economics-taxonomy.json");
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/client-taxonomy-slices.test.ts src/lib/performance-architecture.test.ts`

Expected: FAIL. The slice files don't exist yet, and the graph still contains all three ledgers.

- [ ] **Step 3: Implement**

`scripts/generate-client-taxonomy-slices.mjs`:

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/** Only what display0610Sections and the 0610 topic lists read: era, topic titles, subtopic id and title. */
export function project0610Eras(taxonomy) {
  return { eras: taxonomy.eras.map((era) => ({ era: era.era, topics: era.topics.map((topic) => ({ title: topic.title, subtopics: topic.subtopics.map((section) => ({ id: section.id, title: section.title })) })) })) };
}

/** Only what taxonomy.ts reads for IB Economics: topic labels and their detailed subtopic labels. */
export function projectEconomicsStudentTopics(taxonomy) {
  return { student_topics: taxonomy.student_topics.map((topic) => ({ label: topic.label, detailed_subtopics: topic.detailed_subtopics.map((subtopic) => ({ label: subtopic.label })) })) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, "..");
  const read = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
  await mkdir(join(root, "src/data/client"), { recursive: true });
  await writeFile(join(root, "src/data/client/biology-0610-eras.json"), `${JSON.stringify(project0610Eras(await read("src/data/classification/igcse-biology-0610-official-taxonomy-v2.json")), null, 1)}\n`);
  await writeFile(join(root, "src/data/client/ib-economics-student-topics.json"), `${JSON.stringify(projectEconomicsStudentTopics(await read("src/data/ib-economics-taxonomy.json")), null, 1)}\n`);
}
```

Before writing it, confirm with `grep -n "taxonomy\.\|era\.\|topic\.\|section\." src/lib/igcse-0610-official.mjs` and `grep -n "economicsTaxonomy\.\|topic\.\|subtopic\." src/lib/taxonomy.ts` that no other fields are read. If one is, add it to the projection.

Run: `node scripts/generate-client-taxonomy-slices.mjs`

`src/lib/igcse-0580-syllabus.mjs`:

```js
import syllabus from "../data/igcse-0580-official-2025.json" with { type: "json" };

export const IGCSE_0580_SYLLABUS = syllabus;
export const IGCSE_0580_TOPICS = syllabus.topics.map(({ title }) => title);
export const IGCSE_0580_SECTIONS = syllabus.topics.flatMap((topic) => topic.sections.map((section) => ({
  ...section,
  topic: topic.title,
  displayTitle: `${section.code} ${section.title}`,
})));
```

`src/lib/igcse-0580-section-retrieval-v3.mjs`:
- Replace the syllabus import and the `IGCSE_0580_TOPICS` / `IGCSE_0580_SECTIONS` definitions with `import { IGCSE_0580_SYLLABUS as syllabus, IGCSE_0580_TOPICS, IGCSE_0580_SECTIONS } from "./igcse-0580-syllabus.mjs";` plus `export { IGCSE_0580_TOPICS, IGCSE_0580_SECTIONS };`.
- The drift check keeps using `syllabus.sourcePdfSha256`.

`src/lib/taxonomy-router.ts`: change the import source on line 16 to `@/lib/igcse-0580-syllabus.mjs`.

`src/lib/igcse-0610-official.mjs`, line 1: `import taxonomy from "../data/client/biology-0610-eras.json" with { type: "json" };`

`src/lib/taxonomy.ts`, line 4: `import economicsTaxonomy from "@/data/client/ib-economics-student-topics.json";`

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**' --exclude 'node_modules/**' src/lib/client-taxonomy-slices.test.ts src/lib/performance-architecture.test.ts src/lib/taxonomy src/lib/question-filter src/lib/igcse src/lib/presentation src/lib/maths-picker`

Expected: PASS, with the 0580, 0610 and economics label tests unchanged.

Then run the full suite: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-client-taxonomy-slices.mjs src/data/client src/lib/client-taxonomy-slices.test.ts src/lib/igcse-0580-syllabus.mjs src/lib/igcse-0580-section-retrieval-v3.mjs src/lib/taxonomy-router.ts src/lib/igcse-0610-official.mjs src/lib/taxonomy.ts src/lib/performance-architecture.test.ts
git commit -m "Bundle: ship compact taxonomy slices instead of server-only ledgers"
```

---

### Task 6: Verify, measure, open the PR

**Files:**
- Modify: none. Measurements go in the PR description.

- [ ] **Step 1: Full gate**

Run, in order:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build > /private/tmp/claude-501/build-after.log 2>&1`

Expected: every command exits 0. The build log shows `generate:asset-manifest` writing one file per bank, and `/api/assets/free` listed as `ƒ`.

- [ ] **Step 2: Bundle comparison**

Run: `ls -S .next/static/chunks/*.js | head -3 | xargs -I{} sh -c 'printf "%s raw, %s gzip  {}\n" $(wc -c < {}) $(gzip -c {} | wc -c)'`

Expected: the largest chunk is well under the baseline of 2,094,210 bytes raw. Record before and after.

- [ ] **Step 3: Local cold sign CPU**

Run `npm start` in the background. With no auth cookie, time the first and second requests:

```bash
curl -s -o /dev/null -w "%{time_total}\n" "http://localhost:3000/api/assets/free?bank=igcse&id=0580-2016-march-22-q1&kind=question"
```

Expected: first-request time is far below the baseline 3.9 s cold. Record it. Stop the server.

- [ ] **Step 4: Push and preview**

Run: `git push -u origin claude/goofy-mendeleev-f6808e`

Wait for the Vercel preview URL from the PR checks. Then repeat the baseline measurements against the preview:
- Lighthouse mobile for `/`, `/pricing`, `/banks/igcse` and `/banks/ib-chemistry-hl`, with the same `npx -y lighthouse@12.8.2` command used for the baseline.
- Cold and warm resource timings on `/banks/igcse`, using the same browser snippet.
- `curl -sI` the free route twice and record `x-vercel-cache` (MISS, then HIT).

- [ ] **Step 5: Open the PR**

Use `gh pr create` with:
- Title: `Bank pages: questions in under 1.5 s, less server CPU`.
- Body: a before/after table (Lighthouse score, LCP, CLS, JS gzip, first-image start cold and warm, cold sign time, largest chunk), the access-safety notes (paid assets unchanged, free route is free-only and cookie-less, errors `no-store`), and a line flagging that shared lib modules shrank the landing-page bundle with no landing files edited.
- End the body with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

Bind the PR with the ccd_pr tools. Don't merge.
