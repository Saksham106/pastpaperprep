import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterWork = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (work: () => unknown) => { afterWork.push(work); } }));

type OtlpBody = { resourceLogs: Array<{ resource: { attributes: Array<{ key: string; value: Record<string, unknown> }> }; scopeLogs: Array<{ logRecords: Array<{ severityText: string; severityNumber: number; body: { stringValue: string }; attributes: Array<{ key: string; value: Record<string, unknown> }> }> }> }> };

async function runAfterWork() {
  while (afterWork.length) await afterWork.shift()!();
}

describe("serverLog", () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  beforeEach(() => {
    vi.resetModules();
    afterWork.length = 0;
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("batches a request's records into one OTLP/JSON post to PostHog Logs after the response", async () => {
    const { serverLog } = await import("./server-logs");
    serverLog("info", "api_request", { route: "/api/assets/free", status: 200, duration_ms: 41, cached: false });
    serverLog("warn", "entitlement_read_retry", { attempt: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    await runAfterWork();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/i/v1/logs");
    expect(init.headers).toMatchObject({ "content-type": "application/json", authorization: "Bearer phc_test_project_token" });
    const body = JSON.parse(String(init.body)) as OtlpBody;
    const resource = Object.fromEntries(body.resourceLogs[0].resource.attributes.map(({ key, value }) => [key, value.stringValue]));
    expect(resource).toEqual({ "service.name": "pastpaperprep", "deployment.environment": "production", "service.version": "abc123" });
    const [request, retry] = body.resourceLogs[0].scopeLogs[0].logRecords;
    expect(request).toMatchObject({ severityText: "INFO", severityNumber: 9, body: { stringValue: "api_request" } });
    expect(request.attributes).toEqual([
      { key: "route", value: { stringValue: "/api/assets/free" } },
      { key: "status", value: { intValue: 200 } },
      { key: "duration_ms", value: { intValue: 41 } },
      { key: "cached", value: { boolValue: false } },
    ]);
    expect(retry).toMatchObject({ severityText: "WARN", severityNumber: 13 });
  });

  it("drops malformed keys and bounds values", async () => {
    const { serverLog } = await import("./server-logs");
    serverLog("error", "x".repeat(200), { "Bad Key": "v", long: "y".repeat(500), skipped: undefined, ratio: 0.5 });
    await runAfterWork();
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as OtlpBody;
    const record = body.resourceLogs[0].scopeLogs[0].logRecords[0];
    expect(record.body.stringValue).toHaveLength(80);
    expect(record.attributes).toEqual([
      { key: "long", value: { stringValue: "y".repeat(200) } },
      { key: "ratio", value: { doubleValue: 0.5 } },
    ]);
  });

  it("sends nothing outside Vercel or without a project token, and never throws on a failed post", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    const { serverLog } = await import("./server-logs");
    serverLog("info", "api_request");
    await runAfterWork();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", "preview");
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const fresh = await import("./server-logs");
    fresh.serverLog("info", "api_request");
    await expect(runAfterWork()).resolves.toBeUndefined();
  });
});
