import type { AssetKind, AssetRequest } from "@/lib/asset-access";
import { isAssetKind } from "@/lib/asset-kinds";
import type { QuestionRichDetails } from "@/lib/questions";
import type { BankSlug } from "@/lib/banks";
import type { SourcePrintSegment } from "@/lib/print-geometry";
import type { VisibleImageCrop } from "@/lib/reviewed-blank-tails";

const SIGN_BATCH_SIZE = 20;
/**
 * Free-year links: signed for a day and shared by the CDN for up to 20 hours, so each free
 * image is signed by a function about once a day per region instead of four times an hour.
 * Only free-year questions use these; paid assets keep 10-minute links behind sign-in.
 */
export const FREE_ASSET_EXPIRES_IN = 86_400;
export const FREE_ASSET_CDN_MAX_AGE = 72_000;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SignedAsset = AssetRequest & {
  urls: string[];
  expiresAt: number;
  details?: QuestionRichDetails;
  printSizesPt?: Array<[number, number] | null>;
  printSegments?: Array<SourcePrintSegment[] | null>;
  rasterSizesPx?: Array<[number, number] | null>;
  displayCrops?: Array<VisibleImageCrop | null>;
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

function validAsset(value: unknown, localPreview = false): value is AssetRequest & { urls: string[]; details?: QuestionRichDetails; printSizesPt?: Array<[number, number] | null>; printSegments?: Array<SourcePrintSegment[] | null>; rasterSizesPx?: Array<[number, number] | null>; displayCrops?: Array<VisibleImageCrop | null> } {
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
    (asset.details === undefined || validDetails(asset.details))
  );
}

export async function fetchSignedAssets(
  bank: BankSlug,
  requests: readonly AssetRequest[],
  fetcher: Fetcher = fetch,
  localPreview = false,
): Promise<Map<string, SignedAsset>> {
  const signed = new Map<string, SignedAsset>();

  for (let index = 0; index < requests.length; index += SIGN_BATCH_SIZE) {
    const batch = requests.slice(index, index + SIGN_BATCH_SIZE);
    const expected = new Set(batch.map((request) => signedAssetKey(request.questionId, request.kind)));
    const response = await fetcher(localPreview ? "/api/local-preview-assets/sign" : "/api/assets/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bank, requests: batch }),
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

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
    for (const asset of payload.assets) {
      const key = signedAssetKey(asset.questionId, asset.kind);
      if (!expected.delete(key) || signed.has(key)) throw new Error("Invalid signed asset response");
      signed.set(key, { ...asset, expiresAt });
    }
    if (expected.size) throw new Error("Invalid signed asset response");
  }

  return signed;
}

export async function fetchPdfAssets(
  bank: BankSlug,
  questionIds: readonly string[],
  content: "questions" | "answers" | "both",
  fetcher: Fetcher = fetch,
  localPreview = false,
): Promise<Map<string, SignedAsset>> {
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
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Could not authorize PDF assets";
    throw new Error(message);
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

/** Free-year assets through the CDN-cached GET route; one request per asset so cache keys ignore filters. */
export async function fetchFreeAssets(
  bank: BankSlug,
  requests: readonly AssetRequest[],
  fetcher: Fetcher = fetch,
): Promise<{ assets: Map<string, SignedAsset>; failedKeys: string[] }> {
  const results = await Promise.all(requests.map(async (request) => {
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
      // A CDN copy is normally at most maxAge old; trust a larger Age header if the CDN reports
      // one, so a stale copy can never hand out a link that is already dead.
      const reportedAge = Number(response.headers?.get("age"));
      const age = Math.max(Number.isFinite(reportedAge) ? reportedAge : 0, payload.maxAge);
      const lifetime = Math.max(payload.expiresIn - age - FREE_ASSET_SAFETY_SECONDS, 1);
      return { key, asset: { ...payload.asset, expiresAt: Date.now() + lifetime * 1000 } as SignedAsset };
    } catch {
      return { key, asset: null };
    }
  }));
  return {
    assets: new Map(results.flatMap(({ key, asset }) => asset ? [[key, asset] as const] : [])),
    failedKeys: results.flatMap(({ key, asset }) => asset ? [] : [key]),
  };
}
