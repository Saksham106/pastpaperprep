"use client";

import { useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/product-analytics";

/** Drops `?checkout=` once reported, so reloading the page is not counted as another return. */
export function clearCheckoutParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("checkout")) return;
    url.searchParams.delete("checkout");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* address bar cleanup is cosmetic */ }
}

/** Reports once that Stripe sent the buyer back to the account page. */
export function CheckoutReturnTracker({ status }: { status: "success" | "lifetime-pending" }) {
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    trackProductEvent("checkout_returned", { status });
    clearCheckoutParam();
  }, [status]);
  return null;
}
