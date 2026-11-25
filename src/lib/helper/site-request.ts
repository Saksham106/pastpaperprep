import { HELPER_MAX_RAW_TURN_TEXT, HELPER_MAX_TEXT, HELPER_MAX_TURNS, historyText } from "@/lib/helper/config";
import type { HelperTurn } from "@/lib/helper/request";

export type SiteHelperRequest = {
  /** Earlier turns then the new student message, oldest first; the last one is always the student's. */
  messages: HelperTurn[];
  /** Where the student is (path and query), so "this bank" and "these questions" make sense. */
  page: string;
};

const PAGE = /^\/[A-Za-z0-9\-._~%/?&=+]{0,599}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Validates the browser's request body. Returns null for anything malformed; the route answers 400. */
export function parseSiteHelperRequest(body: unknown): SiteHelperRequest | null {
  if (!isRecord(body)) return null;
  const { messages, page } = body;
  if (typeof page !== "string" || !PAGE.test(page)) return null;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > HELPER_MAX_TURNS + 1) return null;
  const turns: HelperTurn[] = [];
  const last = messages.length - 1;
  for (const [index, message] of messages.entries()) {
    if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant")) return null;
    if (typeof message.text !== "string" || message.text.length > HELPER_MAX_RAW_TURN_TEXT) return null;
    const text = message.text.trim();
    if (index === last) {
      // The new message is the student's own text, capped like the input box.
      if (!text || text.length > HELPER_MAX_TEXT) return null;
      turns.push({ role: message.role, text });
      continue;
    }
    // Earlier turns are history: shortened rather than rejected, as in the question helper.
    if (!text) continue;
    turns.push({ role: message.role, text: historyText(text) });
  }
  if (turns[turns.length - 1].role !== "user") return null;
  // The API needs turns to start with the student; drop a leading greeting-only assistant turn if one slipped in.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return { messages: turns, page };
}
