"use client";

import { MathOperations } from "@phosphor-icons/react/dist/ssr";
import { formulaListFor, formulaListsForYears } from "@/lib/formula-lists";
import { trackProductEvent } from "@/lib/product-analytics";
import "./periodic-table.css";

/**
 * Opens the reference sheet candidates get in the exam (A Level Maths: MF19; A Level Physics: Data and formulae) in a
 * new tab, like the Periodic Table button on the science banks. It links the board's own PDF (see formula-lists.ts);
 * nothing is copied here.
 * - `year`: one question (the paper reader) gets its own era's sheet.
 * - `years`: a bank-wide control gets one link per era in the listed questions; mixed eras show both, labelled.
 */
export function FormulaListButton({ bank, year, years, variant = "inline", source }: { bank: string | null | undefined; year?: number; years?: readonly number[]; variant?: "inline" | "floating"; source: string }) {
  const lists = years ? formulaListsForYears(bank, years) : [formulaListFor(bank, year)].filter((list) => list !== undefined);
  if (!lists.length) return null;
  const links = lists.map((list) => <a key={list.code} className={`periodic-button${lists.length === 1 ? ` is-${variant}` : ""}`} href={list.url} target="_blank" rel="noopener noreferrer" onClick={() => trackProductEvent("formula_list_open", { source, list: list.code })}>
    <MathOperations aria-hidden="true" weight="bold" /> {list.label}
  </a>);
  if (lists.length === 1) return links[0];
  return <div className={`formula-list-links is-${variant}`} role="group" aria-label="Reference sheets by exam year">{links}</div>;
}
