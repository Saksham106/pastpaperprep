import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComplimentaryAllAccess } from "@/components/ComplimentaryAllAccess";
import { hasComplimentaryAllAccess } from "@/lib/complimentary-access";

describe("complimentary All Access", () => {
  const activeGrant = { productId: "bundle_all", source: "manual", status: "active", startsAt: "2025-01-01T00:00:00Z", expiresAt: null } as const;

  it("requires a current manual All Access grant, not a paid or expired grant", () => {
    expect(hasComplimentaryAllAccess([activeGrant])).toBe(true);
    expect(hasComplimentaryAllAccess([{ ...activeGrant, source: "stripe" }])).toBe(false);
    expect(hasComplimentaryAllAccess([{ ...activeGrant, status: "revoked" }])).toBe(false);
    expect(hasComplimentaryAllAccess([{ ...activeGrant, expiresAt: "2025-02-01T00:00:00Z" }])).toBe(false);
    expect(hasComplimentaryAllAccess([{ ...activeGrant, productId: "bank_igcse" }])).toBe(false);
  });

  it("shows a welcome and all three familiar plan cards without a checkout or invented renewal", () => {
    render(<ComplimentaryAllAccess />);
    expect(screen.getByRole("heading", { name: /complimentary all access/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "One Bank" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build Your Plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Access" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse question banks/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button", { name: /checkout|buy|switch|cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\$0|billed monthly|renewal date/i)).not.toBeInTheDocument();
  });
});
