import { A_LEVEL_MATHS_9709, MF19_URL } from "@/lib/a-level-9709";
import { A_LEVEL_PHYSICS_9702 } from "@/lib/a-level-9702";

/** Exam reference sheets that sit outside the question (formula lists, data and formulae). Pure and client-safe. */
type FormulaList = { code: string; label: string; url: string };

/**
 * 9702 prints its data and formulae on the question paper; crops leave them out, so this links the syllabus's own
 * Data and formulae pages, per syllabus era. 2022+: Cambridge's 2025-2027 syllabus pp. 58-59 (unchanged from
 * 2022-2024). 2020-2021: the 2019-2021 syllabus pp. 68-69, which Cambridge no longer hosts; the bestexamhelp copy
 * is the one the source workspace pinned (SHA af9e5e5c...).
 */
const PHYSICS_9702_CURRENT: FormulaList = { code: "9702-data-2022", label: "Data and formulae", url: "https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf#page=58" };
const PHYSICS_9702_EARLIER: FormulaList = { code: "9702-data-2019", label: "Data and formulae (2020–21)", url: "https://bestexamhelp.com/exam/cambridge-international-a-level/physics-9702/others/9702_y21_sy.pdf#page=68" };

/**
 * The sheets for the questions on screen: one per syllabus era present. A bank-wide control passes the years of
 * the current results, so a 2020-21-only filter gets the 2019-21 sheet and mixed results get both, labelled by
 * years. With no years (nothing listed yet) it falls back to the current sheet.
 */
export function formulaListsForYears(bank: string | null | undefined, years: readonly number[]): FormulaList[] {
  if (bank !== A_LEVEL_PHYSICS_9702) {
    const single = formulaListFor(bank);
    return single ? [single] : [];
  }
  const earlier = years.some((year) => year <= 2021);
  const current = years.some((year) => year >= 2022);
  if (earlier && current) return [{ ...PHYSICS_9702_CURRENT, label: "Data and formulae (2022+)" }, PHYSICS_9702_EARLIER];
  return [earlier ? PHYSICS_9702_EARLIER : PHYSICS_9702_CURRENT];
}

/** The sheet for a bank, and for one question's year when the sheet changed between eras. */
export function formulaListFor(bank: string | null | undefined, year?: number): FormulaList | undefined {
  if (bank === A_LEVEL_MATHS_9709) return { code: "MF19", label: "Formula list (MF19)", url: MF19_URL };
  if (bank === A_LEVEL_PHYSICS_9702) return year !== undefined && year <= 2021 ? PHYSICS_9702_EARLIER : PHYSICS_9702_CURRENT;
  return undefined;
}
