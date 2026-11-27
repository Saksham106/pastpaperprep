"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "@phosphor-icons/react";
import type { BankSlug } from "@/lib/banks";
import { ANNUAL_SALE, annualSaleTierForBankCount, formatSaleCents, type AnnualSaleTier } from "@/lib/annual-sale";
import type { BillingInterval } from "@/lib/pricing-model";
import { planUpgradeNudge } from "@/lib/plan-upgrade-nudge";
import { trackProductEvent } from "@/lib/product-analytics";
import { useAnnualSaleLive } from "@/components/useAnnualSaleLive";

const LADDER: readonly AnnualSaleTier[] = ["builderSmall", "builderLarge", "all"];

/** Sale only: where the selection sits on the 2–3 / 4–5 / All Access discount ladder. */
function SaleLadder({ count }: { count: number }) {
  const current = LADDER.indexOf(annualSaleTierForBankCount(count));
  return <ol className="plan-sale-ladder" aria-label="Bigger plan, bigger discount">
    {LADDER.map((tier, index) => <li key={tier} data-state={index < current ? "passed" : index === current ? "current" : "next"}>
      <strong>{ANNUAL_SALE.tiers[tier].percentOff}% off</strong><span>{ANNUAL_SALE.tiers[tier].label}</span>
    </li>)}
  </ol>;
}

/**
 * Above the checkout button: what one more bank costs per month, and what it unlocks.
 * The builder opens its own bank list; One Bank links to the builder with its bank kept.
 */
export function PlanUpgradeNudge({ interval, mode, selectedBankIds }: { interval: BillingInterval; mode: "single" | "builder"; selectedBankIds: readonly BankSlug[] }) {
  const saleLive = useAnnualSaleLive();
  const count = selectedBankIds.length;
  const nudge = planUpgradeNudge(interval, count, saleLive);
  if (!nudge || (mode === "single" && count !== 1)) return null;

  const track = () => trackProductEvent("upgrade_nudge_click", { interval, from: count, to: nudge.nextCount, annualSale: saleLive });
  const reward = nudge.toAllAccess
    ? "Get All Access: every bank, including new ones"
    : nudge.unlocksPercentOff !== null ? `Unlock ${nudge.unlocksPercentOff}% off your whole plan` : null;
  const openPicker = (button: HTMLButtonElement) => {
    track();
    const picker = button.closest(".custom-bundle-checkout")?.querySelector<HTMLDetailsElement>("details");
    if (!picker) return;
    picker.open = true;
    picker.scrollIntoView({ block: "nearest", behavior: "smooth" });
    picker.querySelector<HTMLInputElement>("input:not(:checked):not(:disabled)")?.focus({ preventScroll: true });
  };
  const builderHref = (() => {
    const params = new URLSearchParams({ banks: selectedBankIds[0] ?? "" });
    if (interval === "annual") params.set("interval", "annual");
    return `/pricing?${params}#plan-builder`;
  })();

  const body = <>
    <span className="plan-upgrade-nudge-icon" aria-hidden="true"><Plus weight="bold" /></span>
    <span className="plan-upgrade-nudge-text">
      <span>{mode === "single" ? "Add a second bank" : "Add 1 more bank"} for just <strong>{formatSaleCents(nudge.extraPerMonthCents)}/mo</strong> more</span>
      {reward ? <span className="plan-upgrade-nudge-reward">{reward}</span> : null}
    </span>
    <span className="plan-upgrade-nudge-arrow" aria-hidden="true"><ArrowRight weight="bold" /></span>
  </>;

  return <div className="plan-upgrade-nudge" data-reward={reward ? "true" : undefined}>
    {saleLive && interval === "annual" && mode === "builder" ? <SaleLadder count={count} /> : null}
    {/* The whole callout is the control: builder opens its bank list, One Bank goes to the builder. */}
    {mode === "single"
      ? <Link prefetch={false} scroll={false} className="plan-upgrade-nudge-row" href={builderHref} onClick={track}>{body}</Link>
      : <button type="button" className="plan-upgrade-nudge-row" aria-live="polite" onClick={(event) => openPicker(event.currentTarget)}>{body}</button>}
  </div>;
}
