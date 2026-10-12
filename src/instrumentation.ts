import { captureServerException } from "@/lib/server-error-tracking";
import { safeServerErrorCode } from "@/lib/safe-server-error-code";

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

export async function onRequestError(error: unknown, _request: Request, context: { routerKind: string; routePath: string; routeType: string }) {
  const message = error instanceof Error ? error.message : "";
  if (/(?:rate.?limit|cooldown|too many requests|invalid credentials|invalid login credentials)/i.test(message)) return;
  const digest = error && typeof error === "object" && "digest" in error && typeof error.digest === "string" ? error.digest : "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) return;
  const route = context.routePath.length <= 80 && ROUTE_PATTERN.test(context.routePath)
    ? context.routePath
    : context.routeType === "route" ? "/api/[route]" : "/[route]";
  const code = errorCode(error);
  captureServerException(error, {
    router_kind: context.routerKind.slice(0, 20),
    route_type: context.routeType.slice(0, 20),
    route,
    ...(code ? { error_code: code } : {}),
    ...(digest ? { digest } : {}),
  });
}
