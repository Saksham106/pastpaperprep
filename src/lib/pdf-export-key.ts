import { createHmac } from "node:crypto";

/**
 * Server-only identity of one worksheet: the same bank, content and set of questions map to the
 * same key, so repeating that export on the same day isn't charged twice. It is an HMAC with a
 * server secret, so a client can't compute the key for a worksheet and pre-register a cheap charge
 * for it. Returns null without the secret; callers then charge every export as before.
 */
export function pdfExportKey(
  bank: string,
  content: "questions" | "answers" | "both",
  canonicalQuestionIds: readonly string[],
  secret: string | undefined = process.env.SUPABASE_SECRET_KEY,
): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`ppp-pdf-export-v1:${JSON.stringify([bank, content, [...canonicalQuestionIds].sort()])}`).digest("hex");
}
