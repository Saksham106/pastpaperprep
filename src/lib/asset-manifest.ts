import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canViewAnswer, canViewQuestionAsset, type AccessEntitlement } from "@/lib/access";
import type { AssetRequest } from "@/lib/asset-access";
import { assetPathsForKind, isAssetKind } from "@/lib/asset-kinds";
import { bankRuntimeCacheKey } from "@/lib/bank-runtime-key";
import type { BankSlug } from "@/lib/banks";
import type { QuestionRichDetails } from "@/lib/questions";

// Server-only: entries hold premium text. Nothing here may import the question loader, so the
// routes that read manifests stay small instead of bundling the whole corpus.
export type AssetManifestEntry = { questionAssetPaths: string[]; markschemeAssetPaths: string[]; explanationAssetPaths?: string[]; details: QuestionRichDetails };
export type AssetManifest = ReadonlyMap<string, AssetManifestEntry>;

/** The runtime mode is part of the name, so a flag flip never reads a manifest built for the other mode. */
export function assetManifestFileName(slug: BankSlug): string {
  return `${bankRuntimeCacheKey(slug).replace(":", ".")}.json`;
}

const cache = new Map<string, Promise<AssetManifest>>();

/**
 * Asset paths and rich details for one bank, written by `npm run generate:asset-manifest`
 * (prebuild, predev, pretest). The path is a constant so file tracing ships only that directory.
 */
export function loadBankAssetManifest(
  slug: BankSlug,
  read: (path: string) => Promise<string> = (path) => readFile(path, "utf8"),
): Promise<AssetManifest> {
  const name = assetManifestFileName(slug);
  const cached = cache.get(name);
  if (cached) return cached;
  const loaded = read(join(process.cwd(), "generated", "asset-manifest", assetManifestFileName(slug)))
    .then((text) => new Map(Object.entries(JSON.parse(text) as Record<string, AssetManifestEntry>)) as AssetManifest);
  cache.set(name, loaded);
  void loaded.catch(() => { if (cache.get(name) === loaded) cache.delete(name); });
  return loaded;
}

export type ManifestAuthorizedAssetRequest = AssetRequest & { paths: string[]; details: QuestionRichDetails };

/** Same checks as authorizeAssetRequests, against a prebuilt manifest. */
export function authorizeManifestAssetRequests(
  bankSlug: BankSlug,
  requests: readonly AssetRequest[],
  entitlements: readonly AccessEntitlement[],
  manifest: AssetManifest,
  now = new Date(),
): ManifestAuthorizedAssetRequest[] {
  if (requests.length < 1 || requests.length > 20) {
    throw new Error("Asset request batch must contain between 1 and 20 items");
  }
  const seen = new Set<string>();
  return requests.map((request) => {
    if (!request || typeof request.questionId !== "string" || !isAssetKind(request.kind)) {
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
      paths: assetPathsForKind(entry, request.kind),
    };
  });
}
