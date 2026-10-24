import type { AssetKind, AssetRequest } from "@/lib/asset-access";
import { ASSET_KINDS, isAssetKind } from "@/lib/asset-kinds";
import { isMcqAnswer, type McqAnswer } from "@/lib/mcq-answer";
import type { QuestionRichDetails } from "@/lib/questions";
import type { BankSlug } from "@/lib/banks";
import type { SourcePrintSegment } from "@/lib/print-geometry";
import type { VisibleImageCrop } from "@/lib/reviewed-blank-tails";
import { FREE_ASSET_INDEX_VERSION, freeAssetIndexPath, isFreePublicAssetUrl, type FreeAssetIndex } from "@/lib/free-asset-index";

const SIGN_BATCH_SIZE = 20;
/**
 * Free-year links: signed for a week (the R2 presign maximum). The CDN keeps a response fresh
 * for four days and may serve it for two more while refreshing in the background. Within that
 * window, links retain a day of validity (less the client's safety margin). Vercel scopes this
 * response cache by deployment, so a new deploy uses new entries; it does not purge old ones.
 * Only free-year questions use these; paid assets keep one-hour links behind sign-in.
 */
export const FREE_ASSET_EXPIRES_IN = 7 * 24 * 60 * 60;
export const FREE_ASSET_CDN_FRESH = 4 * 24 * 60 * 60;
export const FREE_ASSET_CDN_STALE = 2 * 24 * 60 * 60;
/** The oldest copy the CDN may hand out; the client expires links assuming this age. */
export const FREE_ASSET_CDN_MAX_AGE = FREE_ASSET_CDN_FRESH + FREE_ASSET_CDN_STALE;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SignedAsset = AssetRequest & {
  urls: string[];
  expiresAt: number;
  details?: QuestionRichDetails;
  printSizesPt?: Array<[number, number] | null>;
  printSegments?: Array<SourcePrintSegment[] | null>;
  rasterSizesPx?: Array<[number, number] | null>;
  displayCrops?: Array<VisibleImageCrop | null>;
  /** A verified multiple-choice letter, shown instead of the mark-scheme crop. Answer assets only. */
  mcqAnswer?: McqAnswer;
};

export function signedAssetKey(questionId: string, kind: AssetKind): string {
  return `${questionId}:${kind}`;
}

export function isSignedAssetFresh(asset: SignedAsset | undefined, now = Date.now()): asset is SignedAsset {
  return Boolean(asset && asset.expiresAt > now);
}

/** Expiry of a signed asset that has already lapsed, or undefined when it is missing or still valid. */
export function lapsedSignedAssetExpiry(asset: SignedAsset | undefined, now = Date.now()): number | undefined {
  return asset && asset.expiresAt <= now ? asset.expiresAt : undefined;
}

function validDetails(value: unknown): value is QuestionRichDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const details = value as Record<string, unknown>;
  return typeof details.summary === "string" &&
    typeof details.accessibleText === "string" &&
    (details.solution === null || typeof details.solution === "string") &&
    (details.sourceQuestionUrl === null || typeof details.sourceQuestionUrl === "string") &&
    (details.sourceMarkSchemeUrl === null || typeof details.sourceMarkSchemeUrl === "string");
}

