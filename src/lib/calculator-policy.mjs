// Calculator status is set per paper by each exam board, so this rule is the single source of truth
// for the bank index, the bank-page filter, the paper builder and printed PDFs.
//
// The raw 0606 data marks pre-2025 Paper 1 as non-calculator. Those papers allowed calculators
// (29 of their questions say "do not use a calculator in this question"); only 2025+ Paper 1 is
// non-calculator. The raw file is pinned by audit tests, so the correction is applied here.
//
// A Level Maths 9709: every paper allows a scientific calculator. Syllabus section 4, "Calculators", identical in
// the 2020-2022, 2023-2025 and 2026-2027 syllabuses: candidates are expected to have a calculator with standard
// 'scientific' functions in all the examinations; graphical and symbolic-algebra calculators are not permitted.
//
// A Level Physics 9702: every paper in scope allows a calculator. All 147 question papers (Papers 1, 2 and 4,
// 2020 to May/June 2026) print "You may use a calculator" on the cover, and the syllabus's mathematical
// requirements expect candidates to use one (2025-2027 syllabus, section 6 "Mathematical requirements", p. 53).
//
// A Level Chemistry 9701: every paper in scope allows a calculator. All 147 question papers (Papers 1, 2 and 4,
// 2020 to May/June 2026) print "You may use a calculator" on the cover (five with a font-shifted text layer, read
// decoded), and the syllabus lists the calculator functions candidates need (2025-2027 syllabus, "Calculators").
//
// A Level Biology 9700: every paper in scope allows a calculator. All 147 question papers (Papers 1, 2 and 4,
// 2020 to May/June 2026) print "You may use a calculator" on the cover (text layer, checked 2026-11-19).

/** Banks whose questions carry a calculator status. */
export const CALCULATOR_POLICY_BANKS = Object.freeze(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl", "a-level-maths-9709", "a-level-physics-9702", "a-level-chemistry-9701", "a-level-biology-9700"]);
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
    case "a-level-maths-9709": return true;
    case "a-level-physics-9702": return true;
    case "a-level-chemistry-9701": return true;
    case "a-level-biology-9700": return true;
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
