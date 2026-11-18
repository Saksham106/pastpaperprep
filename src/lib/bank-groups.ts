import { QUALIFICATIONS, type QualificationId } from "@/lib/qualifications";

/** A labelled group of banks in the "Choose your banks" picker, tagged with its board. */
export type BankGroup<T> = { label: string; board: QualificationId | null; banks: readonly T[] };

type BankFacts = { board: QualificationId | null; subject: string };

/**
 * The picker's groups, in board order (IGCSE · A Level · IB): Cambridge IGCSE, Cambridge A Level, then IB
 * Mathematics, IB Sciences and IB Computer Science; anything without a known board last. Empty groups drop out.
 */
export function bankGroupsByBoard<T>(banks: readonly T[], facts: (bank: T) => BankFacts): BankGroup<T>[] {
  const of = (test: (fact: BankFacts) => boolean) => banks.filter((bank) => test(facts(bank)));
  const ib = (fact: BankFacts) => fact.board === "ib";
  const groups: BankGroup<T>[] = [
    { label: QUALIFICATIONS.igcse.groupLabel, board: "igcse", banks: of((fact) => fact.board === "igcse") },
    { label: QUALIFICATIONS["a-level"].groupLabel, board: "a-level", banks: of((fact) => fact.board === "a-level") },
    { label: "IB Mathematics", board: "ib", banks: of((fact) => ib(fact) && fact.subject.startsWith("Mathematics")) },
    { label: "IB Sciences", board: "ib", banks: of((fact) => ib(fact) && !fact.subject.startsWith("Mathematics") && !fact.subject.startsWith("Computer Science")) },
    { label: "IB Computer Science", board: "ib", banks: of((fact) => ib(fact) && fact.subject.startsWith("Computer Science")) },
    { label: "Other banks", board: null, banks: of((fact) => fact.board === null) },
  ];
  return groups.filter((group) => group.banks.length > 0);
}

/**
 * The remembered board's groups come first and open; every other board folds beneath them. With no
 * remembered board, or none of its banks on offer, everything stays in the first list as before.
 */
export function splitByBoard<T>(groups: readonly BankGroup<T>[], board: QualificationId | null): { first: BankGroup<T>[]; others: BankGroup<T>[] } {
  const first = board ? groups.filter((group) => group.board === board) : [];
  if (!first.length) return { first: [...groups], others: [] };
  return { first, others: groups.filter((group) => group.board !== board) };
}

