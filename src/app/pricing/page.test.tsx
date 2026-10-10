import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("PricingPage", () => {
  it("shows three concise paid plans with monthly pricing first", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess={false} />);

    expect(screen.queryByRole("heading", { name: /pay only for what you study\./i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("$6").length).toBeGreaterThan(0);
    expect(screen.getByText("$25")).toBeInTheDocument();
    expect(screen.queryByText("Everything, including future banks.")).not.toBeInTheDocument();
    expect(screen.queryByText(/unlock every current bank/i)).not.toBeInTheDocument();
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
    expect(screen.getByText(/existing subscribers remain grandfathered at their current price and access/i)).toBeInTheDocument();

    const options = container.querySelectorAll(".pricing-option");
    expect(options).toHaveLength(3);
    expect(container.querySelector(".pricing-free-strip")).toBeInTheDocument();
  });

  it("keeps paid customers on pricing and loads their verified account editor", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanNames={["IB Mathematics AI"]} />);
    expect(screen.getByRole("region", { name: /change your current subscription/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your current access/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage billing/i })).toHaveAttribute("href", "/account/billing");
    expect(screen.getByRole("status")).toHaveTextContent(/loading subscription details/i);
    expect(screen.queryByRole("link", { name: /unlock all banks/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/compare public prices and additional banks/i)).not.toBeInTheDocument();
  });

  it("keeps ordinary subscriber pricing free of a separate subscription checkout", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanNames={["IB Mathematics AI"]} />);
    expect(screen.queryByRole("group", { name: /additional subscription/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/separate charge and renewal/i)).not.toBeInTheDocument();
  });

  it("shows separate-purchase language only for an explicit add-on deep link", () => {
    render(<PricingContent authenticated hasPaidAccess addOnIntent initialProductId="bank_ib_hl" ownedBankIds={["ib-sl"]} currentPlanNames={["IB Mathematics AI"]} />);
    expect(screen.getByText(/separate from your current plan and creates a separate charge and renewal/i)).toBeInTheDocument();
    expect(screen.getByText(/for an ordinary plan change, use the reviewed editor above/i)).toBeInTheDocument();
  });

  it("does not offer another lifetime purchase to a lifetime owner", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["lifetime_all_access"]} currentPlanNames={["Lifetime All Access"]} />);
    expect(screen.getByText("Lifetime access is active. Any separately billed subscription remains listed under Billing.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /change your current subscription/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lifetime" }));
    expect(screen.getByRole("button", { name: "Lifetime access is active" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /unlock lifetime access/i })).not.toBeInTheDocument();
  });

  it("shows complimentary access as a non-billed grant without ordinary plan actions", () => {
    render(<PricingContent authenticated hasPaidAccess complimentaryAccess />);
    expect(screen.getByRole("heading", { name: /your current access/i })).toBeInTheDocument();
    expect(screen.getByText(/grant, not a billed subscription/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /unlock all banks/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /change your current subscription/i })).not.toBeInTheDocument();
  });

  it("makes the free account and upgrade path explicit for signed-in users", () => {
    render(<PricingContent authenticated hasPaidAccess={false} currentPlanNames={[]} />);
    expect(screen.getByRole("heading", { name: /your current access/i })).toBeInTheDocument();
    expect(screen.getByText(/^Free$/)).toBeInTheDocument();
    expect(screen.getByText(/choose a plan below to unlock every available question/i)).toBeInTheDocument();
  });
});
