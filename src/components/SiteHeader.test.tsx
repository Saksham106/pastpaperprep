import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";

describe("SiteHeader", () => {
  it("removes the acquisition pricing link once a user is signed in", () => {
    render(<SiteHeader authenticated />);

    expect(screen.queryByRole("link", { name: "Pricing" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My account" })).toHaveAttribute("href", "/account");
  });

  it("keeps pricing available before sign-in", () => {
    render(<SiteHeader authenticated={false} />);
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=/pricing");
  });
});
