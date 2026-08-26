import { NextResponse } from "next/server";
import { hasBankAccess, isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { authorizeAssetRequests, type AssetRequest } from "@/lib/asset-access";
import { QUESTION_ASSET_BUCKET } from "@/lib/assets";
import { getBank, type BankSlug } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
      .select("product_id, status, starts_at, expires_at")
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Could not verify access" }, { status: 503 });
    entitlements = normalizeEntitlements(data ?? []);
  }

  let authorized;
  try {
    authorized = authorizeAssetRequests(
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
  const premiumPaths = [...new Set(authorized
    .filter((item) => !isPreviewQuestion(body.bank as BankSlug, item.questionId))
    .flatMap((item) => item.paths))];

  if (!paths.length) {
    return NextResponse.json({ assets: authorized.map((item) => ({ ...item, urls: [] })) });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(QUESTION_ASSET_BUCKET)
      .createSignedUrls(paths, 600);
    if (error) throw error;

    const urlByPath = new Map((data ?? []).flatMap((item) =>
      item.signedUrl ? [[item.path, item.signedUrl] as const] : []
    ));
    if (paths.some((path) => !urlByPath.has(path))) throw new Error("A signed URL was not created");

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
        urls: item.paths.map((path) => urlByPath.get(path)),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Private assets are temporarily unavailable" }, { status: 503 });
  }
}
