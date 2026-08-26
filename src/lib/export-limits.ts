export const MAX_PDF_QUESTIONS = 50;
export const MAX_DAILY_PDF_EXPORTS = 3;
export const MAX_DAILY_PDF_QUESTIONS = 75;
export const MAX_DAILY_SIGNED_ASSETS = 1000;

export function validPdfQuestionCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_PDF_QUESTIONS;
}
