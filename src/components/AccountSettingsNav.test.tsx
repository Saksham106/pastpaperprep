import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/account";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { AccountSettingsNav } from "@/components/AccountSettingsNav";

describe("AccountSettingsNav", () => {
  it("offers four clear settings destinations and marks the current page", () => {
    pathname = "/account/subscription";
    render(<AccountSettingsNav />);
    const nav = screen.getByRole("navigation", { name: /account settings/i });
    expect(nav.querySelectorAll("a")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Subscription" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute("href", "/account/billing");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "/account/security");
  });

  it("keeps the security section active while changing a password", () => {
    pathname = "/account/password";
    render(<AccountSettingsNav />);
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("aria-current", "page");
  });
});
