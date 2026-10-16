import { NextResponse } from "next/server";
import { getAvailableBanks, isPrivateBankIndexEnabled } from "@/lib/banks";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";
import { withFailureReporting } from "@/lib/route-failure-reporting";

type RouteContext = { params: Promise<{ bank: string }> };
const CACHEABLE_RESPONSE_INIT = {
  headers: { "Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=86400" },
} as const;

export const runtime = "nodejs";

/**
 * Built once per deploy for every released private bank, so visitors read a static file
 * instead of a function loading the whole bank (several seconds of CPU per cold copy).
 * Any other slug is a plain 404 without running or caching anything, so made-up slugs
 * cannot create cache entries.
 */
export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ bank: string }>> {
  return getAvailableBanks()
    .map((bank) => bank.slug)
    .filter((slug) => isPrivateBankIndexEnabled(slug))
    .map((bank) => ({ bank }));
}

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
async function handleGET(_request: Request, context: RouteContext) {
  const bank = (await context.params).bank;
  if (!isPrivateBankIndexEnabled(bank)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    return NextResponse.json(
      createPublicBankIndex(bank, await loadBankQuestions(bank)),
      CACHEABLE_RESPONSE_INIT,
    );
  } catch {
    return NextResponse.json({ error: "Question index unavailable" }, { status: 503 });
  }
}

export const GET = withFailureReporting("/api/private-bank-index/[bank]", handleGET, { linkAccount: false });
