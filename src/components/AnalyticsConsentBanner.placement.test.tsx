import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsConsentBanner } from "./AnalyticsConsentBanner";

describe("non-obstructing consent notice", () => {
  it("makes a footer-reopened notice reachable without overlaying the page", () => {
    render(<AnalyticsConsentBanner focusOnOpen onChoice={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Close cookie banner" })).toHaveFocus();
  });
  it("does not steal keyboard focus on a first visit", () => {
    render(<><input aria-label="Practice search" autoFocus /><AnalyticsConsentBanner onChoice={vi.fn()} onDismiss={vi.fn()} /></>);
    expect(screen.getByRole("textbox", { name: "Practice search" })).toHaveFocus();
  });
  it("uses normal document flow instead of covering plan actions", () => {
    const css = readFileSync(resolve("src/components/AnalyticsConsentBanner.module.css"), "utf8");
    expect(css.match(/\.banner\s*\{([^}]+)/)?.[1]).toMatch(/position:\s*relative/);
    expect(css.match(/\.banner\s*\{([^}]+)/)?.[1]).not.toMatch(/position:\s*fixed/);
  });
  it("places the notice after the header and before main content", () => {
    const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
    expect(layout.indexOf("<SiteTelemetry />")).toBeGreaterThan(layout.indexOf("<SessionAwareSiteHeader />"));
    expect(layout.indexOf("<SiteTelemetry />")).toBeLessThan(layout.indexOf("<main>"));
  });
  it("retains permission and account-linkage disclosure without a large floating panel", () => {
    const onChoice = vi.fn();
    render(<AnalyticsConsentBanner onChoice={onChoice} onDismiss={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Optional analytics" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Allow analytics" })).toBeVisible();
    expect(screen.getByText(/with your permission/i)).toHaveTextContent(/email/i);
    expect(onChoice).not.toHaveBeenCalled();
  });
});
