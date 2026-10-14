// Browser-safe: the shape of a verified multiple-choice answer and how it is shown.
// The letters themselves only ever arrive through an authorized answer asset (see
// src/lib/mcq-answer-letters.ts); never put them on a question row or the bank index.

export const MCQ_ANSWER_LETTERS = ["A", "B", "C", "D"] as const;
export type McqLetter = (typeof MCQ_ANSWER_LETTERS)[number];
/** One letter normally; several when the board accepted more than one. `note` records official exceptions. */
export type McqAnswer = { answers: McqLetter[]; note: string | null };

export const MCQ_NOTE_MAX_LENGTH = 200;

function isMcqLetter(value: unknown): value is McqLetter {
  return typeof value === "string" && (MCQ_ANSWER_LETTERS as readonly string[]).includes(value);
}

/** Exactly `{ answers, note }`: 1–4 unique letters A–D, and a short trimmed note or null. */
export function isMcqAnswer(value: unknown): value is McqAnswer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answer = value as Record<string, unknown>;
  if (Object.keys(answer).some((key) => key !== "answers" && key !== "note")) return false;
  const { answers, note } = answer;
  return Array.isArray(answers) &&
    answers.length >= 1 && answers.length <= MCQ_ANSWER_LETTERS.length &&
    answers.every(isMcqLetter) &&
    new Set(answers).size === answers.length &&
    (note === null || (typeof note === "string" && note.length > 0 && note === note.trim() && note.length <= MCQ_NOTE_MAX_LENGTH));
}

/** "B", "A or B", "A, B or C". */
export function formatMcqAnswer(answers: readonly McqLetter[]): string {
  if (answers.length <= 1) return answers[0] ?? "";
  return `${answers.slice(0, -1).join(", ")} or ${answers[answers.length - 1]}`;
}
