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
  it("links the free past-paper library only when it is switched on", () => {
    const view = render(<SiteHeader authenticated={false} />);
    expect(screen.queryByRole("link", { name: "Past papers" })).not.toBeInTheDocument();
    view.rerender(<SiteHeader authenticated={false} pastPapers />);
    expect(screen.getByRole("link", { name: "Past papers" })).toHaveAttribute("href", "/past-papers");
    usePathname.mockReturnValue("/past-papers/igcse-maths-0580");
    view.rerender(<SiteHeader authenticated pastPapers />);
    expect(screen.getByRole("link", { name: "Past papers" })).toHaveAttribute("aria-current", "page");
  });

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

  it("opens and closes the phone menu from one button", () => {
    usePathname.mockReturnValue("/");
    const { container } = render(<SiteHeader authenticated={false} />);
    const toggle = screen.getByRole("button", { name: /open menu/i });
    const nav = container.querySelector("#site-menu");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "site-menu");
    expect(nav).toHaveAttribute("data-open", "false");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /close menu/i })).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveAttribute("data-open", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(nav).toHaveAttribute("data-open", "false");

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("link", { name: "Pricing" }));
    expect(nav).toHaveAttribute("data-open", "false");
  });

  it("gives the menu button a 44px target and animates the panel only when motion is allowed", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.menu-toggle \{[^}]*width: 44px; height: 44px;/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^{]*\{[^}]*\.site-menu/);
  });

  it("stays glassy after scrolling instead of turning solid", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const scrolled = css.match(/\.site-header\.is-scrolled::before[^{]*\{([^}]*)\}/)?.[1] ?? "";
    expect(scrolled).toContain("var(--header-overlay)");
    expect(scrolled).toMatch(/backdrop-filter: blur\(\d+px\)/);
  });

  it("puts the question-banks shortcut in the phone bar and the theme switch inside the menu", () => {
    const { container } = render(<SiteHeader authenticated={false} />);
    const quick = screen.getByRole("link", { name: "Open question banks" });
    expect(quick).toHaveAttribute("href", "/dashboard");
    expect(quick).toHaveClass("nav-quick");
    expect(quick.closest("#site-menu")).toBeNull();
    const theme = screen.getByRole("button", { name: /switch to dark theme/i });
    expect(theme.closest("#site-menu")).toBe(container.querySelector("#site-menu"));
  });

  it("shows the shortcut only on phones and makes the open menu glassy", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.nav-quick \{[^}]*display: none/);
    const phone = css.slice(css.lastIndexOf("@media (max-width: 760px)"));
    expect(phone).toMatch(/\.nav-quick \{[^}]*display: inline-flex/);
    expect(phone).toMatch(/\.site-header \.site-menu \{[^}]*backdrop-filter: blur\(\d+px\)/);
  });

  it("writes only the standard backdrop-filter so the build keeps it for Chrome", () => {
    // With both spellings in one rule the CSS pipeline kept only -webkit-backdrop-filter,
    // which Chrome ignores: the header had no blur outside Safari.
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).not.toContain("-webkit-backdrop-filter");
  });
});
