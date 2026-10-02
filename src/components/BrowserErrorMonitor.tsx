"use client";

import { useEffect } from "react";
import { captureBrowserError } from "@/lib/product-analytics";

export function BrowserErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => captureBrowserError({
      name: event.error?.name,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      captureBrowserError({
        name: reason instanceof Error ? reason.name : "UnhandledRejection",
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
