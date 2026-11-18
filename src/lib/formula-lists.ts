import { A_LEVEL_MATHS_9709, MF19_URL } from "@/lib/a-level-9709";

/** Exam formula lists that sit outside the question paper. Pure and client-safe. */
const FORMULA_LISTS: Readonly<Record<string, { code: string; label: string; url: string }>> = {
  [A_LEVEL_MATHS_9709]: { code: "MF19", label: "Formula list (MF19)", url: MF19_URL },
};

export function formulaListFor(bank: string | null | undefined) {
  return bank ? FORMULA_LISTS[bank] : undefined;
}
