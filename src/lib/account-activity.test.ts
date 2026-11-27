import { afterEach, describe, expect, it, vi } from "vitest";

const { accountId } = vi.hoisted(() => ({ accountId: vi.fn<() => string | undefined>() }));
vi.mock("@/lib/product-analytics", () => ({ browserAccountId: accountId }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => { throw new Error("tests pass their own client"); } }));

import { activityArea, recordAccountActivity, recordAccountActivityAfterAuthChange, resetAccountActivityForTests } from "@/lib/account-activity";

describe("account activity", () => {
  afterEach(() => { vi.useRealTimers(); accountId.mockReset(); resetAccountActivityForTests(); vi.unstubAllGlobals(); });

  it("maps pages to a fixed set of areas", () => {
    expect(activityArea("/")).toBe("home");
    expect(activityArea("/banks/igcse")).toBe("bank");
    expect(activityArea("/banks/ib-hl/topics/calculus")).toBe("bank");
    expect(activityArea("/past-papers/ib-math-aa-hl/2026-may-paper-2-tz3")).toBe("past_papers");
    expect(activityArea("/revision-notes/ib-maths-aa/5-16")).toBe("notes");
    expect(activityArea("/worksheets/build")).toBe("worksheets");
    expect(activityArea("/dashboard")).toBe("dashboard");
    expect(activityArea("/pricing")).toBe("pricing");
    expect(activityArea("/bankster")).toBe("other");
    expect(activityArea("/login")).toBe("other");
  });

  it("records the area for a signed-in account once the page is idle, and never the path", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    accountId.mockReturnValue("6a1c2a8e-0000-4000-8000-000000000000");
    const rpc = vi.fn().mockResolvedValue({ error: null });
    recordAccountActivity("/banks/igcse?topics=Algebra", () => ({ rpc }));
    expect(rpc).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);
    expect(rpc).toHaveBeenCalledWith("record_account_activity", { p_area: "bank" });
    vi.unstubAllGlobals();
  });

  it("sends nothing when signed out", async () => {
    vi.useFakeTimers();
    accountId.mockReturnValue(undefined);
    const rpc = vi.fn();
    recordAccountActivity("/banks/igcse", () => ({ rpc }));
    await vi.advanceTimersByTimeAsync(6000);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("swallows failures", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    accountId.mockReturnValue("6a1c2a8e-0000-4000-8000-000000000000");
    recordAccountActivity("/", () => ({ rpc: () => Promise.reject(new Error("offline")) }));
    recordAccountActivity("/", () => { throw new Error("no client"); });
    await vi.advanceTimersByTimeAsync(1500);
    vi.unstubAllGlobals();
  });

  it("drops a queued page if another account is signed in by the time it would be sent", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    accountId.mockReturnValue("account-a");
    const rpc = vi.fn().mockResolvedValue({ error: null });
    recordAccountActivity("/banks/igcse", () => ({ rpc }));
    accountId.mockReturnValue("account-b");
    await vi.advanceTimersByTimeAsync(1500);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("counts the open page once for a newly signed-in account, not on every session refresh", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const rpc = vi.fn().mockResolvedValue({ error: null });
    accountId.mockReturnValue(undefined);
    recordAccountActivity("/banks/igcse", () => ({ rpc }));
    accountId.mockReturnValue("account-a");
    recordAccountActivityAfterAuthChange("/banks/igcse", () => ({ rpc }));
    recordAccountActivityAfterAuthChange("/banks/igcse", () => ({ rpc }));
    await vi.advanceTimersByTimeAsync(1500);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("record_account_activity", { p_area: "bank" });
  });
});