function validPrintSegments(value: unknown, size: unknown, raster: unknown): value is SourcePrintSegment[] {
  if (!Array.isArray(value) || !value.length ||
    !Array.isArray(size) || size.length !== 2 ||
    !Array.isArray(raster) || raster.length !== 2 ||
    !raster.every((dimension) => Number.isSafeInteger(dimension) && dimension > 0)) return false;
  let nextY = 0;
  let totalHeightPt = 0;
  let included = 0;
  for (const part of value) {
    if (!part || typeof part !== "object" || Array.isArray(part)) return false;
    const item = part as Record<string, unknown>;
    if (item.include !== undefined && typeof item.include !== "boolean") return false;
    // A hidden source page (e.g. BLANK PAGE) must be bound to the image bytes it hides.
    if (item.include === false && (typeof item.imageSha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.imageSha256))) return false;
    if (item.include !== false) included += 1;
    if (item.include !== false && item.imageSha256 !== undefined) return false;
    if (item.sourceY !== nextY || !Number.isSafeInteger(item.sourceHeight) ||
      (item.sourceHeight as number) <= 0 || !Number.isSafeInteger(item.sourcePage) ||
      (item.sourcePage as number) <= 0 || typeof item.physicalHeightPt !== "number" ||
      !Number.isFinite(item.physicalHeightPt) || item.physicalHeightPt <= 0) return false;
    nextY += item.sourceHeight as number;
    totalHeightPt += item.physicalHeightPt;
  }
  return included > 0 && nextY === raster[1] && Math.abs(totalHeightPt - size[1]) < 0.1;
}

function validDisplayCrop(value: unknown): value is VisibleImageCrop | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const crop = value as Record<string, unknown>;
  return Number.isSafeInteger(crop.fullWidthPx) && (crop.fullWidthPx as number) > 0 &&
    typeof crop.imageSha256 === "string" && /^[a-f0-9]{64}$/.test(crop.imageSha256) &&
    Number.isSafeInteger(crop.fullHeightPx) && (crop.fullHeightPx as number) > 0 &&
    Number.isSafeInteger(crop.visibleHeightPx) && (crop.visibleHeightPx as number) > 0 &&
    (crop.visibleHeightPx as number) < (crop.fullHeightPx as number);
}

function validAsset(value: unknown, localPreview = false): value is AssetRequest & { urls: string[]; details?: QuestionRichDetails; printSizesPt?: Array<[number, number] | null>; printSegments?: Array<SourcePrintSegment[] | null>; rasterSizesPx?: Array<[number, number] | null>; displayCrops?: Array<VisibleImageCrop | null>; mcqAnswer?: McqAnswer } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.questionId === "string" &&
    isAssetKind(asset.kind) &&
    Array.isArray(asset.urls) &&
    asset.urls.every((url) => typeof url === "string" && (/^https:\/\//.test(url) || (localPreview && /^\/api\/local-preview-assets\//.test(url)))) &&
    (asset.printSizesPt === undefined || (Array.isArray(asset.printSizesPt) &&
      asset.printSizesPt.length === asset.urls.length && asset.printSizesPt.every((size) =>
        size === null || (Array.isArray(size) && size.length === 2 &&
          size.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0))))) &&
    (asset.printSegments === undefined || (Array.isArray(asset.printSegments) &&
      asset.printSegments.length === asset.urls.length &&
      Array.isArray(asset.printSizesPt) && Array.isArray(asset.rasterSizesPx) &&
      asset.rasterSizesPx.length === asset.urls.length && asset.printSegments.every((parts, index) =>
        parts === null ? (asset.rasterSizesPx as unknown[])[index] === null :
          validPrintSegments(parts, (asset.printSizesPt as unknown[])[index], (asset.rasterSizesPx as unknown[])[index])))) &&
    (asset.displayCrops === undefined || (Array.isArray(asset.displayCrops) &&
      asset.displayCrops.length === asset.urls.length && asset.displayCrops.every(validDisplayCrop))) &&
    (asset.details === undefined || validDetails(asset.details)) &&
    (asset.mcqAnswer === undefined || (asset.kind === "answer" && isMcqAnswer(asset.mcqAnswer)))
  );
}

function assertCurrentScope(isCurrent: () => boolean): void {
  if (!isCurrent()) throw new DOMException("Asset request scope expired", "AbortError");
}

export type SignedAssetBatches = { assets: Map<string, SignedAsset>; failedKeys: string[]; error?: Error };

