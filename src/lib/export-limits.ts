export const MAX_PDF_QUESTIONS = 50;
export const MAX_DAILY_PDF_EXPORTS = 3;
export const MAX_DAILY_PDF_QUESTIONS = 150;
export const MAX_DAILY_SIGNED_ASSETS = 3000;
/** At or above this many questions, the student confirms before a PDF is built. */
export const LARGE_PDF_QUESTIONS = 30;

export function validPdfQuestionCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_PDF_QUESTIONS;
}
