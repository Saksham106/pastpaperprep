"use client";

import { useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/product-analytics";

/** Reports once that Stripe sent the buyer back to the account page. */
export function CheckoutReturnTracker({ status }: { status: "success" | "lifetime-pending" }) {
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    trackProductEvent("checkout_returned", { status });
  }, [status]);
  return null;
}
