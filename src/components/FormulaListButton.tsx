"use client";

import { MathOperations } from "@phosphor-icons/react/dist/ssr";
import { formulaListFor } from "@/lib/formula-lists";
import { trackProductEvent } from "@/lib/product-analytics";
import "./periodic-table.css";

/**
 * Opens the formula list candidates get in the exam (A Level Maths: MF19) in a new tab, like the
 * Periodic Table button on the science banks. Cambridge hosts the PDF; nothing is copied here.
 */
export function FormulaListButton({ bank, variant = "inline", source }: { bank: string | null | undefined; variant?: "inline" | "floating"; source: string }) {
  const list = formulaListFor(bank);
  if (!list) return null;
  return <a className={`periodic-button is-${variant}`} href={list.url} target="_blank" rel="noopener noreferrer" onClick={() => trackProductEvent("formula_list_open", { source, list: list.code })}>
    <MathOperations aria-hidden="true" weight="bold" /> {list.label}
  </a>;
}