/**
 * Signs in parallel batches of 20. Each batch stands alone: a batch that signs is validated and
 * handed to onBatch as soon as it lands, and a batch that fails (429, 503, invalid response) only
 * reports its own keys, so a retry asks for those and not for links already paid for.
 * Rejects only when the caller's scope expired, so a stale page applies nothing.
 */
export async function signAssetBatches(
  bank: BankSlug,
  requests: readonly AssetRequest[],
  { fetcher = fetch, localPreview = false, isCurrent = () => true, onBatch }: {
    fetcher?: Fetcher; localPreview?: boolean; isCurrent?: () => boolean;
    onBatch?: (assets: Map<string, SignedAsset>) => void;
  } = {},
): Promise<SignedAssetBatches> {
  const signBatch = async (batch: readonly AssetRequest[]) => {
    assertCurrentScope(isCurrent);
    const response = await fetcher(localPreview ? "/api/local-preview-assets/sign" : "/api/assets/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bank, requests: batch }),
    });
    assertCurrentScope(isCurrent);
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    assertCurrentScope(isCurrent);

    if (!response.ok) {
      const message = typeof payload?.error === "string" ? payload.error : "Could not load private assets";
      throw new Error(message);
    }

    if (
      !payload ||
      typeof payload.expiresIn !== "number" ||
      payload.expiresIn <= 0 ||
      !Array.isArray(payload.assets) ||
      payload.assets.length !== batch.length ||
      !payload.assets.every((asset) => validAsset(asset, localPreview))
    ) {
      throw new Error("Invalid signed asset response");
    }
    const expiresAt = Date.now() + Math.max(payload.expiresIn - 30, 1) * 1000;
    const expected = new Set(batch.map((request) => signedAssetKey(request.questionId, request.kind)));
    const signed = new Map<string, SignedAsset>();
    for (const asset of payload.assets as Array<AssetRequest & Omit<SignedAsset, "expiresAt" | keyof AssetRequest>>) {
      const key = signedAssetKey(asset.questionId, asset.kind);
      if (!expected.delete(key) || signed.has(key)) throw new Error("Invalid signed asset response");
      signed.set(key, { ...asset, expiresAt });
    }
    if (expected.size) throw new Error("Invalid signed asset response");
    onBatch?.(signed);
    return signed;
  };

  // Batches go out together: a page of questions shouldn't wait on one round trip per 20 images.
  const batches: AssetRequest[][] = [];
  for (let index = 0; index < requests.length; index += SIGN_BATCH_SIZE) batches.push(requests.slice(index, index + SIGN_BATCH_SIZE));
  const results = await Promise.allSettled(batches.map(signBatch));
  assertCurrentScope(isCurrent);

  const assets = new Map<string, SignedAsset>();
  const failedKeys: string[] = [];
  let error: Error | undefined;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      for (const [key, asset] of result.value) assets.set(key, asset);
      return;
    }
    if (result.reason instanceof DOMException && result.reason.name === "AbortError") throw result.reason;
    error ??= result.reason instanceof Error ? result.reason : new Error("Could not load private assets");
    failedKeys.push(...batches[index].map((request) => signedAssetKey(request.questionId, request.kind)));
  });
  return { assets, failedKeys, ...(error ? { error } : {}) };
}

/** All-or-nothing form for callers that need every key, e.g. one answer or explanation. */
export async function fetchSignedAssets(
  bank: BankSlug,
  requests: readonly AssetRequest[],
  fetcher: Fetcher = fetch,
  localPreview = false,
  isCurrent: () => boolean = () => true,
): Promise<Map<string, SignedAsset>> {
  const { assets, error } = await signAssetBatches(bank, requests, { fetcher, localPreview, isCurrent });
  if (error) throw error;
  return assets;
}

/** A failed /api/pdf/sign response, keeping its status so failures can be categorised. */
export class PdfSignError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "PdfSignError"; }
}

