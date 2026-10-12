import { afterEach, describe, expect, it, vi } from "vitest";

const captureServerException = vi.hoisted(() => vi.fn());
const serverLog = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-error-tracking", () => ({ captureServerException }));
vi.mock("@/lib/server-logs", () => ({ serverLog }));

import { annotateFailureResponse, withFailureReporting } from "@/lib/route-failure-reporting";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("withFailureReporting", () => {
  afterEach(() => { captureServerException.mockReset(); serverLog.mockReset(); });

  it("logs every request with route, method, status and duration", async () => {
    await withFailureReporting("/api/questions/search", async (request: Request) => json(200, { method: request.method }))(new Request("https://pastpaperprep.com/api/questions/search?q=alice", { method: "GET" }));
    expect(serverLog).toHaveBeenCalledExactlyOnceWith("info", "api_request", expect.objectContaining({ route: "/api/questions/search", method: "GET", status: 200, duration_ms: expect.any(Number) }));
    expect(JSON.stringify(serverLog.mock.calls)).not.toContain("alice");
    expect(captureServerException).not.toHaveBeenCalled();
  });

  it("puts the reported failure's correlation id on the response and in the log", async () => {
    captureServerException.mockReturnValue("7f1b6a2e-0000-4000-8000-000000000000");
    const response = await withFailureReporting("/api/assets/sign", async () => annotateFailureResponse(json(503, {}), { bank: "ib-sl", stage: "signing", storage_provider: "r2", error_code: "signing_failed" }))();
    expect(response.headers.get("x-correlation-id")).toBe("7f1b6a2e-0000-4000-8000-000000000000");
    expect(serverLog).toHaveBeenCalledWith("error", "api_request", expect.objectContaining({ status: 503, correlation_id: "7f1b6a2e-0000-4000-8000-000000000000", bank: "ib-sl", stage: "signing", storage_provider: "r2" }));
  });

  it("logs a thrown handler and rethrows it for onRequestError", async () => {
    const failure = new Error("boom");
    await expect(withFailureReporting("/api/x", async () => { throw failure; })()).rejects.toBe(failure);
    expect(serverLog).toHaveBeenCalledWith("error", "api_request", expect.objectContaining({ route: "/api/x", status: 500, outcome: "thrown" }));
  });

  it("uses private annotations rather than body fields and reports a response only once", async () => {
    const response = annotateFailureResponse(json(503, { error: "secret", stage: "quota", bank: "other", correlation_id: "credential" }), { bank: "ib-sl", stage: "signing", storage_provider: "r2", error_code: "signing_failed" });
    const handler = withFailureReporting("/api/assets/sign", withFailureReporting("/api/assets/sign", async () => response));
    expect(await handler()).toBe(response);
    expect(captureServerException).toHaveBeenCalledTimes(1);
    expect(captureServerException.mock.calls[0][1]).toEqual({ error_source: "handled_response", route: "/api/assets/sign", http_status: "503", bank: "ib-sl", stage: "signing", storage_provider: "r2", error_code: "signing_failed" });
    expect([...response.headers.keys()]).toEqual(["content-type"]);
    expect(await response.json()).toMatchObject({ error: "secret", correlation_id: "credential" });
  });

  it("never promotes printable body text into telemetry", async () => {
    await withFailureReporting("/api/x", async () => json(503, { error: "Bearer supersecret" }))();
    expect(captureServerException.mock.calls[0][1]).not.toHaveProperty("reason");
  });

  it("reports a handled 5xx with route and status, without reading or altering its body", async () => {
    const handler = withFailureReporting("/api/assets/sign", async () => json(503, { error: "Private assets are temporarily unavailable" }));
    const response = await handler();
    await flush();
    expect(await response.json()).toEqual({ error: "Private assets are temporarily unavailable" });
    expect(response.status).toBe(503);
    expect(captureServerException).toHaveBeenCalledTimes(1);
    const [error, metadata] = captureServerException.mock.calls[0];
    expect((error as Error).message).toBe("Handled server failure");
    expect(metadata).toEqual({ error_source: "handled_response", route: "/api/assets/sign", http_status: "503", error_code: "response_failed" });
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
    expect(captureServerException.mock.calls[0][1]).toEqual({ error_source: "handled_response", route: "/api/x", http_status: "500", error_code: "response_failed" });
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

  it("never waits on a 5xx body that does not finish", async () => {
    const endless = new ReadableStream({ start() { /* never closes */ } });
    const started = Date.now();
    const response = await withFailureReporting("/api/x", async () => new Response(endless, { status: 500, headers: { "content-type": "application/json" } }))();
    expect(response.status).toBe(500);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("drops reasons that look like personal or provider data", async () => {
    await withFailureReporting("/api/x", async () => json(500, { error: "Could not email alice@example.com" }))();
    await withFailureReporting("/api/x", async () => json(500, { error: "Upstream said: duplicate key 123456789" }))();
    await flush();
    expect(captureServerException.mock.calls.every(([, metadata]) => !("reason" in metadata))).toBe(true);
  });
});
