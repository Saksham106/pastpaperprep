// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const captureServerException = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server-error-tracking", () => ({ captureServerException }));

import { onRequestError } from "./instrumentation";

const request = new Request("https://pastpaperprep.com/account?email=alice@example.com");

describe("onRequestError telemetry", () => {
  beforeEach(() => captureServerException.mockReset());

  it("records the route file pattern, never the requested URL", async () => {
    await onRequestError(new Error("boom"), request, { routerKind: "App Router", routePath: "/account", routeType: "render" });
    await onRequestError(new Error("boom"), request, { routerKind: "App Router", routePath: "/banks/[slug]/topics/[topicSlug]", routeType: "render" });

    expect(captureServerException.mock.calls[0][1]).toMatchObject({ route: "/account", route_type: "render" });
    expect(captureServerException.mock.calls[1][1]).toMatchObject({ route: "/banks/[slug]/topics/[topicSlug]" });
    expect(JSON.stringify(captureServerException.mock.calls)).not.toContain("alice");
  });

  it("falls back to a generic route when the pattern looks unexpected", async () => {
    await onRequestError(new Error("boom"), request, { routerKind: "App Router", routePath: "/account?email=alice@example.com", routeType: "render" });
    await onRequestError(new Error("boom"), request, { routerKind: "App Router", routePath: "/api/x", routeType: "route" });
    await onRequestError(new Error("boom"), request, { routerKind: "App Router", routePath: `/${"a".repeat(90)}`, routeType: "render" });

    expect(captureServerException.mock.calls.map((call) => call[1].route)).toEqual(["/[route]", "/api/x", "/[route]"]);
  });

  it("adds a provider error code only when it is a short identifier", async () => {
    await onRequestError(Object.assign(new Error("JWT expired"), { code: "PGRST301" }), request, { routerKind: "App Router", routePath: "/account", routeType: "render" });
    await onRequestError(Object.assign(new Error("x"), { code: "user alice@example.com" }), request, { routerKind: "App Router", routePath: "/account", routeType: "render" });

    expect(captureServerException.mock.calls[0][1]).toMatchObject({ error_code: "PGRST301" });
    expect(captureServerException.mock.calls[1][1]).not.toHaveProperty("error_code");
  });

  it("recovers only allowlisted codes from bounded Next JSON messages", async () => {
    const context = { routerKind: "App Router", routePath: "/account", routeType: "render" };
    await onRequestError(new Error(JSON.stringify({ code: "PGRST303", message: "alice@example.com token=secret", details: "secret" })), request, context);
    await onRequestError(new Error(JSON.stringify({ code: "secret" })), request, context);
    await onRequestError(new Error("prefix PGRST303 secret"), request, context);
    await onRequestError(new Error(JSON.stringify({ code: "PGRST303", message: "x".repeat(9000) })), request, context);
    expect(captureServerException.mock.calls[0][1]).toMatchObject({ error_code: "PGRST303" });
    expect(captureServerException.mock.calls.slice(1).every((call) => !("error_code" in call[1]))).toBe(true);
    expect(JSON.stringify(captureServerException.mock.calls.map((call) => call[1]))).not.toMatch(/secret|alice/);
  });

  it("still ignores redirects and expected auth noise", async () => {
    await onRequestError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }), request, { routerKind: "App Router", routePath: "/account", routeType: "render" });
    await onRequestError(new Error("Invalid login credentials"), request, { routerKind: "App Router", routePath: "/login", routeType: "action" });

    expect(captureServerException).not.toHaveBeenCalled();
  });
});
