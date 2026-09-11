import { NextResponse } from "next/server";
import { canExportPdf, isPreviewQuestion } from "@/lib/access";
import { authorizeAssetRequests, type AssetRequest, type AuthorizedAssetRequest } from "@/lib/asset-access";
import { getBank, type BankSlug } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { MAX_PDF_QUESTIONS } from "@/lib/export-limits";
import { signPrivateAssetUrls } from "@/lib/private-assets";
import { loadBankQuestions } from "@/lib/question-loader";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const AUTHORIZATION_BATCH_SIZE = 20;
const PRIVATE_RESPONSE_INIT = {
  headers: { "Cache-Control": "private, no-store, max-age=0" },
} as const;
type PdfContent = "questions" | "answers" | "both";
type RequestBody = { bank?: unknown; questionIds?: unknown; content?: unknown };

function validQuestionIds(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= MAX_PDF_QUESTIONS &&
    value.every((id) => typeof id === "string" && id.length > 0) &&
    new Set(value).size === value.length;
}

function validContent(value: unknown): value is PdfContent {
  return value === "questions" || value === "answers" || value === "both";
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body || typeof body !== "object" || Array.isArray(body) ||
    typeof body.bank !== "string" || !getBank(body.bank) ||
    !validQuestionIds(body.questionIds) || !validContent(body.content)
  ) return NextResponse.json({ error: "Invalid PDF export request" }, { status: 400 });

  const bank = body.bank as BankSlug;
  const canonicalById = new Map((await loadBankQuestions(bank)).map((question) => [question.id, question]));
  const questions = body.questionIds.map((id) => canonicalById.get(id));
  if (questions.some((question) => !question)) {
    return NextResponse.json({ error: "Invalid PDF export request" }, { status: 400 });
  }

  const assetRequests: AssetRequest[] = questions.flatMap((question) => {
    if (!question) return [];
    const requests: AssetRequest[] = [];
    if (body.content !== "answers") requests.push({ questionId: question.id, kind: "question" });
    if (body.content !== "questions" && question.markschemeAssetPaths.length > 0) {
      requests.push({ questionId: question.id, kind: "answer" });
    }
    return requests;
  });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data, error } = await supabase
    .from("entitlements")
    .select("product_id, selected_bank_ids, status, starts_at, expires_at")
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Could not verify access" }, { status: 503 });
  const entitlements = normalizeEntitlements(data ?? []);
  if (!canExportPdf(bank, entitlements)) {
    return NextResponse.json({ error: "Paid access to this question bank is required for PDF export" }, { status: 403 });
  }

  const authorized: AuthorizedAssetRequest[] = [];
  try {
    for (let index = 0; index < assetRequests.length; index += AUTHORIZATION_BATCH_SIZE) {
      authorized.push(...await authorizeAssetRequests(
        bank,
        assetRequests.slice(index, index + AUTHORIZATION_BATCH_SIZE),
        entitlements,
      ));
    }
  } catch {
    return NextResponse.json({ error: "Invalid PDF export request" }, { status: 400 });
  }

  const paths = [...new Set(authorized.flatMap((item) => item.paths))];
  const previewPaths = [...new Set(authorized
    .filter((item) => isPreviewQuestion(bank, item.questionId))
    .flatMap((item) => item.paths))];
  const previewPathSet = new Set(previewPaths);
  const premiumPaths = paths.filter((path) => !previewPathSet.has(path));
  const premiumPathCount = premiumPaths.length;

  try {
    let assets: Array<{ questionId: string; kind: "question" | "answer"; urls: Array<string | undefined> }> = [];
    if (paths.length) {
      const [previewUrls, premiumUrls] = await Promise.all([
        signPrivateAssetUrls(previewPaths, 600, { provider: "supabase" }),
        signPrivateAssetUrls(premiumPaths, 600),
      ]);
      const urlByPath = new Map([...previewUrls, ...premiumUrls]);
      assets = authorized.map((item) => ({
        questionId: item.questionId,
        kind: item.kind,
        urls: item.paths.map((path) => urlByPath.get(path)),
      }));
    }

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_download_allowance", {
      p_asset_count: premiumPathCount,
      p_pdf_question_count: body.questionIds.length,
    });
    if (quotaError) return NextResponse.json({ error: "Could not verify export allowance" }, { status: 503 });
    if (!allowed) return NextResponse.json({ error: "Daily worksheet limit reached. Try again tomorrow." }, { status: 429 });

    return NextResponse.json({ expiresIn: 600, assets }, PRIVATE_RESPONSE_INIT);
  } catch {
    return NextResponse.json({ error: "Private assets are temporarily unavailable" }, { status: 503 });
  }
}
