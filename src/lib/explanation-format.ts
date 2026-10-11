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

/** Shape check for JSON fetched from storage before it reaches the renderer. */
export function parseExplanation(value: unknown, bank: string, questionId: string): Explanation | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Partial<Explanation>;
  if (doc.schemaVersion !== 1 || doc.bank !== bank || doc.questionId !== questionId || !Array.isArray(doc.parts)) return null;
  const strings = (...values: unknown[]) => values.every((item) => typeof item === "string");
  const valid = doc.parts.every((part) => part && strings(part.label, part.approach, part.answer)
    && (part.mistake === undefined || typeof part.mistake === "string")
    && Number.isInteger(part.marks)
    && Array.isArray(part.steps)
    && part.steps.every((step) => step && typeof step.text === "string"
      && (step.math === undefined || typeof step.math === "string")
      && Array.isArray(step.marks) && step.marks.every((code) => typeof code === "string")));
  return valid ? (doc as Explanation) : null;
}
