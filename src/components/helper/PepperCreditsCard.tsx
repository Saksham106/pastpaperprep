"use client";

import { useState, useSyncExternalStore } from "react";
import { HELPER_NAME } from "@/lib/helper/config";
import { formatCredits, HELPER_CREDIT_COST, HELPER_PACKS, HELPER_TIER_LABELS, percentLeft, resetDay, type HelperCredits, type HelperPackId } from "@/lib/helper/credits";
import { formatPrice } from "@/lib/pricing-model";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./helper.module.css";

export type PepperCreditsCardProps = {
  credits: (HelperCredits & { packs: { credits: number; expiresAt: string }[] }) | null;
  /** Back from a pack Checkout; the webhook may not have credited it yet. */
  returned?: boolean;
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const noop = () => () => {};
/** False while server-rendering and hydrating, true after: the reset day is shown in UTC first, then in local time. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** /account: this week's Pepper credits, pack credits, and one-time packs to buy. */
export function PepperCreditsCard({ credits, returned = false }: PepperCreditsCardProps) {
  const [buying, setBuying] = useState<HelperPackId | null>(null);
  const [error, setError] = useState("");
  const hydrated = useHydrated();

  const buy = async (pack: HelperPackId) => {
    if (buying) return;
    setBuying(pack);
    setError("");
    trackProductEvent("helper_pack_checkout", { pack });
    try {
      const response = await fetch("/api/helper/credits/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pack }) });
      const body = await response.json().catch(() => null) as { url?: unknown; error?: unknown } | null;
      if (response.ok && typeof body?.url === "string" && body.url.startsWith("https://")) {
        window.location.assign(body.url);
        return;
      }
      setError(typeof body?.error === "string" ? body.error : "Checkout couldn't start. Try again.");
    } catch {
      setError("Checkout couldn't start. Check your connection and try again.");
    }
    setBuying(null);
  };

  const share = credits && credits.weekly > 0 ? Math.min(credits.planLeft / credits.weekly, 1) : 0;
  const nextExpiry = credits?.packs[0]?.expiresAt;

  return (
    <div className={`account-plan-overview ${styles.creditsCard}`}>
      <div>
        <strong>{HELPER_NAME} credits</strong>
        {credits ? (
          <>
            <span className={styles.creditsWeek}>
              <span><b className={styles.creditsPercent}>{percentLeft(credits)} left this week</b> · {formatCredits(credits.planLeft)} of {formatCredits(credits.weekly)} credits · resets {resetDay(credits.resetsAt, undefined, hydrated ? undefined : "UTC")}</span>
              <span className={styles.creditsBar} aria-hidden="true"><span style={{ width: `${Math.round(share * 100)}%` }} /></span>
            </span>
            {credits.packLeft > 0 && <span>+ {formatCredits(credits.packLeft)} pack credits{nextExpiry ? ` · first expire ${dateFormat.format(new Date(nextExpiry))}` : ""}</span>}
            <span className={styles.creditsNote}>{HELPER_TIER_LABELS[credits.tier]} · {HELPER_CREDIT_COST.message} credits a message, {HELPER_CREDIT_COST.photo} with a photo. Packs last 12 months and are used after your weekly credits.</span>
          </>
        ) : <span>Your credits couldn&apos;t load. Refresh to try again.</span>}
        {returned && <span role="status">Your pack is being added. Refresh in a moment if it isn&apos;t here yet.</span>}
        {error && <span className={styles.creditsError} role="alert">{error}</span>}
      </div>
      <div className="account-plan-actions">
        {HELPER_PACKS.map((pack) => (
          <button key={pack.id} type="button" className="button secondary" disabled={buying !== null} onClick={() => void buy(pack.id)}>
            {buying === pack.id ? "Opening checkout…" : `${formatCredits(pack.credits)} credits · ${formatPrice(pack.amountCents)}`}
          </button>
        ))}
      </div>
    </div>
  );
}
