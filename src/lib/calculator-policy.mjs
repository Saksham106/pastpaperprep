// Calculator status is set per paper by each exam board, so this rule is the single source of truth
// for the bank index, the bank-page filter, the paper builder and printed PDFs.
//
// The raw 0606 data marks pre-2025 Paper 1 as non-calculator. Those papers allowed calculators
// (29 of their questions say "do not use a calculator in this question"); only 2025+ Paper 1 is
// non-calculator. The raw file is pinned by audit tests, so the correction is applied here.

/** Banks whose questions carry a calculator status. */
export const CALCULATOR_POLICY_BANKS = Object.freeze(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"]);
/** Banks where both values occur, so a calculator filter is useful. */
export const CALCULATOR_FILTER_BANKS = Object.freeze(["igcse", "igcse-additional", "ib-hl", "ib-sl"]);

/**
 * @param {string} bank
 * @param {{ paper: number, year: number }} question
 * @returns {boolean | null} true when a calculator is allowed, false when it is not, null when the bank has no rule
 */
export function calculatorAllowed(bank, { paper, year }) {
  switch (bank) {
    case "igcse": return year >= 2025 ? paper !== 1 && paper !== 2 : true;
    case "igcse-additional": return year >= 2025 ? paper !== 1 : true;
    case "ib-hl":
    case "ib-sl": return paper !== 1;
    case "ib-ai-hl":
    case "ib-ai-sl": return true;
    default: return null;
  }
}

/**
 * @param {boolean | null | undefined} value
 * @returns {"CALCULATOR" | "NO CALCULATOR" | null}
 */
export function calculatorBadgeText(value) {
  if (value === true) return "CALCULATOR";
  if (value === false) return "NO CALCULATOR";
  return null;
}
