import { createHash } from "node:crypto";

/**
 * Server-derived identity of one worksheet: the same bank, content and set of questions always
 * map to the same key, so repeating that export on the same day isn't charged twice.
 */
export function pdfExportKey(bank: string, content: "questions" | "answers" | "both", canonicalQuestionIds: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify([bank, content, [...canonicalQuestionIds].sort()])).digest("hex");
}
