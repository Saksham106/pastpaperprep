import { initializeProductAnalytics, captureAppException } from "@/lib/product-analytics";

initializeProductAnalytics();

if (typeof window !== "undefined") {
  window.addEventListener("error", event => {
    if (event.error instanceof Error) captureAppException(event.error);
  });
  window.addEventListener("unhandledrejection", event => {
    if (event.reason instanceof Error) captureAppException(event.reason);
  });
}
