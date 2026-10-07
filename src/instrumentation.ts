import { captureServerException } from "@/lib/server-error-tracking";

export async function onRequestError(error: unknown, _request: Request, context: { routerKind: string; routePath: string; routeType: string }) {
  const message = error instanceof Error ? error.message : "";
  if (/(?:rate.?limit|cooldown|too many requests|invalid credentials|invalid login credentials)/i.test(message)) return;
  if (error && typeof error === "object") {
    const digest = "digest" in error && typeof error.digest === "string" ? error.digest : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) return;
  }
  captureServerException(error, {
    router_kind: context.routerKind.slice(0, 20),
    route_type: context.routeType.slice(0, 20),
    route: context.routeType === "route" ? "/api/[route]" : "/[route]",
  });
}
