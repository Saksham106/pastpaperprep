"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CHECKOUT_PENDING_COOKIE,
  CHECKOUT_PENDING_MAX_AGE_SECONDS,
  CHECKOUT_PENDING_POLL_MS,
  serializeCheckoutPending,
  type CheckoutPending,
} from "@/lib/checkout-pending";
import { trackProductEvent } from "@/lib/product-analytics";

/** Drops `?checkout=` (and Stripe's `session_id`) once reported, so reloading the page is not counted as another return. */
export function clearCheckoutParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("checkout")) return;
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* address bar cleanup is cosmetic */ }
}

const REFRESH_EVERY_MS = 3000;

function writePendingCookie(pending: CheckoutPending | null) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = pending
    ? `${CHECKOUT_PENDING_COOKIE}=${serializeCheckoutPending(pending)}; Path=/account; Max-Age=${CHECKOUT_PENDING_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
    : `${CHECKOUT_PENDING_COOKIE}=; Path=/account; Max-Age=0; SameSite=Lax${secure}`;
}

/**
 * Status banner for a buyer Stripe sent back to /account. It reports the
 * return once, remembers it across refreshes, and refreshes the page until the
 * server-read entitlement shows the purchase. `elapsedMs` is measured on the
 * server so the client's clock does not matter.
 */
export function CheckoutReturnStatus({ pending, settled, fromCheckout, elapsedMs }: {
  pending: CheckoutPending;
  settled: boolean;
  fromCheckout: boolean;
  elapsedMs: number;
}) {
  const router = useRouter();
  const reportedRef = useRef(false);
  const [slow, setSlow] = useState(() => !settled && elapsedMs >= CHECKOUT_PENDING_POLL_MS);

  useEffect(() => {
    if (reportedRef.current || !fromCheckout) return;
    reportedRef.current = true;
    trackProductEvent("checkout_returned", { status: pending.status });
    clearCheckoutParam();
  }, [fromCheckout, pending.status]);

  useEffect(() => {
    writePendingCookie(settled ? null : pending);
  }, [pending, settled]);

  useEffect(() => {
    if (settled) return;
    const remaining = CHECKOUT_PENDING_POLL_MS - elapsedMs;
    if (remaining <= 0) return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (Date.now() - started >= remaining) { setSlow(true); return; }
      router.refresh();
      timer = setTimeout(tick, REFRESH_EVERY_MS);
    };
    timer = setTimeout(tick, REFRESH_EVERY_MS);
    return () => clearTimeout(timer);
    // Each refresh brings a new elapsedMs; the deadline is fixed at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, router]);

  const lifetime = pending.status === "lifetime-pending";
  if (settled) {
    return (
      <div className="account-checkout-status" role="status">
        <strong>You’re all set.</strong>
        <span>{lifetime ? "Lifetime access is active." : "Your plan is active."}</span>
      </div>
    );
  }
  if (slow) {
    return (
      <div className="account-checkout-status" role="status">
        <strong>Still finishing setup.</strong>
        <span>This is taking longer than usual. Refresh in a minute, or email <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a> if access doesn’t appear.</span>
      </div>
    );
  }
  return (
    <div className="account-checkout-status" role="status">
      <strong>{lifetime ? "Finishing your Lifetime setup." : "Finishing your plan setup."}</strong>
      <span>If you just paid, your access will appear here in a few seconds.</span>
    </div>
  );
}
