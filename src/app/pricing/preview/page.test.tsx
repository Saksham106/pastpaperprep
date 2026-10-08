import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PricingPreviewPage from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
afterEach(() => vi.unstubAllEnvs());

describe("local-only subscriber pricing preview", () => {
  it("is inaccessible outside the development server", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(PricingPreviewPage({ searchParams: Promise.resolve({ view: "one-bank" }) })).rejects.toThrow("NOT_FOUND");
  });

  it("previews free, stacked, lifetime, and complimentary states without connecting billing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    let preview = render(await PricingPreviewPage({ searchParams: Promise.resolve({ view: "free" }) }));
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(document.querySelectorAll(".pricing-option")).toHaveLength(3);
    preview.unmount();

    preview = render(await PricingPreviewPage({ searchParams: Promise.resolve({ view: "stacked" }) }));
    expect(screen.getByText(/separate subscriptions with separate charges and renewal dates/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".account-current-access-summary")).toHaveLength(2);
    expect(screen.getByText("Example only — these separate subscription prices and dates are illustrative. No billing account or change handlers are connected.")).toBeInTheDocument();
    preview.unmount();

    preview = render(await PricingPreviewPage({ searchParams: Promise.resolve({ view: "lifetime" }) }));
    expect(screen.getByRole("heading", { name: /lifetime full access/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lifetime access is active" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /unlock lifetime access/i })).not.toBeInTheDocument();
    preview.unmount();

    render(await PricingPreviewPage({ searchParams: Promise.resolve({ view: "all" }) }));
    expect(screen.getByText(/this is a grant, not a billed subscription/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".pricing-option")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /^Annual/ }));
    expect(document.querySelectorAll(".pricing-option")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /unlock lifetime access/i })).not.toBeInTheDocument();
  });

  it("shows a read-only one-bank subscriber view in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    render(await PricingPreviewPage({ searchParams: Promise.resolve({ view: "one-bank" }) }));
    expect(screen.getByRole("link", { name: "Two-bank subscription" })).toHaveAttribute("href", "/pricing/preview?view=two-banks");
    expect(screen.queryByRole("heading", { name: "Add another bank" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "One Bank" }).some((heading) => heading.closest("article")?.getAttribute("data-current-plan") === "true")).toBe(true);
    expect(screen.getByRole("button", { name: "Your bank" })).toBeDisabled();
    expect(document.querySelector(".pricing-preview-notice")?.textContent).toMatch(/example only — price and renewal date are illustrative/i);
    expect(screen.getByText("No checkout or account changes in this preview.")).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: "Billing period" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Annual/ }));
    expect(screen.getByRole("button", { name: /^Annual/ })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".account-plan-editor [data-current-plan=true] .plan-price strong")?.textContent).toBe("$4");
    const nav = screen.getByRole("navigation", { name: "Subscriber views" });
    expect(document.querySelector(".pricing-page")!.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows an explicitly illustrative quote sample in the read-only subscriber preview", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(await PricingPreviewPage({ searchParams: Promise.resolve({ view: "one-bank" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to Build Your Plan" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IB Math AA HL" }));
    fireEvent.click(screen.getByRole("button", { name: "See example quote" }));
    expect(screen.getByRole("heading", { name: "Example plan-change quote" })).toBeInTheDocument();
    expect(screen.getByText(/not a Stripe quote or verified bill/i)).toBeInTheDocument();
    expect(screen.getByText(/due today: not available in this preview/i)).toBeInTheDocument();
    expect(screen.getByText(/credit: not available in this preview/i)).toBeInTheDocument();
    expect(screen.getByText(/new standard rate: \$10\.00 \/ month/i)).toBeInTheDocument();
    expect(screen.getByText(/effective date: jun 30, 2027 \(illustrative fixture\)/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
