import Anthropic from "@anthropic-ai/sdk";
import { after, NextResponse } from "next/server";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getBank, type BankSlug } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { consumeHelperCredits, releaseHelperCredits } from "@/lib/helper/allowance";
import { HELPER_BOARDS, helperBoard } from "@/lib/helper/config";
import { formatCredits, helperCreditCost, HELPER_DAILY_CREDIT_GUARD } from "@/lib/helper/credits";
import { HelperAccessError, loadHelperContext, type HelperContext } from "@/lib/helper/context";
import { captureHelperGenerations, type HelperRoundStats } from "@/lib/helper/llm-analytics";
import { buildPepperMessages } from "@/lib/helper/pepper-prompt";
import { parsePepperRequest } from "@/lib/helper/pepper-request";
import { HELPER_SITE_CUT_OFF, runSiteAgent, type Send } from "@/lib/helper/site-agent";
import { siteShortcut } from "@/lib/helper/site-shortcut";
import { helperTier } from "@/lib/helper/tier";
import { loadSiteData, type SiteData } from "@/lib/helper/site-tools";
import { currentQuestionId } from "@/lib/question-id-aliases";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { createClient } from "@/lib/supabase/server";

// One endpoint for Pepper on every surface: the floating button (no question) and a question's Ask Pepper button (that
// question attached). Same prompt, tools, allowance and stream either way.

export const runtime = "nodejs";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;
/** Owner choice (2026-11-25): Sonnet 5.5 at medium effort is plenty for school-level help and site navigation. */
const DEFAULT_MODEL = "claude-sonnet-5-5";
const BUSY = "The helper is busy right now. Try again in a minute.";
const FAILED = "The helper couldn't answer. Try again.";
const REFUSED = "I can't help with that one. Try asking in a different way.";

/** Out of credits: the panel adds when they come back and how to get more. */
function limitMessage(reason: "week" | "day", left: number, cost: number): string {
  if (reason === "day") return `That's today's limit of ${formatCredits(HELPER_DAILY_CREDIT_GUARD)} credits. Try again tomorrow.`;
  if (left > 0) return `This message needs ${cost} credits and you have ${formatCredits(left)} left.`;
  return "You've used this week's credits.";
}

const jsonError = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