export type PdfFailureReason = "daily_limit" | "auth" | "sign_unavailable" | "network" | "build" | "other";
/** Bounded category for a failed PDF export. Never carries the message text. */
export function pdfFailureReason(error: unknown): PdfFailureReason {
  if (error instanceof PdfSignError) {
    if (error.status === 429) return "daily_limit";
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status >= 500) return "sign_unavailable";
    return "other";
  }
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return "network";
  if (error instanceof Error) return "build";
  return "other";
}

export async function fetchPdfAssets(
  bank: BankSlug,
  questionIds: readonly string[],
  content: "questions" | "answers" | "both",
  fetcher: Fetcher = fetch,
  localPreview = false,
  isCurrent: () => boolean = () => true,
): Promise<Map<string, SignedAsset>> {
  assertCurrentScope(isCurrent);
  const expectedQuestions = new Set(questionIds);
  // Every released 0606 question has exactly one source QP and one source MS.
  // Other banks can legitimately have text-only answers, so do not require those there.
  const expected0606 = bank === "igcse-additional" ? new Set(questionIds.flatMap((id) => [
    ...(content !== "answers" ? [signedAssetKey(id, "question")] : []),
    ...(content !== "questions" ? [signedAssetKey(id, "answer")] : []),
  ])) : null;
  const response = await fetcher(localPreview ? "/api/local-preview-assets/pdf" : "/api/pdf/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bank, questionIds, content }),
  });
  assertCurrentScope(isCurrent);
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  assertCurrentScope(isCurrent);
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Could not authorize PDF assets";
    throw new PdfSignError(message, response.status);
  }
  if (
    !payload ||
    typeof payload.expiresIn !== "number" ||
    payload.expiresIn <= 0 ||
    !Array.isArray(payload.assets) ||
    !payload.assets.every((asset) => validAsset(asset, localPreview))
  ) throw new Error("Invalid signed asset response");

  const signed = new Map<string, SignedAsset>();
  const expiresAt = Date.now() + Math.max(payload.expiresIn - 30, 1) * 1000;
  for (const asset of payload.assets) {
    const key = signedAssetKey(asset.questionId, asset.kind);
    if (
      !expectedQuestions.has(asset.questionId) ||
      (content === "questions" && asset.kind !== "question") ||
      (content === "answers" && asset.kind !== "answer") ||
      (expected0606 && !expected0606.delete(key)) ||
      signed.has(key)
    ) throw new Error("Invalid signed asset response");
    signed.set(key, { ...asset, expiresAt });
  }
  if (expected0606?.size) throw new Error("Invalid signed asset response");
  return signed;
}

const FREE_ASSET_SAFETY_SECONDS = 300;
/** Public links never expire; re-read the static index daily so a long-open tab picks up a deploy. */
const FREE_PUBLIC_ASSET_LIFETIME_MS = 24 * 60 * 60 * 1000;

type LoadedIndex = { loadedAt: number; index: Promise<FreeAssetIndex | null> };
const freeIndexes = new WeakMap<Fetcher, Map<BankSlug, LoadedIndex>>();
/** Retry public delivery after a minute; a broken object must not disable its bank. */
const FREE_PUBLIC_FAILURE_COOLDOWN_MS = 60_000;
type PublicFailure = { until: number; rescue?: Promise<SignedAsset | null> };
const publicFailures = new WeakMap<Fetcher, Map<string, PublicFailure>>();

/**
 * Two different public assets failing close together means this browser can't reach the free
 * host (some networks block it), not that one object is broken: switch every bank to signed
 * links, and remember it for a day so the next visit doesn't fail on the public host first.
 */
