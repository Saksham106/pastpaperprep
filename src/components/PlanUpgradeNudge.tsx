"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "@phosphor-icons/react";
import type { BankSlug } from "@/lib/banks";
import { formatSaleCents } from "@/lib/annual-sale";
import type { BillingInterval } from "@/lib/pricing-model";
import { planUpgradeNudge, type PlanUpgradeNudge as Nudge } from "@/lib/plan-upgrade-nudge";
import { trackProductEvent } from "@/lib/product-analytics";
import { useAnnualSaleLive } from "@/components/useAnnualSaleLive";

/** "1 bank away from 35% off" / "1 bank away from All Access" — the gap, then the reward. */
function goalHeadline(goal: NonNullable<Nudge["goal"]>) {
  const away = `${goal.banksAway} bank${goal.banksAway === 1 ? "" : "s"} away from`;
  const reward = goal.allAccess
    ? goal.percentOff !== null ? `All Access · ${goal.percentOff}% off` : "All Access"
    : `${goal.percentOff}% off`;
  return <>{away} <strong>{reward}</strong></>;
}

/**
 * One card above the checkout button. With a goal: "N banks away from X" plus a progress bar,
 * then the price of the next bank. Without: just the price of the next bank. The whole card is the
 * control: the builder opens its bank list; One Bank goes to the builder with its bank kept.
 */
export function PlanUpgradeNudge({ interval, mode, selectedBankIds }: { interval: BillingInterval; mode: "single" | "builder"; selectedBankIds: readonly BankSlug[] }) {
  const saleLive = useAnnualSaleLive();
  const count = selectedBankIds.length;
  const nudge = planUpgradeNudge(interval, count, saleLive);
  if (!nudge || (mode === "single" && count !== 1)) return null;

  const track = () => trackProductEvent("upgrade_nudge_click", { interval, from: count, to: nudge.nextCount, annualSale: saleLive });
  const openPicker = (button: HTMLButtonElement) => {
    track();
    const picker = button.closest(".custom-bundle-checkout")?.querySelector<HTMLDetailsElement>("details");
    if (!picker) return;
    picker.open = true;
    picker.scrollIntoView({ block: "nearest", behavior: "smooth" });
    picker.querySelector<HTMLInputElement>("input:not(:checked):not(:disabled)")?.focus({ preventScroll: true });
  };
  const price = <strong>{formatSaleCents(nudge.extraPerMonthCents)}/mo</strong>;
  const addLine = mode === "single" ? <>Add a second bank for just {price} more</> : <>Add a bank for just {price} more</>;
  const body = <>
    {nudge.goal ? <>
      <span className="plan-upgrade-nudge-goal">{goalHeadline(nudge.goal)}</span>
      <span className="plan-upgrade-nudge-track" aria-hidden="true">
        {Array.from({ length: nudge.goal.count }, (_, index) => <i key={index} data-filled={index < count ? "true" : undefined} />)}
      </span>
      <span className="plan-upgrade-nudge-add"><Plus aria-hidden="true" weight="bold" /><span>{addLine}</span><ArrowRight className="plan-upgrade-nudge-arrow" aria-hidden="true" weight="bold" /></span>
    </> : <span className="plan-upgrade-nudge-add plan-upgrade-nudge-add-only"><Plus aria-hidden="true" weight="bold" /><span>{mode === "single" ? addLine : <>Add 1 more bank for just {price} more</>}</span><ArrowRight className="plan-upgrade-nudge-arrow" aria-hidden="true" weight="bold" /></span>}
  </>;

  if (mode === "single") {
    const params = new URLSearchParams({ banks: selectedBankIds[0] });
    if (interval === "annual") params.set("interval", "annual");
    return <Link prefetch={false} scroll={false} className="plan-upgrade-nudge" href={`/pricing?${params}#plan-builder`} onClick={track}>{body}</Link>;
  }
  return <button type="button" className="plan-upgrade-nudge" aria-live="polite" onClick={(event) => openPicker(event.currentTarget)}>{body}</button>;
}
