// Client-safe: the explanation JSON format and its runtime shape check. No availability data here.
export type ExplanationStep = { text: string; math?: string; marks: string[] };
export type ExplanationPart = {
  label: string;
  marks: number;
  approach: string;
  steps: ExplanationStep[];
  answer: string;
  mistake?: string;
};
export type Explanation = {
  schemaVersion: 1;
  bank: string;
  questionId: string;
  totalMarks: number;
  parts: ExplanationPart[];
};

const MARK_CODE = /^(\(?(M|A|R|B|N|SC|AG|E|C|P|S|G)\d*\)?( ?\(?dep\)?)?|✓)$/;
const LABEL = /^([a-z](\([ivx]+\))?)?$/;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const onlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const marks = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Accept only complete, internally consistent published JSON for this question, not review drafts. */
export function parseExplanation(value: unknown, bank: string, questionId: string): Explanation | null {
  if (!record(value) || !onlyKeys(value, ["schemaVersion", "bank", "questionId", "totalMarks", "parts"])) return null;
  if (value.schemaVersion !== 1 || value.bank !== bank || value.questionId !== questionId
    || !marks(value.totalMarks) || !Array.isArray(value.parts) || value.parts.length === 0) return null;
  const labels = new Set<string>();
  let total = 0;
  for (const part of value.parts) {
    if (!record(part) || !onlyKeys(part, ["label", "marks", "approach", "steps", "answer", "mistake"])
      || typeof part.label !== "string" || !LABEL.test(part.label) || labels.has(part.label)
      || !marks(part.marks) || !text(part.approach) || !text(part.answer)
      || (part.mistake !== undefined && !text(part.mistake))
      || !Array.isArray(part.steps) || part.steps.length < 1 || part.steps.length > 10) return null;
    labels.add(part.label);
    total += part.marks;
    for (const step of part.steps) {
      if (!record(step) || !onlyKeys(step, ["text", "math", "marks"]) || !text(step.text)
        || (step.math !== undefined && !text(step.math))
        || !Array.isArray(step.marks) || !step.marks.every((code) => typeof code === "string" && MARK_CODE.test(code))) return null;
    }
  }
  return total === value.totalMarks ? value as Explanation : null;
}
