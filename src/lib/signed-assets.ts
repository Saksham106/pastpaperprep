import type { AssetKind, AssetRequest } from "@/lib/asset-access";
import type { BankSlug } from "@/lib/banks";

const SIGN_BATCH_SIZE = 20;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SignedAsset = AssetRequest & {
  urls: string[];
  expiresAt: number;
};

export function signedAssetKey(questionId: string, kind: AssetKind): string {
  return `${questionId}:${kind}`;
}

export function isSignedAssetFresh(asset: SignedAsset | undefined, now = Date.now()): asset is SignedAsset {
  return Boolean(asset && asset.expiresAt > now);
}

function validAsset(value: unknown): value is AssetRequest & { urls: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.questionId === "string" &&
    (asset.kind === "question" || asset.kind === "answer") &&
    Array.isArray(asset.urls) &&
    asset.urls.every((url) => typeof url === "string" && /^https:\/\//.test(url))
  );
}

export async function fetchSignedAssets(
  bank: BankSlug,
  requests: readonly AssetRequest[],
  fetcher: Fetcher = fetch,
): Promise<Map<string, SignedAsset>> {
  const signed = new Map<string, SignedAsset>();

  for (let index = 0; index < requests.length; index += SIGN_BATCH_SIZE) {
    const batch = requests.slice(index, index + SIGN_BATCH_SIZE);
    const expected = new Set(batch.map((request) => signedAssetKey(request.questionId, request.kind)));
    const response = await fetcher("/api/assets/sign", {
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
      !payload.assets.every(validAsset)
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
