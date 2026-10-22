import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analytics = vi.hoisted(() => ({ trackProductEvent: vi.fn() }));
vi.mock("@/lib/product-analytics", () => analytics);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { CheckoutReturnStatus } from "@/components/CheckoutReturnTracker";

const pending = { status: "success" as const, startedAt: 1_761_134_400_000 };

function clearCookies() {
  document.cookie = "ppp_checkout_pending=; Path=/account; Max-Age=0";
  document.cookie = "ppp_checkout_pending=; Max-Age=0";
}

describe("CheckoutReturnStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/account?checkout=success");
    clearCookies();
  });
  afterEach(() => vi.useRealTimers());

  it("reports the return once, strips the param and remembers it for a refresh", () => {
    const { rerender } = render(<CheckoutReturnStatus pending={pending} settled={false} fromCheckout elapsedMs={0} />);
    rerender(<CheckoutReturnStatus pending={pending} settled={false} fromCheckout elapsedMs={3000} />);

    expect(analytics.trackProductEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackProductEvent).toHaveBeenCalledWith("checkout_returned", { status: "success" });
    expect(window.location.search).toBe("");
  });

  it("refreshes until the purchase settles, then clears the pending cookie", () => {
    const { rerender } = render(<CheckoutReturnStatus pending={pending} settled={false} fromCheckout={false} elapsedMs={0} />);
    expect(document.cookie).toContain(`ppp_checkout_pending=success.${pending.startedAt}`);
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(router.refresh).toHaveBeenCalledTimes(2);

    rerender(<CheckoutReturnStatus pending={pending} settled fromCheckout={false} elapsedMs={6000} />);
    expect(screen.getByRole("status")).toHaveTextContent("Your plan is active.");
    expect(document.cookie).not.toContain("ppp_checkout_pending=success");
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("stops refreshing and says so when setup is slow", () => {
    render(<CheckoutReturnStatus pending={pending} settled={false} fromCheckout={false} elapsedMs={110_000} />);
    act(() => { vi.advanceTimersByTime(12_000); });

    expect(screen.getByRole("status")).toHaveTextContent(/taking longer than usual/i);
    const refreshes = router.refresh.mock.calls.length;
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(router.refresh).toHaveBeenCalledTimes(refreshes);
  });

  it("shows the slow message straight away for an old pending return", () => {
    render(<CheckoutReturnStatus pending={{ status: "lifetime-pending", startedAt: pending.startedAt }} settled={false} fromCheckout={false} elapsedMs={10 * 60_000} />);
    expect(screen.getByRole("status")).toHaveTextContent(/still finishing setup/i);
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
