// Browser-safe: reads the score line the helper puts first in a marking reply.

/** Reads "Mark: X / Y" off the start of a marking reply, for analytics. */
export function parseMarkLine(text: string): { score: number; total: number } | null {
  const match = /^\s*\**\s*Mark:\s*(\d{1,3}(?:\.\d)?)\s*\/\s*(\d{1,3})\b/i.exec(text);
  if (!match) return null;
  const score = Number(match[1]);
  const total = Number(match[2]);
  return Number.isFinite(score) && Number.isFinite(total) && total > 0 && score <= total ? { score, total } : null;
}
