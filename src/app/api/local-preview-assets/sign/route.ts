import { NextResponse } from "next/server";
import { authorizeLocalPreviewAssetRequests, type AssetRequest } from "@/lib/asset-access";
import { isLocalEconomicsBank } from "@/lib/banks";
import { isLocalEconomicsPreviewEnabled, localPreviewSourceRoot } from "@/lib/local-preview";
import { getQuestionRichDetails } from "@/lib/question-delivery";

type Body = { bank?: unknown; requests?: unknown };
const PRIVATE_RESPONSE_INIT = { headers: { "Cache-Control": "private, no-store, max-age=0" } } as const;

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isLocalEconomicsPreviewEnabled() || !localPreviewSourceRoot()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body.bank !== "string" || !isLocalEconomicsBank(body.bank) || !Array.isArray(body.requests)) {
    return NextResponse.json({ error: "Invalid local preview asset request" }, { status: 400 });
  }

  try {
    const authorized = await authorizeLocalPreviewAssetRequests(body.bank, body.requests as AssetRequest[]);
    return NextResponse.json({
      expiresIn: 600,
      assets: authorized.map((item) => ({
        questionId: item.questionId,
        kind: item.kind,
        details: getQuestionRichDetails(item.question, [], new Date(), true),
        urls: item.kind === "question" ? item.question.questionImages : item.question.markschemeImages,
      })),
    }, PRIVATE_RESPONSE_INIT);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid local preview asset request";
    return NextResponse.json({ error: message }, { status: /Unknown|invalid|Duplicate|between/.test(message) ? 400 : 403 });
  }
}
