import { browserAccountId, trackProductEvent } from "@/lib/product-analytics";

// Statuses the UI usually absorbs quietly but that mean something broke or a limit was hit.
// 401/403/404/409 are expected outcomes of signed-out, locked or stale requests.
const REPORTED_CLIENT_STATUSES = new Set([400, 408, 413, 429]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
const MONITORED = Symbol.for("pastpaperprep.apiFailureMonitor");
// One lost connection fails every in-flight request at once; report it once per route.
const NETWORK_ERROR_WINDOW_MS = 30_000;

/** Same-origin API route with ids collapsed and the query dropped, e.g. /api/worksheets/[id]. */
export function apiRoutePattern(input: RequestInfo | URL, origin: string): string | null {
  let url: URL;
  try { url = new URL(input instanceof Request ? input.url : String(input), origin); } catch { return null; }
  if (url.origin !== origin || !url.pathname.startsWith("/api/")) return null;
  const parts = url.pathname.split("/").filter(Boolean).slice(0, 8).map((part) => SLUG.test(part) && !UUID.test(part) ? part : "[id]");
  return `/${parts.join("/")}`;
}

/**
 * Reports our own API calls that fail where the user is (5xx, limits, bad requests, network
 * errors), including the failures each screen handles quietly. Network errors are skipped while
 * the page unloads, is hidden or offline, and reported at most once per route per 30 seconds. The server's correlation id
 * links the event to its server-side report. Observes only: responses and errors pass through.
 */
export function installApiFailureMonitor(target: Window = window) {
  const original = target.fetch;
  if (typeof original !== "function" || (original as unknown as Record<symbol, boolean>)[MONITORED]) return;
  // Leaving the page, a backgrounded tab or a dropped connection cancels requests; none is our fault.
  let unloading = false;
  target.addEventListener?.("pagehide", () => { unloading = true; });
  target.addEventListener?.("pageshow", () => { unloading = false; });
  const lastNetworkError = new Map<string, number>();
  const reportableNetworkError = (route: string) => {
    if (unloading || target.navigator?.onLine === false || target.document?.visibilityState === "hidden") return false;
    const now = Date.now();
    const last = lastNetworkError.get(route);
    if (last !== undefined && now - last < NETWORK_ERROR_WINDOW_MS) return false;
    lastNetworkError.set(route, now);
    return true;
  };
  const monitored = async (input: RequestInfo | URL, init?: RequestInit) => {
    const route = apiRoutePattern(input, target.location.origin);
    if (!route) return original.call(target, input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase().slice(0, 10);
    const started = performance.now();
    // The account that sent the request, not whoever is signed in when it fails.
    const userId = browserAccountId();
    const report = (status: number, outcome: string, correlationId?: string | null) => trackProductEvent("api_request_failed", {
      route, method, status, outcome, duration_ms: Math.round(performance.now() - started),
      correlation_id: correlationId && UUID.test(correlationId) ? correlationId : undefined,
      user_id: userId,
    });
    let response: Response;
    try { response = await original.call(target, input, init); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && !init?.signal?.aborted && reportableNetworkError(route)) report(0, "network_error");
      throw error;
    }
    if (response.status >= 500) report(response.status, "server_error", response.headers.get("x-correlation-id"));
    else if (REPORTED_CLIENT_STATUSES.has(response.status)) report(response.status, "client_error");
    return response;
  };
  Object.defineProperty(monitored, MONITORED, { value: true });
  target.fetch = monitored as typeof fetch;
}
