import available from "@/data/explanations/available.json";

export type { Explanation, ExplanationPart, ExplanationStep } from "@/lib/explanation-format";

/**
 * Worked explanations: one JSON object per question in R2 under `explanations/<bank>/<id>.json`,
 * gated exactly like the mark scheme. Only question IDs live in Git (available.json); the text is
 * premium and never committed. See docs/explanations.md.
 */
const EXPLANATION_PATH = /^explanations\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.json$/;
const availableByBank = new Map(
  Object.entries(available as Record<string, string[]>).map(([bank, ids]) => [
    bank,
    new Set(ids.filter((id) => EXPLANATION_PATH.test(`explanations/${bank}/${id}.json`) && id !== "." && id !== "..")),
  ]),
);

export function hasExplanation(bank: string, questionId: string): boolean {
  return availableByBank.get(bank)?.has(questionId) ?? false;
}

/** Public coverage copy must follow published availability, not a subject-name guess. */
export function hasPublishedExplanations(bank: string): boolean {
  return (availableByBank.get(bank)?.size ?? 0) > 0;
}

export function explanationObjectPath(bank: string, questionId: string): string {
  const path = `explanations/${bank}/${questionId}.json`;
  if (!EXPLANATION_PATH.test(path)) throw new Error("Explanation path is invalid");
  return path;
}

export function isExplanationObjectPath(path: string): boolean {
  return EXPLANATION_PATH.test(path) && !path.split("/").some((segment) => segment === "." || segment === "..");
}
