import { NextResponse } from "next/server";
import { isLocalEconomicsBank } from "@/lib/banks";
import { isLocalEconomicsPreviewEnabled } from "@/lib/local-preview";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";

type RouteContext = { params: Promise<{ bank: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  if (!isLocalEconomicsPreviewEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bank = (await context.params).bank;
  if (!isLocalEconomicsBank(bank)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const index = createPublicBankIndex(bank, await loadBankQuestions(bank));
  return NextResponse.json(index, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
