import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterWork = vi.hoisted(() => [] as Array<() => unknown>);
const lifecycle = vi.hoisted(() => ({ queue: undefined as Array<() => unknown> | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (work: () => unknown) => { (lifecycle.queue ?? afterWork).push(work); } }));

type OtlpBody = { resourceLogs: Array<{ resource: { attributes: Array<{ key: string; value: Record<string, unknown> }> }; scopeLogs: Array<{ logRecords: Array<{ severityText: string; severityNumber: number; body: { stringValue: string }; attributes: Array<{ key: string; value: Record<string, unknown> }> }> }> }> };

async function runAfterWork(queue = afterWork) {
  while (queue.length) await queue.shift()!();
}

describe("serverLog", () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  beforeEach(() => {
    vi.resetModules();
    afterWork.length = 0;
    lifecycle.queue = undefined;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
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

  it("aborts a stalled upload and settles its after callback within three seconds", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    let release: (() => void) | undefined;
    fetchMock.mockImplementationOnce((_url?: unknown, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
      signal = init?.signal ?? undefined;
      release = () => resolve(new Response(null, { status: 200 }));
      signal?.addEventListener("abort", () => reject(signal?.reason), { once: true });
    }));
    try {
      const { serverLog } = await import("./server-logs");
      serverLog("error", "api_request", { status: 500 });
      let settled = false;
      const work = runAfterWork().then(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(3_000);
      expect(signal?.aborted).toBe(true);
      expect(settled).toBe(true);
      await work;
    } finally {
      release?.();
      vi.useRealTimers();
    }
  });

  it("delivers a completed request's 503 while the first request stays open, before later volume can evict it", async () => {
    const { serverLog } = await import("./server-logs");
    const open: Array<() => unknown> = [];
    const completed: Array<() => unknown> = [];
    lifecycle.queue = open;
    serverLog("info", "api_request", { status: 200 });
    lifecycle.queue = completed;
    serverLog("error", "api_request", { status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
    await runAfterWork(completed);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const records = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as OtlpBody;
    expect(records.resourceLogs[0].scopeLogs[0].logRecords).toContainEqual(expect.objectContaining({
      severityText: "ERROR", attributes: [{ key: "status", value: { intValue: 503 } }],
    }));
    lifecycle.queue = open;
    for (let i = 0; i < 500; i++) serverLog("info", "api_request", { status: 200 });
    await runAfterWork(open);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const allRecords = fetchMock.mock.calls.flatMap((call) => {
      const body = JSON.parse(String((call as unknown as [string, RequestInit])[1].body)) as OtlpBody;
      return body.resourceLogs[0].scopeLogs[0].logRecords;
    });
    expect(allRecords.filter((record) => record.severityText === "ERROR")).toHaveLength(1);
  });

  it("lets another completed request upload while a prior lifecycle's upload is stalled", async () => {
    let release: (() => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      release = () => resolve(new Response(null, { status: 200 }));
    }));
    const { serverLog } = await import("./server-logs");
    const first: Array<() => unknown> = [];
    const second: Array<() => unknown> = [];
    lifecycle.queue = first;
    serverLog("info", "api_request", { status: 200 });
    const stalled = runAfterWork(first);
    try {
      lifecycle.queue = second;
      serverLog("error", "api_request", { status: 500 });
      serverLog("warn", "entitlement_read_retry", { attempt: 1 });
      const completed = runAfterWork(second);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await completed;
      const body = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body)) as OtlpBody;
      expect(body.resourceLogs[0].scopeLogs[0].logRecords.map((record) => record.severityText)).toEqual(["ERROR", "WARN"]);
    } finally {
      release?.();
      await stalled;
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bounds an undrained buffer to the latest 500 records", async () => {
    const { serverLog } = await import("./server-logs");
    for (let i = 0; i < 501; i++) serverLog("info", "api_request", { sequence: i });
    await runAfterWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as OtlpBody;
    const records = body.resourceLogs[0].scopeLogs[0].logRecords;
    expect(records).toHaveLength(500);
    expect(records[0].attributes).toEqual([{ key: "sequence", value: { intValue: 1 } }]);
    expect(records[499].attributes).toEqual([{ key: "sequence", value: { intValue: 500 } }]);
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
