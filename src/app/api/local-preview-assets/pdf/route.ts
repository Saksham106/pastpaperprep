import { NextResponse } from "next/server";
import { authorizeLocalPreviewAssetRequests, type AssetRequest } from "@/lib/asset-access";
import { isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { isLocalEconomicsPreviewEnabled, localPreviewSourceRoot } from "@/lib/local-preview";
import { MAX_PDF_QUESTIONS } from "@/lib/export-limits";

type PdfContent = "questions" | "answers" | "both";
type Body = { bank?: unknown; questionIds?: unknown; content?: unknown };
const PRIVATE_RESPONSE_INIT = { headers: { "Cache-Control": "private, no-store, max-age=0" } } as const;

export const runtime = "nodejs";

function validQuestionIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= MAX_PDF_QUESTIONS && value.every((id) => typeof id === "string" && id.length > 0) && new Set(value).size === value.length;
}

function validContent(value: unknown): value is PdfContent {
  return value === "questions" || value === "answers" || value === "both";
}

export async function POST(request: Request) {
  if (!isLocalEconomicsPreviewEnabled() || !localPreviewSourceRoot()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body.bank !== "string" || !isLocalEconomicsBank(body.bank) || !validQuestionIds(body.questionIds) || !validContent(body.content)) {
    return NextResponse.json({ error: "Invalid PDF export request" }, { status: 400 });
  }

  const bank = body.bank as BankSlug;
  const questions = await import("@/lib/question-loader").then(({ loadBankQuestions }) => loadBankQuestions(bank));
  const byId = new Map(questions.map((question) => [question.id, question]));
  const selected = body.questionIds.map((id) => byId.get(id));
  if (selected.some((question) => !question)) return NextResponse.json({ error: "Invalid PDF export request" }, { status: 400 });

  const requests: AssetRequest[] = selected.flatMap((question) => {
    if (!question) return [];
    const result: AssetRequest[] = [];
    if (body.content !== "answers") result.push({ questionId: question.id, kind: "question" });
    if (body.content !== "questions" && question.markschemeImages.length) result.push({ questionId: question.id, kind: "answer" });
    return result;
  });
  try {
    const authorized = await authorizeLocalPreviewAssetRequests(bank, requests);
    return NextResponse.json({
      expiresIn: 600,
      assets: authorized.map((item) => ({
        questionId: item.questionId,
        kind: item.kind,
        urls: item.kind === "question" ? item.question.questionImages : item.question.markschemeImages,
      })),
    }, PRIVATE_RESPONSE_INIT);
  } catch {
    return NextResponse.json({ error: "Invalid PDF export request" }, { status: 400 });
  }
}
