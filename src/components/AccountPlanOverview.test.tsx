import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountPlanOverview } from "@/components/AccountPlanOverview";

describe("AccountPlanOverview", () => {
  it("makes the free plan and upgrade path obvious", () => {
    render(<AccountPlanOverview />);

    expect(screen.getByRole("heading", { name: "Free plan" })).toBeInTheDocument();
    expect(screen.getByText("Complete older exam years")).toBeInTheDocument();
    expect(screen.getByText("Every available question")).toBeInTheDocument();
    expect(screen.getByText("PDF export")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upgrade your plan" })).toHaveAttribute("href", "/pricing");
  });
});
