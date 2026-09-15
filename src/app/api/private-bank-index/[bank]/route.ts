import { NextResponse } from "next/server";
import { isPrivateBankIndexEnabled } from "@/lib/banks";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";

type RouteContext = { params: Promise<{ bank: string }> };
const PRIVATE_RESPONSE_INIT = { headers: { "Cache-Control": "private, no-store, max-age=0" } } as const;

export const runtime = "nodejs";

/**
 * Metadata-only index for a private release bank.
 *
 * This endpoint deliberately does NOT require a session. `createPublicBankIndex` emits
 * only non-sensitive metadata (id, paper, year, session, topic/subtopic labels, marks,
 * image COUNTS) and never a signed URL, asset path, question text, answer, or solution.
 * Requiring authentication here was the root cause of the empty `?free=1` funnel: the
 * explorer could not load the bank's question list, so the advertised free subset was
 * unreachable. Access control for the actual content stays in /api/assets/sign,
 * /api/pdf/sign, and prepareQuestionsForDelivery.
 */
export async function GET(_request: Request, context: RouteContext) {
  const bank = (await context.params).bank;
  if (!isPrivateBankIndexEnabled(bank)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    return NextResponse.json(
      createPublicBankIndex(bank, await loadBankQuestions(bank)),
      PRIVATE_RESPONSE_INIT,
    );
  } catch {
    return NextResponse.json({ error: "Question index unavailable" }, { status: 503 });
  }
}