const FREE_PUBLIC_HOST_FAILURE_THRESHOLD = 2;
const FREE_PUBLIC_HOST_FAILURE_WINDOW_MS = 10 * 60_000;
const FREE_PUBLIC_HOST_UNAVAILABLE_MS = 24 * 60 * 60 * 1000;
const FREE_PUBLIC_HOST_STORAGE_KEY = "pastpaperprep:free-public-host-unavailable-until";
/** While switched, check the host this often so a visitor who changes network gets public links back. */
const FREE_PUBLIC_HOST_PROBE_INTERVAL_MS = 30 * 60_000;
const FREE_PUBLIC_HOST_PROBE_TIMEOUT_MS = 15_000;
type PublicHostState = { failedAt: Map<string, number>; unavailableUntil: number; probedAt: number; probing: boolean };
const publicHosts = new WeakMap<Fetcher, PublicHostState>();

function publicFailureKey(bank: BankSlug, request: AssetRequest): string {
  return `${bank}:${signedAssetKey(request.questionId, request.kind)}`;
}

function publicHost(fetcher: Fetcher): PublicHostState {
  let host = publicHosts.get(fetcher);
  if (!host) publicHosts.set(fetcher, host = { failedAt: new Map(), unavailableUntil: 0, probedAt: 0, probing: false });
  return host;
}

// Only the page's own fetch speaks for this browser's network, so only it reads or writes the
// stored switch; injected fetchers keep the decision in memory. The value is just an expiry time.
function ownsStoredSwitch(fetcher: Fetcher): boolean {
  return fetcher === globalThis.fetch && typeof window !== "undefined";
}

function storedPublicHostUnavailableUntil(fetcher: Fetcher, now: number): number {
  if (!ownsStoredSwitch(fetcher)) return 0;
  try {
    const until = Number(window.localStorage.getItem(FREE_PUBLIC_HOST_STORAGE_KEY));
    if (Number.isFinite(until) && until > now && until <= now + FREE_PUBLIC_HOST_UNAVAILABLE_MS) return until;
    window.localStorage.removeItem(FREE_PUBLIC_HOST_STORAGE_KEY);
  } catch { /* storage unavailable: the in-memory switch still applies */ }
  return 0;
}

function publicHostUnavailable(fetcher: Fetcher, now: number): boolean {
  const host = publicHost(fetcher);
  if (host.unavailableUntil > now) return true;
  const stored = storedPublicHostUnavailableUntil(fetcher, now);
  if (!stored) return false;
  // Adopt a switch another tab or visit recorded; its failures count as the latest check.
  host.unavailableUntil = stored;
  host.probedAt = now;
  return true;
}

function recordPublicHostFailure(fetcher: Fetcher, key: string, now: number): void {
  const host = publicHost(fetcher);
  for (const [failedKey, at] of host.failedAt) if (now - at >= FREE_PUBLIC_HOST_FAILURE_WINDOW_MS) host.failedAt.delete(failedKey);
  if (!host.failedAt.has(key)) host.failedAt.set(key, now);
  if (host.failedAt.size < FREE_PUBLIC_HOST_FAILURE_THRESHOLD) return;
  host.failedAt.clear();
  host.unavailableUntil = now + FREE_PUBLIC_HOST_UNAVAILABLE_MS;
  host.probedAt = now;
  if (!ownsStoredSwitch(fetcher)) return;
  try { window.localStorage.setItem(FREE_PUBLIC_HOST_STORAGE_KEY, String(host.unavailableUntil)); } catch { /* memory only */ }
}

function markPublicHostReachable(fetcher: Fetcher): void {
  const host = publicHost(fetcher);
  host.unavailableUntil = 0;
  host.failedAt.clear();
  if (!ownsStoredSwitch(fetcher)) return;
  try { window.localStorage.removeItem(FREE_PUBLIC_HOST_STORAGE_KEY); } catch { /* memory only */ }
}

function firstPublicUrl(index: FreeAssetIndex | null): string | undefined {
  for (const question of Object.values(index?.questions ?? {})) {
    for (const kind of ASSET_KINDS) {
      const url = question?.[kind]?.urls?.[0];
      if (isFreePublicAssetUrl(url)) return url;
    }
  }
}

