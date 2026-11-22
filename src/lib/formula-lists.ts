import { A_LEVEL_MATHS_9709, MF19_URL } from "@/lib/a-level-9709";
import { A_LEVEL_PHYSICS_9702 } from "@/lib/a-level-9702";
import { A_LEVEL_CHEMISTRY_9701 } from "@/lib/a-level-9701";
import { A_LEVEL_FURTHER_MATHS_9231 } from "@/lib/a-level-9231";

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
 * 9701 prints Important values, constants and standards and its own Periodic Table on the question paper (2022+),
 * and 2020-2021 papers came with the Data Booklet; crops leave them out. The A Level table gives relative atomic
 * masses to one decimal place (Li 6.9, B 10.8), unlike the IGCSE table behind the Periodic Table button, so this
 * links the syllabus's own Data section instead. 2022+: Cambridge's 2025-2027 syllabus from p. 80 (contents; the
 * Periodic Table is p. 91). 2020-2021: the 2019-2021 syllabus's Data Booklet from p. 78, which Cambridge no longer
 * hosts; the bestexamhelp copy is the one the source workspace pinned (SHA f87b7609...).
 */
const CHEMISTRY_9701_CURRENT: FormulaList = { code: "9701-data-2022", label: "Data section", url: "https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf#page=80" };
const CHEMISTRY_9701_EARLIER: FormulaList = { code: "9701-data-2019", label: "Data Booklet (2020–21)", url: "https://bestexamhelp.com/exam/cambridge-international-a-level/chemistry-9701/others/9701_y21_sy.pdf#page=78" };
const ERA_SHEETS: Readonly<Record<string, { current: FormulaList; earlier: FormulaList; mixedCurrentLabel: string }>> = {
  [A_LEVEL_PHYSICS_9702]: { current: PHYSICS_9702_CURRENT, earlier: PHYSICS_9702_EARLIER, mixedCurrentLabel: "Data and formulae (2022+)" },
  [A_LEVEL_CHEMISTRY_9701]: { current: CHEMISTRY_9701_CURRENT, earlier: CHEMISTRY_9701_EARLIER, mixedCurrentLabel: "Data section (2022+)" },
};

/**
 * The sheets for the questions on screen: one per syllabus era present. A bank-wide control passes the years of
 * the current results, so a 2020-21-only filter gets the 2019-21 sheet and mixed results get both, labelled by
 * years. With no years (nothing listed yet) it falls back to the current sheet.
 */
export function formulaListsForYears(bank: string | null | undefined, years: readonly number[]): FormulaList[] {
  const sheets = bank ? ERA_SHEETS[bank] : undefined;
  if (!sheets) {
    const single = formulaListFor(bank);
    return single ? [single] : [];
  }
  const earlier = years.some((year) => year <= 2021);
  const current = years.some((year) => year >= 2022);
  if (earlier && current) return [{ ...sheets.current, label: sheets.mixedCurrentLabel }, sheets.earlier];
  return [earlier ? sheets.earlier : sheets.current];
}

/** The sheet for a bank, and for one question's year when the sheet changed between eras. */
export function formulaListFor(bank: string | null | undefined, year?: number): FormulaList | undefined {
  // 9231 uses the same booklet: MF19 is the combined list for 9709 and 9231 (9231 syllabus 2026-2027, section 4).
  if (bank === A_LEVEL_MATHS_9709 || bank === A_LEVEL_FURTHER_MATHS_9231) return { code: "MF19", label: "Formula list (MF19)", url: MF19_URL };
  const sheets = bank ? ERA_SHEETS[bank] : undefined;
  if (sheets) return year !== undefined && year <= 2021 ? sheets.earlier : sheets.current;
  return undefined;
}
