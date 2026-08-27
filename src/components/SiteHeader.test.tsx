import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";

const usePathname = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

beforeEach(() => usePathname.mockReturnValue("/dashboard"));

describe("SiteHeader", () => {
  it("keeps pricing discoverable once a user is signed in", () => {
    render(<SiteHeader authenticated />);

    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveClass("nav-pricing");
    expect(screen.getByRole("link", { name: "My account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /pastpaperprep home/i })).toHaveAttribute("href", "/dashboard");
  });

  it("keeps pricing available before sign-in", () => {
    render(<SiteHeader authenticated={false} />);
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveClass("nav-pricing");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=/pricing");
    expect(screen.getByRole("link", { name: /start practising/i })).toHaveAttribute("href", "/dashboard");
  });

  it("marks the current primary destination and uses a bank icon for the mobile dashboard action", () => {
    usePathname.mockReturnValue("/pricing");
    const { container } = render(<SiteHeader authenticated />);

    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My account" })).not.toHaveAttribute("aria-current");
    expect(container.querySelector(".nav-cta svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("title", "Open question banks");
  });
});