/**
 * In the background, and never delaying the signed links being returned: fetch one public
 * object. no-cors means any response proves the host is reachable without needing CORS, and
 * no-store keeps a cached copy from vouching for the current network.
 */
function probePublicHost(bank: BankSlug, fetcher: Fetcher, now: number): void {
  const host = publicHost(fetcher);
  if (host.probing || now - host.probedAt < FREE_PUBLIC_HOST_PROBE_INTERVAL_MS) return;
  host.probing = true;
  host.probedAt = now;
  const loaded = loadFreeAssetIndex(bank, fetcher);
  void loaded.index
    .then(async (index) => {
      const url = firstPublicUrl(index);
      if (!url) return;
      const response = await fetcher(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(FREE_PUBLIC_HOST_PROBE_TIMEOUT_MS) });
      void response.body?.cancel().catch(() => {});
      markPublicHostReachable(fetcher);
    })
    .catch(() => { /* still unreachable: try again after the interval */ })
    .finally(() => { host.probing = false; });
}

/** Free assets only: no identity, private links or entitlement decisions are stored here. */
export function preferSignedFreeAssets(bank: BankSlug, request: AssetRequest, fetcher: Fetcher = fetch): void {
  let failures = publicFailures.get(fetcher);
  if (!failures) publicFailures.set(fetcher, failures = new Map());
  const now = Date.now();
  for (const [key, failure] of failures) if (failure.until <= now) failures.delete(key);
  const key = publicFailureKey(bank, request);
  if (!failures.has(key)) failures.set(key, { until: now + FREE_PUBLIC_FAILURE_COOLDOWN_MS });
  recordPublicHostFailure(fetcher, key, now);
}

/**
 * Explicit user retries may probe again without resetting unrelated automatic recovery.
 * An unreachable-host switch stays: probing a blocked host again would only slow the retry.
 */
export function resetFreeAssetRecovery(bank: BankSlug, requests: readonly AssetRequest[], fetcher: Fetcher = fetch): void {
  const failures = publicFailures.get(fetcher);
  for (const request of requests) failures?.delete(publicFailureKey(bank, request));
}

/**
 * The bank's static index, re-read once it is a day old so a long-open tab picks up a deploy.
 * A failed or invalid read isn't kept: the next request tries again.
 */
function loadFreeAssetIndex(bank: BankSlug, fetcher: Fetcher): LoadedIndex {
  let byBank = freeIndexes.get(fetcher);
  if (!byBank) freeIndexes.set(fetcher, byBank = new Map());
  const cached = byBank.get(bank);
  if (cached && Date.now() - cached.loadedAt < FREE_PUBLIC_ASSET_LIFETIME_MS) return cached;
  const loaded: LoadedIndex = {
    loadedAt: Date.now(),
    index: fetcher(freeAssetIndexPath(bank))
      .then(async (response) => {
        const index = response.ok ? await response.json().catch(() => null) as FreeAssetIndex | null : null;
        return index && index.version === FREE_ASSET_INDEX_VERSION && index.bank === bank && index.questions && typeof index.questions === "object" ? index : null;
      })
      .catch(() => null),
  };
  byBank.set(bank, loaded);
  void loaded.index.then((index) => { if (!index && byBank.get(bank) === loaded) byBank.delete(bank); });
  return loaded;
}

/** A public link lives as long as the index read it came from. */
function publicFreeAsset(index: FreeAssetIndex | null, loadedAt: number, request: AssetRequest): SignedAsset | null {
  const question = index?.questions[request.questionId];
  const entry = question?.[request.kind];
  if (!question || !entry || !validDetails(question.details)) return null;
  const asset = { questionId: request.questionId, kind: request.kind, urls: entry.urls, displayCrops: entry.displayCrops, details: question.details, ...(entry.mcqAnswer !== undefined ? { mcqAnswer: entry.mcqAnswer } : {}) };
  if (!validAsset(asset) || !asset.urls.every(isFreePublicAssetUrl)) return null;
  return { ...asset, expiresAt: loadedAt + FREE_PUBLIC_ASSET_LIFETIME_MS };
}

