import { HELPER_MAX_IMAGE_CHARS, HELPER_MAX_RAW_TURN_TEXT, HELPER_MAX_TEXT, HELPER_MAX_TURNS, HELPER_MODES, historyText, type HelperMode } from "@/lib/helper/config";

export type HelperTurn = { role: "user" | "assistant"; text: string };
export type HelperImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
export type HelperRequest = {
  bank: string;
  questionId: string;
  mode: HelperMode;
  /** Earlier turns then the new student message, oldest first; the last one is always the student's. */
  messages: HelperTurn[];
  image?: HelperImage;
};

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Validates the browser's request body. Returns null for anything malformed; the route answers 400. */
export function parseHelperRequest(body: unknown): HelperRequest | null {
  if (!isRecord(body)) return null;
  const { bank, questionId, mode, messages, image } = body;
  if (typeof bank !== "string" || !ID.test(bank)) return null;
  if (typeof questionId !== "string" || !ID.test(questionId)) return null;
  if (typeof mode !== "string" || !(HELPER_MODES as readonly string[]).includes(mode)) return null;
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
  let parsedImage: HelperImage | undefined;
  if (image !== undefined && image !== null) {
    if (typeof image !== "string" || image.length > HELPER_MAX_IMAGE_CHARS) return null;
    const match = DATA_URL.exec(image);
    if (!match) return null;
    parsedImage = { mediaType: match[1] as HelperImage["mediaType"], data: match[2] };
  }
  // Marking needs something to mark: a photo or typed working.
  if (mode === "mark" && !parsedImage && !turns[turns.length - 1].text) return null;
  if (!parsedImage && !turns[turns.length - 1].text) return null;
  return { bank, questionId, mode: mode as HelperMode, messages: turns, ...(parsedImage ? { image: parsedImage } : {}) };
}
