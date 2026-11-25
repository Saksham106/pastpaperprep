import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BROWSER_POSTHOG_API_HOST } from "@/lib/product-analytics";

type Route = { src: string; dest?: string; transforms?: Array<{ type: string; op: string; target?: { key?: unknown } }> };
const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { routes?: Route[] };
const routes = config.routes ?? [];
const ingestRoutes = routes.filter((route) => route.src.startsWith(`${BROWSER_POSTHOG_API_HOST}/`));

describe("PostHog reverse proxy (vercel.json)", () => {
  it("forwards /pp-relay to PostHog's US hosts, specific paths before the catch-all", () => {
    expect(ingestRoutes.map((route) => [route.src, route.dest])).toEqual([
      ["/pp-relay/static/(.*)", "https://us-assets.i.posthog.com/static/$1"],
      ["/pp-relay/array/(.*)", "https://us-assets.i.posthog.com/array/$1"],
      ["/pp-relay/(.*)", "https://us.i.posthog.com/$1"],
    ]);
  });

  // Same-origin requests carry the site's cookies, including Supabase session tokens.
  it("removes the cookie header on every proxied request", () => {
    for (const route of ingestRoutes) {
      expect(route.transforms, route.src).toContainEqual({ type: "request.headers", op: "delete", target: { key: "cookie" } });
    }
  });

  it("sends no other path to an external host", () => {
    const external = routes.filter((route) => /^https?:\/\//.test(route.dest ?? ""));
    expect(external).toEqual(ingestRoutes);
  });

  // Patterns EasyPrivacy (uBlock Origin's default privacy list) blocks on any host, checked 2026-11-25.
  it("uses paths that common filter lists don't block", async () => {
    const { BROWSER_CAPTURE_ENDPOINT } = await import("@/lib/product-analytics");
    const blocked = ["/ingest/", "/i/v0/", "/relay/", "/stats/", "/beacon/", "/collect", "/analytics", "/track", "posthog", "/telemetry"];
    for (const path of [`${BROWSER_POSTHOG_API_HOST}/`, `${BROWSER_POSTHOG_API_HOST}${BROWSER_CAPTURE_ENDPOINT}`]) {
      for (const pattern of blocked) expect(path.toLowerCase(), pattern).not.toContain(pattern);
    }
  });
});