async function handlePOST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return jsonError("The study helper isn't available yet.", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }
  const parsed = parsePepperRequest(body);
  if (!parsed) return jsonError("Invalid helper request", 400);
  let question: { bank: BankSlug; questionId: string } | null = null;
  if (parsed.question) {
    if (!getBank(parsed.question.bank)) return jsonError("Invalid helper request", 400);
    const bank = parsed.question.bank as BankSlug;
    if (!HELPER_BOARDS[helperBoard(bank)]) return jsonError("The study helper isn't available for this subject yet.", 403);
    question = { bank, questionId: currentQuestionId(bank, parsed.question.questionId) };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return jsonError("Sign in required", 401);

  const accessResult = await fetchAccessEntitlements(supabase as never, userId);
  if (accessResult.error) return jsonError("Could not verify access", 503);
  const entitlements = accessResult.rows as AccessEntitlement[];

  let data: SiteData;
  let context: HelperContext | null = null;
  try {
    [data, context] = await Promise.all([
      loadSiteData(),
      question ? loadHelperContext(question.bank, question.questionId, entitlements) : Promise.resolve(null),
    ]);
  } catch (error) {
    if (error instanceof HelperAccessError) return jsonError("Access required", 403);
    console.error(JSON.stringify({ event: "helper_context_failed", bank: question?.bank, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    return jsonError(question ? "The question could not load. Try again." : FAILED, 503);
  }

  // Rules first: an exact paper, topic or subject opens with no model call and costs the student nothing.
  if (!question && !parsed.image) {
    const last = parsed.messages[parsed.messages.length - 1].text;
    const shortcut = siteShortcut(data, last, parsed.page, parsed.messages.length > 1);
    if (shortcut) {
      console.info(JSON.stringify({ event: "helper_usage", surface: "site", rules: true, kind: shortcut.navigation.kind }));
      const lines = [{ type: "navigate", ...shortcut.navigation }, { type: "text", text: shortcut.reply }, { type: "done", rules: true }];
      return new Response(lines.map((line) => JSON.stringify(line)).join("\n") + "\n", { headers: { ...NO_STORE, "Content-Type": "application/x-ndjson; charset=utf-8" } });
    }
  }

  // The plan tier and the cost are the server's: entitlements read above, and whether this message carries a photo.
  const tier = helperTier(entitlements);
  const cost = helperCreditCost(Boolean(parsed.image));
  // One charge per message, however many model calls it takes (src/lib/helper/allowance.ts).
  const allowance = await consumeHelperCredits(userId, tier, cost);
  if (allowance.status !== "ok") {
    if (allowance.status === "disabled") return jsonError("The study helper is paused right now. Try again later.", 503);
    if (allowance.status === "busy") return jsonError("The helper is very busy today. Try again tomorrow.", 503);
    if (allowance.status === "error") return jsonError("Could not check your credits", 503);
    return jsonError(limitMessage(allowance.reason, allowance.credits.planLeft + allowance.credits.packLeft, cost), 429, { reason: allowance.reason, cost, credits: allowance.credits });
  }
  const { charge, credits } = allowance;
  const surface = question ? "question" : "site";

  // Model-call analytics (counts only, never text): collected per round, sent after the response has finished.
  const rounds: HelperRoundStats[] = [];
  const outcome = { refused: false, navigated: false };
  let finishAnalytics: () => void = () => {};
  const analyticsDone = new Promise<void>((resolve) => { finishAnalytics = resolve; });
  try {
    after(analyticsDone.then(() => captureHelperGenerations({
      userId,
      rounds,
      meta: { surface, mode: parsed.mode, photo: Boolean(parsed.image), ...(question ? { bank: question.bank } : {}), ...outcome, creditsCost: cost, tier },
    })));
  } catch {
    finishAnalytics();
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let sentText = false;
      try {
        const result = await runSiteAgent({
          api: anthropic().beta.messages,
          model: process.env.HELPER_MODEL?.trim() || DEFAULT_MODEL,
          data,
          messages: buildPepperMessages(parsed, context),
          send: (event) => { if (event.type === "text") sentText = true; send(event); },
          signal: abort.signal,
          onRound: (stats) => { rounds.push(stats); },
          usage: { surface, mode: parsed.mode, photo: Boolean(parsed.image), ...(question ? { bank: question.bank } : {}) },
          // Practice sets follow the paper builder's rule: only banks the student's plan covers.
          tools: { canBuild: (bank) => hasBankAccess(bank as BankSlug, entitlements) },
        });
        outcome.refused = result.refused;
        outcome.navigated = result.navigated;
        if (!result.sentText && !result.navigated) {
          // Nothing reached the student: give the message back (only ever before the first words).
          await releaseHelperCredits(userId, charge);
          send({ type: "error", message: REFUSED, status: 422 });
        } else {
          send({ type: "done", credits, cost });
        }
      } catch (error) {
        if (abort.signal.aborted) return;
        if (!sentText) await releaseHelperCredits(userId, charge);
        const busy = error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500);
        if (sentText) send({ type: "text", text: HELPER_SITE_CUT_OFF });
        send({ type: "error", message: busy ? BUSY : FAILED, status: busy ? 503 : 502 });
      } finally {
        finishAnalytics();
        try { controller.close(); } catch { /* already closed by a cancel */ }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body$, {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Helper-Credits-Left": String(credits.planLeft + credits.packLeft),
      ...(context ? { "X-Helper-Free-Preview": context.freePreview ? "1" : "0" } : {}),
    },
  });
}

export const POST = withFailureReporting("/api/helper", handlePOST);
