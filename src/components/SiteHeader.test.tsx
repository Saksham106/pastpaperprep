import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";

const usePathname = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

beforeEach(() => {
  usePathname.mockReturnValue("/dashboard");
  window.history.replaceState({}, "", "/");
});

describe("SiteHeader", () => {
  it("keeps pricing discoverable once a user is signed in", () => {
    render(<SiteHeader authenticated />);

    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Articles" })).toHaveAttribute("href", "/articles");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveClass("nav-pricing");
    expect(screen.getByRole("link", { name: "My account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /pastpaperprep home/i })).toHaveAttribute("href", "/dashboard");
  });

  it("keeps pricing available before sign-in", () => {
    render(<SiteHeader authenticated={false} />);
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Articles" })).toHaveAttribute("href", "/articles");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveClass("nav-pricing");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=/pricing");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveClass("nav-login");
    expect(screen.getByRole("link", { name: /start practising/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
  });

  it("marks the current primary destination and uses a bank icon for the mobile dashboard action", () => {
    usePathname.mockReturnValue("/pricing");
    const { container } = render(<SiteHeader authenticated />);

    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My account" })).not.toHaveAttribute("aria-current");
    expect(container.querySelector(".nav-cta svg")).toHaveAttribute("data-testid", "workspace-icon");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("title", "Open question banks");
  });

  it("scrolls to the landing-page banks and marks that section current", () => {
    usePathname.mockReturnValue("/");
    const section = document.createElement("section");
    section.id = "question-banks";
    section.scrollIntoView = vi.fn();
    document.body.append(section);
    render(<SiteHeader authenticated={false} />);

    const banks = screen.getByRole("link", { name: "Question banks" });
    fireEvent.click(banks);

    expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(banks).toHaveAttribute("aria-current", "page");
    section.remove();
  });

  it("marks login as the current destination", () => {
    usePathname.mockReturnValue("/login");
    render(<SiteHeader authenticated={false} />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("aria-current", "page");
  });

  it("marks articles as the current destination", () => {
    usePathname.mockReturnValue("/articles/how-to-use-maths-past-papers-effectively");
    render(<SiteHeader authenticated={false} />);

    expect(screen.getByRole("link", { name: "Articles" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the compact workspace action at least 44 by 44 pixels", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain(".nav-cta { width: 44px; height: 44px; min-height: 44px;");
  });
});
