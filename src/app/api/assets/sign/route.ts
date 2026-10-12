import { NextResponse } from "next/server";
import { annotateFailureResponse, withFailureReporting, type FailureDiagnostics } from "@/lib/route-failure-reporting";
import { hasBankAccess, isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import type { AssetRequest } from "@/lib/asset-access";
import { authorizeManifestAssetRequests, loadBankAssetManifest } from "@/lib/asset-manifest";
import { getBank, type BankSlug } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { explanationAssetSignOptions, premiumAssetSignOptions, previewAssetSignOptions, resolvedAssetSignProvider, signPrivateAssetUrls } from "@/lib/private-assets";
import { richDetailsFor } from "@/lib/question-delivery";
import { reviewedBlankTailForSignedAsset } from "@/lib/reviewed-blank-tails";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRIVATE_RESPONSE_INIT = {
  headers: { "Cache-Control": "private, no-store, max-age=0" },
} as const;

type SignRequestBody = {
  bank?: unknown;
  requests?: unknown;
};

// The wrapper contains only an enumerated provider, never an upstream error/cause.
class AssetSigningFailure extends Error {
  constructor(readonly provider: "r2" | "supabase") { super("Asset signing failed"); }
}
async function signWithDiagnostics(paths: string[], options: Parameters<typeof signPrivateAssetUrls>[2]) {
  const provider = resolvedAssetSignProvider(options);
  try { return await signPrivateAssetUrls(paths, 600, options); }
  catch { throw new AssetSigningFailure(provider); }
}

async function handlePOST(request: Request) {
  let body: SignRequestBody;
  try {
    body = await request.json() as SignRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, ...PRIVATE_RESPONSE_INIT });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.bank !== "string" ||
    !getBank(body.bank) ||
    !Array.isArray(body.requests)
  ) {
    return NextResponse.json({ error: "Invalid asset request" }, { status: 400, ...PRIVATE_RESPONSE_INIT });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  let entitlements: AccessEntitlement[] = [];

  if (userId) {
    const result = await fetchAccessEntitlements(supabase as never, userId);
    if (result.error) return annotateFailureResponse(NextResponse.json({ error: "Could not verify access" }, { status: 503, ...PRIVATE_RESPONSE_INIT }), { bank: body.bank, stage: "entitlement", storage_provider: "supabase", error_code: "entitlement_unavailable" });
    entitlements = result.rows as AccessEntitlement[];
  }

  const manifest = await loadBankAssetManifest(body.bank as BankSlug).catch(() => null);
  if (!manifest) return annotateFailureResponse(NextResponse.json({ error: "Private assets are temporarily unavailable" }, { status: 503, ...PRIVATE_RESPONSE_INIT }), { bank: body.bank, stage: "manifest", storage_provider: "local", error_code: "manifest_unavailable" });

  let authorized;
  try {
    authorized = authorizeManifestAssetRequests(
      body.bank as BankSlug,
      body.requests as AssetRequest[],
      entitlements,
      manifest,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid asset request";
    const status = /not authorized/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: status === 403 ? "Access required" : message }, { status, ...PRIVATE_RESPONSE_INIT });
  }

  const paths = [...new Set(authorized.flatMap((item) => item.paths))];
  // Explanations are JSON in R2 for every question. They skip the download allowance and have their own daily cap.
  const explanationPaths = [...new Set(authorized.filter((item) => item.kind === "explanation").flatMap((item) => item.paths))];
  const explanationPathSet = new Set(explanationPaths);
  const previewPaths = [...new Set(authorized
    .filter((item) => item.kind !== "explanation" && isPreviewQuestion(body.bank as BankSlug, item.questionId))
    .flatMap((item) => item.paths))];
  const previewPathSet = new Set(previewPaths);
  const premiumPaths = paths.filter((path) => !previewPathSet.has(path) && !explanationPathSet.has(path));

  if (!paths.length) {
    return NextResponse.json({
      expiresIn: 600,
      assets: authorized.map((item) => ({
        questionId: item.questionId,
        kind: item.kind,
        details: richDetailsFor(body.bank as BankSlug, item.questionId, item.details, entitlements),
        urls: [],
      })),
    }, PRIVATE_RESPONSE_INIT);
  }

  let stage: FailureDiagnostics["stage"] = "signing";
  try {
    const previewOptions = previewAssetSignOptions(body.bank as BankSlug);
    const premiumOptions = premiumAssetSignOptions(body.bank as BankSlug);
    const [previewUrls, premiumUrls] = resolvedAssetSignProvider(previewOptions) === resolvedAssetSignProvider(premiumOptions)
      ? [await signWithDiagnostics([...previewPaths, ...premiumPaths], previewOptions), new Map<string, string>()]
      : await Promise.all([
        signWithDiagnostics(previewPaths, previewOptions),
        signWithDiagnostics(premiumPaths, premiumOptions),
      ]);
    const explanationUrls = await signWithDiagnostics(explanationPaths, explanationAssetSignOptions());
    const urlByPath = new Map([...previewUrls, ...premiumUrls, ...explanationUrls]);

    const paidExplanationCount = authorized.filter((item) => item.kind === "explanation" && item.paths.length && !isPreviewQuestion(body.bank as BankSlug, item.questionId)).length;
    // A mixed response must commit both counters together: a denied image quota must
    // not spend explanations that are withheld, and vice versa.
    const mixedPaidAssets = Boolean(userId && paidExplanationCount && premiumPaths.length);
    if (userId && paidExplanationCount) {
      stage = "quota";
      const { data: allowed, error: capError } = mixedPaidAssets
        ? await supabase.rpc("consume_explanation_and_download_allowance", { p_count: paidExplanationCount, p_asset_count: premiumPaths.length })
        : await supabase.rpc("consume_explanation_allowance", { p_count: paidExplanationCount });
      if (capError) return annotateFailureResponse(NextResponse.json({ error: "Could not verify explanation allowance" }, { status: 503, ...PRIVATE_RESPONSE_INIT }), { bank: body.bank, stage: "quota", storage_provider: "supabase", error_code: "quota_unavailable" });
      if (!allowed) return NextResponse.json({
        error: mixedPaidAssets
          ? "Daily explanation or download limit reached. Try again tomorrow."
          : "Daily explanation limit reached. Try again tomorrow.",
      }, { status: 429, ...PRIVATE_RESPONSE_INIT });
    }

    if (!mixedPaidAssets && userId && premiumPaths.length && hasBankAccess(body.bank as BankSlug, entitlements)) {
      stage = "quota";
      const { data: allowed, error: quotaError } = await supabase.rpc("consume_download_allowance", {
        p_asset_count: premiumPaths.length,
        p_pdf_question_count: 0,
      });
      if (quotaError) return annotateFailureResponse(NextResponse.json({ error: "Could not verify download allowance" }, { status: 503, ...PRIVATE_RESPONSE_INIT }), { bank: body.bank, stage: "quota", storage_provider: "supabase", error_code: "quota_unavailable" });
      if (!allowed) return NextResponse.json({ error: "Daily download limit reached. Try again tomorrow." }, { status: 429, ...PRIVATE_RESPONSE_INIT });
    }

    stage = "response";
    return NextResponse.json({
      expiresIn: 600,
      assets: authorized.map((item) => ({
        questionId: item.questionId,
        kind: item.kind,
        details: richDetailsFor(body.bank as BankSlug, item.questionId, item.details, entitlements),
        urls: item.paths.map((path) => urlByPath.get(path)),
        displayCrops: item.paths.map((path) => reviewedBlankTailForSignedAsset(body.bank as BankSlug, item.questionId, item.kind, path)),
      })),
    }, PRIVATE_RESPONSE_INIT);
  } catch (error) {
    return annotateFailureResponse(NextResponse.json({ error: "Private assets are temporarily unavailable" }, { status: 503, ...PRIVATE_RESPONSE_INIT }), {
      bank: body.bank, stage,
      storage_provider: error instanceof AssetSigningFailure ? error.provider : stage === "quota" ? "supabase" : "unknown",
      error_code: stage === "quota" ? "quota_unavailable" : stage === "response" ? "response_failed" : "signing_failed",
    });
  }
}

export const POST = withFailureReporting("/api/assets/sign", handlePOST);
