/** Banks whose papers print Cambridge's Periodic Table, so students get it as a reference. */
const PERIODIC_TABLE_BANKS = new Set(["igcse-chemistry-0620", "igcse-coordinated-sciences-0654"]);

export function hasPeriodicTable(bank: string | null | undefined): boolean {
  return Boolean(bank && PERIODIC_TABLE_BANKS.has(bank));
}

export type PeriodicElement = { number: number; symbol: string; name: string; mass: string | null };
/** Grid position in Cambridge's layout: 18 columns, periods 1-7, then the lanthanoid (9) and actinoid (10) rows. */
export type GridCell = { row: number; column: number };

/**
 * Where Cambridge prints each element. Hydrogen sits above iron (column 8), not above lithium, and
 * the lanthanoids (57-71) and actinoids (89-103) have their own rows below the main table.
 */
export function gridCell(number: number): GridCell {
  if (!Number.isInteger(number) || number < 1 || number > 118) throw new Error(`No element ${number}`);
  if (number === 1) return { row: 1, column: 8 };
  if (number === 2) return { row: 1, column: 18 };
  if (number >= 57 && number <= 71) return { row: 9, column: number - 54 };
  if (number >= 89 && number <= 103) return { row: 10, column: number - 86 };
  const periods: Array<[first: number, row: number]> = [[3, 2], [11, 3], [19, 4], [37, 5], [55, 6], [87, 7]];
  const [first, row] = periods.filter(([start]) => number >= start).at(-1)!;
  const offset = number - first;
  if (row <= 3) return { row, column: offset < 2 ? offset + 1 : offset + 11 };
  if (row <= 5) return { row, column: offset + 1 };
  // Periods 6 and 7 skip the f-block, which sits in its own row.
  return { row, column: offset < 2 ? offset + 1 : offset - 14 + 1 };
}

/** The group labels Cambridge prints above columns 1, 2 and 13-18. */
export const GROUP_LABELS: Array<{ column: number; label: string }> = [
  { column: 1, label: "I" }, { column: 2, label: "II" }, { column: 13, label: "III" }, { column: 14, label: "IV" },
  { column: 15, label: "V" }, { column: 16, label: "VI" }, { column: 17, label: "VII" }, { column: 18, label: "VIII" },
];
