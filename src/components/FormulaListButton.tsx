"use client";

import { MathOperations } from "@phosphor-icons/react/dist/ssr";
import { formulaListFor } from "@/lib/formula-lists";
import { trackProductEvent } from "@/lib/product-analytics";
import "./periodic-table.css";

/**
 * Opens the formula list candidates get in the exam (A Level Maths: MF19) in a new tab, like the
 * Periodic Table button on the science banks. It links the board's own PDF (see formula-lists.ts); nothing is copied here.
 */
export function FormulaListButton({ bank, year, variant = "inline", source }: { bank: string | null | undefined; year?: number; variant?: "inline" | "floating"; source: string }) {
  const list = formulaListFor(bank, year);
  if (!list) return null;
  return <a className={`periodic-button is-${variant}`} href={list.url} target="_blank" rel="noopener noreferrer" onClick={() => trackProductEvent("formula_list_open", { source, list: list.code })}>
    <MathOperations aria-hidden="true" weight="bold" /> {list.label}
  </a>;
}
