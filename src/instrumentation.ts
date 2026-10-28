import { captureServerException } from "@/lib/server-error-tracking";
import { safeServerErrorCode } from "@/lib/safe-server-error-code";
import { isExpectedRequestError } from "@/lib/expected-request-error";
import { accountIdFromCookieHeader } from "@/lib/supabase/auth-cookie";

// Route file patterns such as /banks/[slug] identify the failing page without any request data.
const ROUTE_PATTERN = /^\/[A-Za-z0-9_\-/[\].()@]*$/;
function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = safeServerErrorCode(error.code);
    if (code) return code;
  }
  // Next may wrap a provider object in Error(JSON.stringify(object)). Read ONLY
  // its top-level enumerated code; never forward the message, details or hints.
  if (error instanceof Error && error.message.length <= 8192 && error.message.trimStart().startsWith("{")) {
    try {
      const object: unknown = JSON.parse(error.message);
      if (object && typeof object === "object" && !Array.isArray(object) && "code" in object) return safeServerErrorCode(object.code);
    } catch { /* Not a provider JSON object. */ }
  }
  return undefined;
}

// Next passes headers as a plain object; tests and older callers may pass a Request.
function cookieHeader(request: unknown): string | undefined {
  const headers = request && typeof request === "object" && "headers" in request ? (request as { headers: unknown }).headers : undefined;
  if (headers instanceof Headers) return headers.get("cookie") ?? undefined;
  const cookie = headers && typeof headers === "object" ? (headers as Record<string, unknown>).cookie : undefined;
  return Array.isArray(cookie) ? cookie.join("; ") : typeof cookie === "string" ? cookie : undefined;
}

export async function onRequestError(error: unknown, request: unknown, context: { routerKind: string; routePath: string; routeType: string }) {
  if (isExpectedRequestError(error)) return;
  const digest = error && typeof error === "object" && "digest" in error && typeof error.digest === "string" ? error.digest : "";
  const route = context.routePath.length <= 80 && ROUTE_PATTERN.test(context.routePath)
    ? context.routePath
    : context.routeType === "route" ? "/api/[route]" : "/[route]";
  const code = errorCode(error);
  const userId = accountIdFromCookieHeader(cookieHeader(request));
  const method = request && typeof request === "object" && "method" in request && typeof request.method === "string" ? request.method.toUpperCase().slice(0, 10) : "";
  captureServerException(error, {
    router_kind: context.routerKind.slice(0, 20),
    route_type: context.routeType.slice(0, 20),
    route,
    ...(code ? { error_code: code } : {}),
    ...(digest ? { digest } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(method ? { method } : {}),
  });
}
