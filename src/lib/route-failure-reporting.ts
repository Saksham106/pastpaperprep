import "server-only";
import { captureServerException } from "@/lib/server-error-tracking";

const SAFE_REASON = /^[\x20-\x7E’]{1,80}$/;
// Static route messages only: anything resembling an address or an identifier is dropped.
const UNSAFE_REASON = /@|\d{4,}/;
const PARSE_TIMEOUT = Symbol("timeout");

/**
 * Wraps an API route handler so 5xx responses it returns on purpose (caught failures
 * answered with a polite error) still reach error tracking. Unhandled throws keep
 * propagating to `onRequestError`, which already reports them. Never changes the response.
 */
export function withFailureReporting<Args extends unknown[]>(route: string, handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    const response = await handler(...args);
    if (response.status >= 500) await reportHandledFailure(route, response);
    return response;
  };
}

async function reportHandledFailure(route: string, response: Response) {
  try {
    const metadata: Record<string, string> = { error_source: "handled_response", route, error_code: String(response.status) };
    if (response.headers.get("content-type")?.includes("application/json")) {
      // Never hold the response on its body: give the copy 50 ms, then let it go.
      const copy = response.clone();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const body = await Promise.race([
        copy.json().catch(() => undefined),
        new Promise<typeof PARSE_TIMEOUT>((resolve) => { timer = setTimeout(() => resolve(PARSE_TIMEOUT), 50); }),
      ]).finally(() => clearTimeout(timer));
      if (body === PARSE_TIMEOUT) void copy.body?.cancel().catch(() => {});
      const reason = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : undefined;
      if (typeof reason === "string" && SAFE_REASON.test(reason) && !UNSAFE_REASON.test(reason)) metadata.reason = reason;
    }
    captureServerException(new Error("Handled server failure"), metadata);
  } catch { /* telemetry is best effort */ }
}
