import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackProductEvent, browserAccountId } = vi.hoisted(() => ({ trackProductEvent: vi.fn(), browserAccountId: vi.fn((): string | undefined => undefined) }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent, browserAccountId }));

import { apiRoutePattern, installApiFailureMonitor } from "./api-failure-monitor";

const ORIGIN = window.location.origin;

describe("apiRoutePattern", () => {
  it("keeps same-origin API routes and collapses ids, dropping the query", () => {
    expect(apiRoutePattern("/api/assets/free?bank=igcse&id=0580-2018-june-21-q1", ORIGIN)).toBe("/api/assets/free");
    expect(apiRoutePattern(`${ORIGIN}/api/worksheets/7f1b6a2e-0000-4000-8000-000000000000`, ORIGIN)).toBe("/api/worksheets/[id]");
    expect(apiRoutePattern("/api/private-bank-index/igcse-biology-0610", ORIGIN)).toBe("/api/private-bank-index/igcse-biology-0610");
    expect(apiRoutePattern("/api/x/alice%40example.com", ORIGIN)).toBe("/api/x/[id]");
  });
  it("ignores pages, other origins and malformed input", () => {
    expect(apiRoutePattern("/banks/igcse?_rsc=1", ORIGIN)).toBeNull();
    expect(apiRoutePattern("https://us.i.posthog.com/api/e", ORIGIN)).toBeNull();
    expect(apiRoutePattern("http://[bad", ORIGIN)).toBeNull();
  });
});

describe("installApiFailureMonitor", () => {
  let target: { fetch: typeof fetch; location: Location };
  const original = vi.fn<typeof fetch>();
  beforeEach(() => {
    original.mockReset();
    trackProductEvent.mockReset();
    target = { fetch: original, location: window.location };
    installApiFailureMonitor(target as unknown as Window);
  });
  afterEach(() => vi.restoreAllMocks());

  it("reports a failed API response with its correlation id and returns the response untouched", async () => {
    const response = new Response("{}", { status: 503, headers: { "x-correlation-id": "7f1b6a2e-0000-4000-8000-000000000000" } });
    original.mockResolvedValue(response);
    expect(await target.fetch("/api/assets/sign", { method: "POST", body: "{}" })).toBe(response);
    expect(original).toHaveBeenCalledWith("/api/assets/sign", { method: "POST", body: "{}" });
    expect(trackProductEvent).toHaveBeenCalledExactlyOnceWith("api_request_failed", {
      route: "/api/assets/sign", method: "POST", status: 503, outcome: "server_error",
      duration_ms: expect.any(Number), correlation_id: "7f1b6a2e-0000-4000-8000-000000000000",
    });
  });

  it("reports limits and bad requests but not expected auth, access or missing responses", async () => {
    for (const status of [200, 401, 403, 404, 409]) {
      original.mockResolvedValueOnce(new Response(null, { status }));
      await target.fetch("/api/worksheets");
    }
    expect(trackProductEvent).not.toHaveBeenCalled();
    original.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await target.fetch("/api/pdf/sign");
    expect(trackProductEvent).toHaveBeenCalledWith("api_request_failed", expect.objectContaining({ route: "/api/pdf/sign", status: 429, outcome: "client_error" }));
  });

  it("reports network failures, rethrows them, and ignores aborts and non-API requests", async () => {
    original.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(target.fetch("/api/banks/bootstrap?bank=igcse")).rejects.toThrow("Failed to fetch");
    expect(trackProductEvent).toHaveBeenCalledWith("api_request_failed", expect.objectContaining({ route: "/api/banks/bootstrap", status: 0, outcome: "network_error" }));

    trackProductEvent.mockReset();
    original.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(target.fetch("/api/questions/search")).rejects.toThrow();
    original.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await target.fetch("/banks/igcse");
    expect(trackProductEvent).not.toHaveBeenCalled();
  });

  it("links the failure to the signed-in account id", async () => {
    browserAccountId.mockReturnValueOnce("7f1b6a2e-0000-4000-8000-000000000000");
    original.mockResolvedValue(new Response(null, { status: 500 }));
    await target.fetch("/api/worksheets");
    expect(trackProductEvent).toHaveBeenCalledWith("api_request_failed", expect.objectContaining({ user_id: "7f1b6a2e-0000-4000-8000-000000000000" }));
  });

  it.each([
    ["another account", "7f1b6a2e-0000-4000-8000-00000000000b"],
    ["sign-out", undefined],
  ])("keeps the dispatching account when %s happens before the failure", async (_label, later) => {
    const A = "7f1b6a2e-0000-4000-8000-00000000000a";
    let current: string | undefined = A;
    browserAccountId.mockImplementation(() => current);
    let finish!: (response: Response) => void;
    original.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = target.fetch("/api/assets/sign");
    current = later;
    finish(new Response(null, { status: 503 }));
    await pending;
    expect(trackProductEvent).toHaveBeenCalledWith("api_request_failed", expect.objectContaining({ status: 503, user_id: A }));
    browserAccountId.mockReset();
    browserAccountId.mockImplementation(() => undefined);
  });

  it("installs once", () => {
    const monitored = target.fetch;
    installApiFailureMonitor(target as unknown as Window);
    expect(target.fetch).toBe(monitored);
  });
});
