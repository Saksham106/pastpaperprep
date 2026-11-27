"use client";

import { useEffect, useSyncExternalStore } from "react";

const pad = (value: number) => String(value).padStart(2, "0");

// A one-second clock: whole seconds keep the snapshot stable between ticks.
function subscribe(onTick: () => void) {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}
const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Days / hours / minutes / seconds to `endsAt`. Placeholders until mounted, so nothing shifts. */
export function SaleCountdown({ endsAt }: { endsAt: number }) {
  const seconds = useSyncExternalStore(subscribe, nowSeconds, () => null);
  const left = seconds === null ? null : Math.max(0, endsAt - seconds * 1000);
  const parts = left === null ? null : {
    d: Math.floor(left / 86_400_000),
    h: Math.floor(left / 3_600_000) % 24,
    m: Math.floor(left / 60_000) % 60,
    s: Math.floor(left / 1000) % 60,
  };
  // At zero the sale is over: drop the <html> flag so the banner (CSS) and sale prices (useAnnualSaleLive) go.
  useEffect(() => {
    if (left === 0) document.documentElement.removeAttribute("data-annual-sale");
  }, [left]);
  const units = [["d", "days"], ["h", "hrs"], ["m", "min"], ["s", "sec"]] as const;
  return <span className="sale-countdown" role="timer" aria-label={parts ? `Ends in ${parts.d} days ${parts.h} hours ${parts.m} minutes` : "Sale countdown"}>
    {units.map(([key, label]) => <span className="sale-countdown-unit" key={key} aria-hidden="true">
      <strong>{parts ? pad(parts[key]) : "--"}</strong><small>{label}</small>
    </span>)}
  </span>;
}
