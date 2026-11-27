import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaleCountdown } from "@/components/SaleCountdown";

describe("SaleCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-annual-sale");
  });

  it("counts down and clears the sale flag when it reaches zero", () => {
    vi.useFakeTimers();
    const endsAt = Date.parse("2026-12-02T00:00:00Z");
    vi.setSystemTime(endsAt - 2_000);
    document.documentElement.setAttribute("data-annual-sale", "live");
    render(<SaleCountdown endsAt={endsAt} />);

    expect(screen.getByRole("timer").textContent).toContain("02");
    expect(document.documentElement.getAttribute("data-annual-sale")).toBe("live");
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(document.documentElement.hasAttribute("data-annual-sale")).toBe(false);
  });
});
