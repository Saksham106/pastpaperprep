import "server-only";
import { captureServerException } from "@/lib/server-error-tracking";
import { serverLog } from "@/lib/server-logs";
import { accountIdFromCookieHeader } from "@/lib/supabase/auth-cookie";

export type FailureDiagnostics = {
  bank: string;
  stage: "manifest" | "signing" | "entitlement" | "quota" | "response";
  storage_provider: "local" | "supabase" | "r2" | "unknown";
  error_code: "manifest_unavailable" | "signing_failed" | "entitlement_unavailable" | "quota_unavailable" | "response_failed";
};
const diagnostics = new WeakMap<Response, FailureDiagnostics>();
const reported = new WeakSet<Response>();

/** Internal-only annotations: never read diagnostic fields from a client body or headers. */
export function annotateFailureResponse<T extends Response>(response: T, metadata: FailureDiagnostics): T {
  diagnostics.set(response, { ...metadata });
  return response;
}

/**
 * Logs every request (route pattern, method, status, duration) to PostHog Logs and reports
 * returned 5xx failures once, without reading their bodies. A reported failure carries its
 * correlation id in `x-correlation-id`, so the browser's failure event points at it.
 * Thrown failures propagate to onRequestError.
 */
export function withFailureReporting<Args extends unknown[], R extends Response>(route: string, handler: (...args: Args) => Promise<R>) {
  return async (...args: Args): Promise<R> => {
    const started = performance.now();
    const method = args[0] instanceof Request ? args[0].method : undefined;
    const userId = args[0] instanceof Request ? accountIdFromCookieHeader(args[0].headers.get("cookie")) : undefined;
    let response: R;
    try { response = await handler(...args); }
    catch (error) {
      serverLog("error", "api_request", { route, method, status: 500, duration_ms: Math.round(performance.now() - started), outcome: "thrown", user_id: userId });
      throw error;
    }
    let correlationId: string | undefined;
    if (response.status >= 500 && !reported.has(response)) {
      reported.add(response);
      try {
        correlationId = captureServerException(new Error("Handled server failure"), {
          error_source: "handled_response", route, http_status: String(response.status),
          error_code: "response_failed", ...diagnostics.get(response), ...(userId ? { user_id: userId } : {}),
        });
        if (correlationId) response.headers.set("x-correlation-id", correlationId);
      } catch { /* Telemetry must never change the response; immutable headers stay as they are. */ }
    }
    const failure = diagnostics.get(response);
    serverLog(response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info", "api_request", {
      route, method, status: response.status, duration_ms: Math.round(performance.now() - started),
      correlation_id: correlationId, user_id: userId, bank: failure?.bank, stage: failure?.stage, storage_provider: failure?.storage_provider,
    });
    return response;
  };
}
