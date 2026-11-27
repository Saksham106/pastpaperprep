import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));

import { CreditsLine, OutOfCredits } from "@/components/helper/PepperCredits";
import type { HelperCredits } from "@/lib/helper/credits";

const week = (planLeft: number, packLeft = 0): HelperCredits => ({ tier: "free", weekly: 150, planLeft, packLeft, resetsAt: "2026-11-30T00:00:00.000Z" });

describe("Pepper credits in the chat", () => {
  it("offers a quiet top-up link only when the week is running low", () => {
    const { rerender } = render(<CreditsLine credits={week(120)} />);
    expect(screen.queryByRole("link", { name: "Get more" })).not.toBeInTheDocument();
    rerender(<CreditsLine credits={week(30)} />);
    expect(screen.getByRole("link", { name: "Get more" })).toHaveAttribute("href", "/account#pepper-credits");
    rerender(<CreditsLine credits={week(30, 1000)} />);
    expect(screen.queryByRole("link", { name: "Get more" })).not.toBeInTheDocument();
  });

  it("links out-of-credit students to packs, and free accounts to plans", () => {
    render(<OutOfCredits credits={week(0)} surface="question" />);
    expect(screen.getByRole("link", { name: "Get more credits" })).toHaveAttribute("href", "/account#pepper-credits");
    expect(screen.getByRole("link", { name: "Upgrade" })).toHaveAttribute("href", "/pricing");
  });
});
