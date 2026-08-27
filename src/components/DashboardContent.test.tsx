import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardContent } from "@/components/DashboardContent";

describe("DashboardContent", () => {
  it("puts included banks first and links account tools for signed-in students", () => {
    const { container } = render(<DashboardContent authenticated accessibleBanks={["ib-ai-hl"]} />);

    expect(screen.getByRole("heading", { name: /your question banks/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my account/i })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: /password settings/i })).toHaveAttribute("href", "/account/password");
    expect(screen.getByRole("link", { name: /manage plan/i })).toHaveAttribute("href", "/pricing");
    expect(container.querySelector(".dashboard-bank-card")?.textContent).toContain("IB Math AI HL");
    expect(screen.getByRole("link", { name: /open ib math ai hl/i })).toHaveAttribute("href", "/banks/ib-ai-hl");
  });

  it("sends free visitors straight to free questions and keeps upgrade discovery visible", () => {
    render(<DashboardContent authenticated={false} accessibleBanks={[]} />);

    expect(screen.getByRole("link", { name: /start free.*igcse 0580/i })).toHaveAttribute("href", "/banks/igcse?free=1");
    expect(screen.getByRole("link", { name: /view plans/i })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?next=/dashboard");
  });
});
