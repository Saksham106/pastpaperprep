import { HELPER_MAX_TEXT, HELPER_MAX_TURNS } from "@/lib/helper/config";
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
  for (const message of messages) {
    if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant")) return null;
    if (typeof message.text !== "string") return null;
    const limit = message.role === "assistant" ? HELPER_MAX_TEXT * 4 : HELPER_MAX_TEXT;
    const text = message.text.trim();
    if (!text || text.length > limit) return null;
    turns.push({ role: message.role, text });
  }
  if (turns[turns.length - 1].role !== "user") return null;
  // The API needs turns to start with the student; drop a leading greeting-only assistant turn if one slipped in.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return { messages: turns, page };
}