/**
 * Free-year assets: public links from the static per-bank index when it has them, otherwise
 * the CDN-cached signing route (one request per asset so cache keys ignore filters). While the
 * public host is unreachable from this browser, every asset goes straight to the signing route.
 */
export async function fetchFreeAssets(
  bank: BankSlug,
  requests: readonly AssetRequest[],
  fetcher: Fetcher = fetch,
): Promise<{ assets: Map<string, SignedAsset>; failedKeys: string[] }> {
  const hostUnavailable = publicHostUnavailable(fetcher, Date.now());
  if (hostUnavailable) probePublicHost(bank, fetcher, Date.now());
  const results = await Promise.all(requests.map(async (request) => {
    const key = signedAssetKey(request.questionId, request.kind);
    const failureKey = publicFailureKey(bank, request);
    let failure = publicFailures.get(fetcher)?.get(failureKey);
    if (failure && failure.until <= Date.now()) {
      publicFailures.get(fetcher)?.delete(failureKey);
      failure = undefined;
    }
    // Known public failures must not wait for an unrelated static-index refresh.
    if (!failure && !hostUnavailable) {
      const loaded = loadFreeAssetIndex(bank, fetcher);
      const index = await loaded.index;
      const publicAsset = publicFreeAsset(index, loaded.loadedAt, request);
      if (publicAsset) return { key, asset: publicAsset };
    }
    const rescue = async (): Promise<SignedAsset | null> => {
      try {
        const query = new URLSearchParams({ bank, id: request.questionId, kind: request.kind });
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await fetcher(`/api/assets/free?${query}`, attempt ? { cache: "reload", headers: { "cache-control": "no-cache", pragma: "no-cache" } } : undefined);
          const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
          if (
            !response.ok || !payload ||
            typeof payload.expiresIn !== "number" || !Number.isSafeInteger(payload.expiresIn) ||
            payload.expiresIn <= FREE_ASSET_SAFETY_SECONDS || payload.expiresIn > FREE_ASSET_EXPIRES_IN ||
            typeof payload.maxAge !== "number" || !Number.isSafeInteger(payload.maxAge) ||
            payload.maxAge < 0 || payload.maxAge >= payload.expiresIn - FREE_ASSET_SAFETY_SECONDS ||
            !validAsset(payload.asset) ||
            signedAssetKey(payload.asset.questionId, payload.asset.kind) !== key
          ) throw new Error("Invalid free asset response");
          // Assume the full CDN window even without Age; honor a reported older copy too.
          const reportedAge = Number(response.headers?.get("age"));
          const age = Math.max(Number.isFinite(reportedAge) ? reportedAge : 0, payload.maxAge);
          const lifetime = payload.expiresIn - age - FREE_ASSET_SAFETY_SECONDS;
          // Never turn an expired link into a one-second success: it can trigger a refetch loop.
          // Try one synchronous revalidation, then surface a normal per-asset failure.
          if (lifetime <= 0) continue;
          return { ...payload.asset, expiresAt: Math.min(Date.now() + lifetime * 1000, failure?.until ?? Infinity) } as SignedAsset;
        }
        throw new Error("Expired free asset response");
      } catch {
        return null;
      }
    };
    // Keep both successful and failed rescue results for this cooldown. Duplicate image
    // callbacks and concurrent renders must not produce another fallback request.
    const asset = await (failure ? (failure.rescue ??= rescue()) : rescue());
    return { key, asset: isSignedAssetFresh(asset ?? undefined) ? asset : null };
  }));
  return {
    assets: new Map(results.flatMap(({ key, asset }) => asset ? [[key, asset] as const] : [])),
    failedKeys: results.flatMap(({ key, asset }) => asset ? [] : [key]),
  };
}
