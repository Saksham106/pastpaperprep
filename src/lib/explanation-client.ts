import type { BankSlug } from "@/lib/banks";
import { parseExplanation, type Explanation } from "@/lib/explanation-format";
import { isFreePublicAssetUrl } from "@/lib/free-asset-index";
import { fetchFreeAssets, fetchSignedAssets, preferSignedFreeAssets, signedAssetKey } from "@/lib/signed-assets";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Loads one question's worked explanation: a signed link from the same routes and access rules as
 * the mark scheme, then the JSON itself. Free-year questions use the CDN-cached free route.
 * Development only: NEXT_PUBLIC_EXPLANATIONS_DEV=1 reads public/dev-explanations/<bank>/<id>.json.
 */
export async function fetchExplanation(
  bank: BankSlug,
  questionId: string,
  { free, fetcher = fetch, isCurrent = () => true }: { free: boolean; fetcher?: Fetcher; isCurrent?: () => boolean },
): Promise<Explanation> {
  // Stop before each request once the page's account scope has ended (sign-out or a new account).
  const assertCurrent = () => { if (!isCurrent()) throw new DOMException("Explanation request scope expired", "AbortError"); };
  assertCurrent();
  let url: string | undefined;
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_EXPLANATIONS_DEV === "1") {
    url = `/dev-explanations/${encodeURIComponent(bank)}/${encodeURIComponent(questionId)}.json`;
  } else {
    const request = [{ questionId, kind: "explanation" as const }];
    const key = signedAssetKey(questionId, "explanation");
    const asset = free
      ? (await fetchFreeAssets(bank, request, fetcher)).assets.get(key)
      : (await fetchSignedAssets(bank, request, fetcher, false, isCurrent)).get(key);
    url = asset?.urls[0];
  }
  if (!url) throw new Error("Explanation unavailable");
  const read = async (from: string) => {
    assertCurrent();
    const response = await fetcher(from, { mode: "cors", cache: "no-store" }).catch(() => null);
    return response?.ok ? parseExplanation(await response.json().catch(() => null), bank, questionId) : null;
  };
  let explanation = await read(url);
  if (!explanation && free && isFreePublicAssetUrl(url)) {
    // The public copy is missing, unreachable or not this question's: fall back to a signed link once.
    assertCurrent();
    preferSignedFreeAssets(bank);
    const signed = (await fetchFreeAssets(bank, [{ questionId, kind: "explanation" }], fetcher)).assets.get(signedAssetKey(questionId, "explanation"))?.urls[0];
    explanation = signed ? await read(signed) : null;
  }
  assertCurrent();
  if (!explanation) throw new Error("Explanation unavailable");
  return explanation;
}
