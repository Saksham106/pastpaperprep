import { NextResponse } from "next/server";
import { hasBankAccess, isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { authorizeAssetRequests, type AssetRequest } from "@/lib/asset-access";
import { getBank, type BankSlug } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { signPrivateAssetUrls } from "@/lib/private-assets";
import { getQuestionRichDetails } from "@/lib/question-delivery";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRIVATE_RESPONSE_INIT = {
  headers: { "Cache-Control": "private, no-store, max-age=0" },
} as const;

type SignRequestBody = {
  bank?: unknown;
  requests?: unknown;
};

export async function POST(request: Request) {
  let body: SignRequestBody;
  try {
    body = await request.json() as SignRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.bank !== "string" ||
    !getBank(body.bank) ||
    !Array.isArray(body.requests)
  ) {
    return NextResponse.json({ error: "Invalid asset request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  let entitlements: AccessEntitlement[] = [];

  if (userId) {
    const { data, error } = await supabase
      .from("entitlements")
      .select("product_id, selected_bank_ids, status, starts_at, expires_at")
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Could not verify access" }, { status: 503 });
    entitlements = normalizeEntitlements(data ?? []);
  }

  let authorized;
  try {
    authorized = await authorizeAssetRequests(
      body.bank as BankSlug,
      body.requests as AssetRequest[],
      entitlements,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid asset request";
    const status = /not authorized/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: status === 403 ? "Access required" : message }, { status });
  }

  const paths = [...new Set(authorized.flatMap((item) => item.paths))];
  const previewPaths = [...new Set(authorized
    .filter((item) => isPreviewQuestion(body.bank as BankSlug, item.questionId))
    .flatMap((item) => item.paths))];
  const previewPathSet = new Set(previewPaths);
  const premiumPaths = paths.filter((path) => !previewPathSet.has(path));

  if (!paths.length) {
    return NextResponse.json({
      expiresIn: 600,
      assets: authorized.map((item) => ({
        questionId: item.questionId,
        kind: item.kind,
        details: getQuestionRichDetails(item.question, entitlements),
        urls: [],
      })),
    }, PRIVATE_RESPONSE_INIT);
  }

  try {
    const [previewUrls, premiumUrls] = await Promise.all([
      signPrivateAssetUrls(previewPaths, 600, { provider: "supabase" }),
      signPrivateAssetUrls(premiumPaths, 600),
    ]);
    const urlByPath = new Map([...previewUrls, ...premiumUrls]);

    if (userId && premiumPaths.length && hasBankAccess(body.bank as BankSlug, entitlements)) {
      const { data: allowed, error: quotaError } = await supabase.rpc("consume_download_allowance", {
        p_asset_count: premiumPaths.length,
        p_pdf_question_count: 0,
      });
      if (quotaError) return NextResponse.json({ error: "Could not verify download allowance" }, { status: 503 });
      if (!allowed) return NextResponse.json({ error: "Daily download limit reached. Try again tomorrow." }, { status: 429 });
    }

    return NextResponse.json({
      expiresIn: 600,
      assets: authorized.map((item) => ({
        questionId: item.questionId,
        kind: item.kind,
        details: getQuestionRichDetails(item.question, entitlements),
        urls: item.paths.map((path) => urlByPath.get(path)),
      })),
    }, PRIVATE_RESPONSE_INIT);
  } catch {
    return NextResponse.json({ error: "Private assets are temporarily unavailable" }, { status: 503 });
  }
}
