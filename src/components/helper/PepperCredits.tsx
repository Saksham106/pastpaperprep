"use client";

import Link from "next/link";
import { formatCredits, HELPER_CREDIT_COST, percentLeft, resetDay, type HelperCredits } from "@/lib/helper/credits";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./helper.module.css";

/** Plan and pack credits a student can still spend. */
export const creditsLeft = (credits: HelperCredits): number => credits.planLeft + credits.packLeft;

/** A slim bar for this week's plan credits, then what's left and when the week resets. */
export function CreditsLine({ credits, cost, surface }: { credits: HelperCredits; cost?: number; surface?: string }) {
  const share = credits.weekly > 0 ? Math.min(credits.planLeft / credits.weekly, 1) : 0;
  // Running low (a quarter of the week or less, and no pack to fall back on): a quiet way to top up before it runs out.
  const low = share <= 0.25 && credits.packLeft === 0 && creditsLeft(credits) >= HELPER_CREDIT_COST.message;
  return (
    <p className={styles.credits}>
      <span className={styles.creditsBar} aria-hidden="true"><span style={{ width: `${Math.round(share * 100)}%` }} /></span>
      <span>
        {cost && cost > HELPER_CREDIT_COST.message
          ? `A photo uses ${cost} credits · ${formatCredits(creditsLeft(credits))} left`
          : `${percentLeft(credits)} left · ${formatCredits(credits.planLeft)}${credits.packLeft > 0 ? ` + ${formatCredits(credits.packLeft)} pack` : ""} credits · resets ${resetDay(credits.resetsAt)}`}
        {low && <> · <Link className={styles.creditsMore} href="/account#pepper-credits" onClick={() => trackProductEvent("helper_credits_click", { surface: surface ?? "unknown", action: "low" })}>Get more</Link></>}
      </span>
    </p>
  );
}

/** Shown when a message can't be paid for: when credits come back, and how to get more now. */
export function OutOfCredits({ credits, surface }: { credits: HelperCredits; surface: string }) {
  return (
    <div className={styles.outOfCredits}>
      <p>Your weekly credits come back {resetDay(credits.resetsAt)}.</p>
      <div className={styles.outActions}>
        <Link className="button primary" href="/account#pepper-credits" onClick={() => trackProductEvent("helper_credits_click", { surface, action: "packs" })}>Get more credits</Link>
        {credits.tier === "free" && <Link className="button secondary" href="/pricing" onClick={() => trackProductEvent("helper_credits_click", { surface, action: "upgrade" })}>Upgrade</Link>}
      </div>
    </div>
  );
}
