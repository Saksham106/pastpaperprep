import { installApiFailureMonitor } from "@/lib/api-failure-monitor";
import { isBrowserExtensionError } from "@/lib/error-privacy";
import { initializeProductAnalytics, captureAppException } from "@/lib/product-analytics";

initializeProductAnalytics();

if (typeof window !== "undefined") {
  installApiFailureMonitor(window);
  window.addEventListener("error", event => {
    if (event.error instanceof Error && !isBrowserExtensionError(event.error)) captureAppException(event.error);
  });
  window.addEventListener("unhandledrejection", event => {
    const reason: unknown = event.reason;
    if (reason instanceof Error) { if (!isBrowserExtensionError(reason)) captureAppException(reason); }
    // Libraries sometimes reject with a string or object; keep it as an (scrubbed) exception too.
    else if (reason !== undefined && reason !== null) captureAppException(Object.assign(new Error(typeof reason === "string" ? reason : "Non-error promise rejection"), { name: "UnhandledRejection" }));
  });
}
