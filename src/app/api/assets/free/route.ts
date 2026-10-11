import { NextResponse, type NextRequest } from "next/server";
import { isPreviewQuestion } from "@/lib/access";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { getBank, type BankSlug } from "@/lib/banks";
import { previewAssetSignOptions, signPrivateAssetUrls } from "@/lib/private-assets";
import { richDetailsFor } from "@/lib/question-delivery";
import { reviewedBlankTailForSignedAsset } from "@/lib/reviewed-blank-tails";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { FREE_ASSET_CDN_FRESH, FREE_ASSET_CDN_MAX_AGE, FREE_ASSET_CDN_STALE, FREE_ASSET_EXPIRES_IN } from "@/lib/signed-assets";

export const runtime = "nodejs";

const NO_STORE = { headers: { "Cache-Control": "private, no-store, max-age=0" } } as const;
const SHARED = { headers: { "Cache-Control": `public, max-age=0, s-maxage=${FREE_ASSET_CDN_FRESH}, stale-while-revalidate=${FREE_ASSET_CDN_STALE}` } } as const;

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
  const manifest = await loadBankAssetManifest(bank).catch(() => null);
  if (!manifest) return NextResponse.json({ error: "Private assets are temporarily unavailable" }, { status: 503, ...NO_STORE });
  const entry = manifest.get(questionId);
  if (!entry) return NextResponse.json({ error: "Unknown question" }, { status: 404, ...NO_STORE });

  const paths = kind === "question" ? entry.questionAssetPaths : entry.markschemeAssetPaths;
  let urlByPath: Awaited<ReturnType<typeof signPrivateAssetUrls>>;
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
