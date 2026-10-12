import "server-only";
import { captureServerException } from "@/lib/server-error-tracking";

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

/** Thrown failures propagate to onRequestError. Returned failures are reported once, without reading their bodies. */
export function withFailureReporting<Args extends unknown[]>(route: string, handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    const response = await handler(...args);
    if (response.status >= 500 && !reported.has(response)) {
      reported.add(response);
      try {
        captureServerException(new Error("Handled server failure"), {
          error_source: "handled_response", route, http_status: String(response.status),
          error_code: "response_failed", ...diagnostics.get(response),
        });
      } catch { /* Telemetry must never change the response. */ }
    }
    return response;
  };
}
