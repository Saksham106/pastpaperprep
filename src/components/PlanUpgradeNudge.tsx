"use client";

import Link from "next/link";
import type { BankSlug } from "@/lib/banks";
import { formatSaleCents } from "@/lib/annual-sale";
import type { BillingInterval } from "@/lib/pricing-model";
import { planUpgradeNudge } from "@/lib/plan-upgrade-nudge";
import { trackProductEvent } from "@/lib/product-analytics";
import { useAnnualSaleLive } from "@/components/useAnnualSaleLive";

/**
 * One line above the checkout button: what one more bank costs per month. The builder adds it in
 * place (six banks become All Access); One Bank links to the builder with its bank kept.
 */
export function PlanUpgradeNudge({ interval, mode, selectedBankIds }: { interval: BillingInterval; mode: "single" | "builder"; selectedBankIds: readonly BankSlug[] }) {
  const saleLive = useAnnualSaleLive();
  const count = selectedBankIds.length;
  const nudge = planUpgradeNudge(interval, count, saleLive);
  if (!nudge || (mode === "single" && count !== 1)) return null;

  const perMonth = <strong>{formatSaleCents(nudge.extraPerMonthCents)}/mo</strong>;
  const perYear = nudge.extraPerYearCents === null ? null : <span className="plan-upgrade-nudge-year"> ({formatSaleCents(nudge.extraPerYearCents)}/yr)</span>;
  const reward = nudge.toAllAccess
    ? <> and get <strong>All Access</strong>: every bank, including new ones</>
    : nudge.unlocksPercentOff !== null ? <>, and get {nudge.unlocksPercentOff}% off</> : null;
  const copy = <>{mode === "single" ? "Add a second bank" : "Add 1 more bank"} for {perMonth} more{perYear}{reward}</>;

  if (mode === "single") {
    const params = new URLSearchParams({ banks: selectedBankIds[0] });
    if (interval === "annual") params.set("interval", "annual");
    return <p className="plan-upgrade-nudge">
      <Link prefetch={false} scroll={false} href={`/pricing?${params}#plan-builder`} onClick={() => trackProductEvent("upgrade_nudge_click", { interval, from: count, to: nudge.nextCount, annualSale: saleLive })}>{copy} <span aria-hidden="true">→</span></Link>
    </p>;
  }
  return <p className="plan-upgrade-nudge" aria-live="polite">{copy}</p>;
}
