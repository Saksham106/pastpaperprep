import { QUALIFICATION_IDS, QUALIFICATIONS, type QualificationId } from "@/lib/qualifications";

/** One board's banks in the "Choose your banks" picker: one tab each, IGCSE · A Level · IB. */
export type BankBoard<T> = { board: QualificationId; label: string; shortLabel: string; banks: readonly T[] };

/**
 * The picker's board tabs in display order (IGCSE · A Level · IB). Banks keep the order they arrive in, which is the
 * catalog's display order (`getCatalogBanksForDisplay` already applies each board's subject order). Empty boards drop out.
 */
export function bankBoards<T>(banks: readonly T[], boardOf: (bank: T) => QualificationId): BankBoard<T>[] {
  return QUALIFICATION_IDS
    .map((board) => ({ board, label: QUALIFICATIONS[board].label, shortLabel: QUALIFICATIONS[board].shortLabel, banks: banks.filter((bank) => boardOf(bank) === board) }))
    .filter((group) => group.banks.length > 0);
}

/** "IB Chemistry HL", "IGCSE Physics 0625", "A Level Mathematics 9709": the board is named once, for chips that mix boards. */
export function boardQualifiedName(name: string, board: QualificationId): string {
  const prefix = QUALIFICATIONS[board].shortLabel;
  return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name : `${prefix} ${name}`;
}

const normalise = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[-\u2010\u2013]/g, "");

/** Words students type that the bank titles don't contain. */
function aliasesFor(text: string): string[] {
  const aliases: string[] = [];
  if (/mathematics|\bmath\b/i.test(text)) aliases.push("maths", "math");
  if (/additional/i.test(text)) aliases.push("addmaths", "add");
  if (/computer science/i.test(text)) aliases.push("cs", "compsci", "computing");
  if (/co-?ordinated/i.test(text)) aliases.push("combined", "coord");
  return aliases;
}

/**
 * Whether a bank matches a search like "chem", "0620", "ib phys hl", "a-level maths" or "add maths": every typed word
 * must start a word of the bank's board, name, subject or slug.
 */
export function bankMatchesQuery(query: string, bank: { slug: string; name: string; board: QualificationId; subject?: string }): boolean {
  const tokens = normalise(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const info = QUALIFICATIONS[bank.board];
  const text = [info.label, info.shortLabel, info.shortLabel.replace(/\s+/g, ""), bank.name, bank.subject ?? "", bank.slug.replaceAll("-", " ")].join(" ");
  const words = normalise(`${text} ${aliasesFor(text).join(" ")}`).split(/[\s/(),.]+/).filter(Boolean);
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}
