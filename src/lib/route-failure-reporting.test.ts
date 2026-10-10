import { afterEach, describe, expect, it, vi } from "vitest";

const captureServerException = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-error-tracking", () => ({ captureServerException }));

import { withFailureReporting } from "@/lib/route-failure-reporting";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("withFailureReporting", () => {
  afterEach(() => captureServerException.mockReset());

  it("reports a handled 5xx with its route, status and reason, and leaves the body intact", async () => {
    const handler = withFailureReporting("/api/assets/sign", async () => json(503, { error: "Private assets are temporarily unavailable" }));
    const response = await handler();
    await flush();
    expect(await response.json()).toEqual({ error: "Private assets are temporarily unavailable" });
    expect(response.status).toBe(503);
    expect(captureServerException).toHaveBeenCalledTimes(1);
    const [error, metadata] = captureServerException.mock.calls[0];
    expect((error as Error).message).toBe("Handled server failure");
    expect(metadata).toEqual({ error_source: "handled_response", route: "/api/assets/sign", error_code: "503", reason: "Private assets are temporarily unavailable" });
  });

  it("ignores successes and client errors", async () => {
    await withFailureReporting("/api/x", async () => json(200, { ok: true }))();
    await withFailureReporting("/api/x", async () => json(400, { error: "Bad request" }))();
    await flush();
    expect(captureServerException).not.toHaveBeenCalled();
  });

  it("reports a non-JSON 5xx without a reason", async () => {
    await withFailureReporting("/api/x", async () => new Response("boom", { status: 500 }))();
    await flush();
    expect(captureServerException.mock.calls[0][1]).toEqual({ error_source: "handled_response", route: "/api/x", error_code: "500" });
  });

  it("drops long or unusual reasons", async () => {
    await withFailureReporting("/api/x", async () => json(500, { error: "x".repeat(81) }))();
    await withFailureReporting("/api/x", async () => json(500, { error: "line\nbreak" }))();
    await flush();
    expect(captureServerException.mock.calls.every(([, metadata]) => !("reason" in metadata))).toBe(true);
  });

  it("lets thrown errors propagate without reporting them twice", async () => {
    await expect(withFailureReporting("/api/x", async () => { throw new Error("crash"); })()).rejects.toThrow("crash");
    expect(captureServerException).not.toHaveBeenCalled();
  });

  it("passes request and route context through", async () => {
    const handler = vi.fn(async (_request: Request, context: { params: Promise<{ id: string }> }) => json(200, { id: (await context.params).id }));
    const response = await withFailureReporting("/api/worksheets/[id]", handler)(new Request("https://example.test"), { params: Promise.resolve({ id: "w1" }) });
    expect(await response.json()).toEqual({ id: "w1" });
  });
});
