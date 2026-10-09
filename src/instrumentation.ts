import { captureServerException } from "@/lib/server-error-tracking";

// Route file patterns such as /banks/[slug] identify the failing page without any request data.
const ROUTE_PATTERN = /^\/[A-Za-z0-9_\-/[\].()@]*$/;
// Provider error codes (e.g. PGRST301, refresh_token_already_used) are short enumerated identifiers.
const ERROR_CODE = /^[A-Za-z0-9_-]{1,40}$/;

export async function onRequestError(error: unknown, _request: Request, context: { routerKind: string; routePath: string; routeType: string }) {
  const message = error instanceof Error ? error.message : "";
  if (/(?:rate.?limit|cooldown|too many requests|invalid credentials|invalid login credentials)/i.test(message)) return;
  if (error && typeof error === "object") {
    const digest = "digest" in error && typeof error.digest === "string" ? error.digest : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) return;
  }
  const route = context.routePath.length <= 80 && ROUTE_PATTERN.test(context.routePath)
    ? context.routePath
    : context.routeType === "route" ? "/api/[route]" : "/[route]";
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && ERROR_CODE.test(error.code)
    ? { error_code: error.code }
    : {};
  captureServerException(error, {
    router_kind: context.routerKind.slice(0, 20),
    route_type: context.routeType.slice(0, 20),
    route,
    ...code,
  });
}
