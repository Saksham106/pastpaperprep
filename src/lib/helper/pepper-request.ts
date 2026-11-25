import {
  HELPER_MAX_IMAGE_CHARS, HELPER_MAX_RAW_TURN_TEXT, HELPER_MAX_TEXT, HELPER_MAX_TURNS, HELPER_MODES, historyText, type HelperMode,
} from "@/lib/helper/config";
import type { HelperImage, HelperTurn } from "@/lib/helper/request";

/** One message to Pepper, from any surface. A question is attached when Pepper was opened from that question. */
export type PepperRequest = {
  /** Earlier turns then the new student message, oldest first; the last one is always the student's. */
  messages: HelperTurn[];
  /** The path plus chosen study filters (helperPageContext), so "this bank" makes sense. */
  page: string;
  question?: { bank: string; questionId: string };
  mode: HelperMode;
  image?: HelperImage;
};

const PAGE = /^\/[A-Za-z0-9\-._~%/?&=+]{0,599}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Validates the browser's request body. Returns null for anything malformed; the route answers 400. */
export function parsePepperRequest(body: unknown): PepperRequest | null {
  if (!isRecord(body)) return null;
  const { messages, page, question, mode = "chat", image } = body;
  if (typeof page !== "string" || !PAGE.test(page)) return null;
  if (typeof mode !== "string" || !(HELPER_MODES as readonly string[]).includes(mode)) return null;

  let attached: PepperRequest["question"];
  if (question !== undefined && question !== null) {
    if (!isRecord(question) || typeof question.bank !== "string" || !ID.test(question.bank) || typeof question.questionId !== "string" || !ID.test(question.questionId)) return null;
    attached = { bank: question.bank, questionId: question.questionId };
  }
  // Hints, explanations and marking are about one question: they need it attached.
  if (mode !== "chat" && !attached) return null;

  if (!Array.isArray(messages) || messages.length < 1 || messages.length > HELPER_MAX_TURNS + 1) return null;
  const turns: HelperTurn[] = [];
  const last = messages.length - 1;
  for (const [index, message] of messages.entries()) {
    if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant")) return null;
    if (typeof message.text !== "string" || message.text.length > HELPER_MAX_RAW_TURN_TEXT) return null;
    const text = message.text.trim();
    if (index === last) {
      // The new message is the student's own text, capped like the input box.
      if (text.length > HELPER_MAX_TEXT) return null;
      turns.push({ role: message.role, text });
      continue;
    }
    // Earlier turns are history: shortened rather than rejected, so a long reply never breaks the thread.
    if (!text) continue;
    turns.push({ role: message.role, text: historyText(text) });
  }
  if (turns[turns.length - 1].role !== "user") return null;
  while (turns.length && turns[0].role !== "user") turns.shift();

  let parsedImage: HelperImage | undefined;
  if (image !== undefined && image !== null) {
    // A photo is marked against a mark scheme, so it needs a question attached.
    if (!attached || typeof image !== "string" || image.length > HELPER_MAX_IMAGE_CHARS) return null;
    const match = DATA_URL.exec(image);
    if (!match) return null;
    parsedImage = { mediaType: match[1] as HelperImage["mediaType"], data: match[2] };
  }
  const latest = turns[turns.length - 1].text;
  if (!parsedImage && !latest) return null;
  if (mode === "mark" && !parsedImage && !latest) return null;
  return { messages: turns, page, mode: mode as HelperMode, ...(attached ? { question: attached } : {}), ...(parsedImage ? { image: parsedImage } : {}) };
}
