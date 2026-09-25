import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PricingPreviewPage from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
afterEach(() => vi.unstubAllEnvs());

describe("local-only subscriber pricing preview", () => {
  it("is inaccessible outside the development server", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(PricingPreviewPage({ searchParams: Promise.resolve({ view: "one-bank" }) })).rejects.toThrow("NOT_FOUND");
  });

  it("shows a read-only one-bank subscriber view in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    render(await PricingPreviewPage({ searchParams: Promise.resolve({ view: "one-bank" }) }));
    expect(screen.getByRole("link", { name: "Two separate banks" })).toHaveAttribute("href", "/pricing/preview?view=two-banks");
    expect(screen.getByRole("heading", { name: "Add another bank" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "One Bank" }).closest("article")).toHaveAttribute("data-current-plan", "true");
    expect(screen.queryByRole("button", { name: /Unlock/ })).not.toBeInTheDocument();
  });
});
