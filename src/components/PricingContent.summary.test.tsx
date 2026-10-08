import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PricingContent } from "@/components/PricingContent";
import { CurrentSubscriptionSummary } from "@/components/AccountBillingDetails";
import { getCatalogRuntimeBanks } from "@/lib/catalog";
const banks = getCatalogRuntimeBanks();
afterEach(() => vi.unstubAllGlobals());
describe("single subscriber summary on pricing", () => {
  it("labels scheduled cancellation as an access end, not another renewal", () => {
    render(<CurrentSubscriptionSummary billingManagement="enabled" subscription={{ status: "active", cancelAtPeriodEnd: true, bankSelection: { kind: "all" } }} item={{ id: "si_fixture", quantity: 1, recurringSubtotalCents: 2500, price: { currency: "usd", interval: "month", intervalCount: 1 }, currentPeriodEnd: "2027-06-30T00:00:00Z" }} />);
    expect(screen.getByText("Ending")).toBeInTheDocument();
    expect(screen.getByText("Access until Jun 30, 2027")).toBeInTheDocument();
    expect(screen.queryByText(/Renews/)).not.toBeInTheDocument();
  });
  it("keeps an unavailable price honest instead of showing a free plan", () => {
    render(<CurrentSubscriptionSummary billingManagement="enabled" subscription={{ status: "active", cancelAtPeriodEnd: false, bankSelection: { kind: "unknown" } }} item={null} />);
    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
    expect(screen.getByText("Bank details unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });
  it("keeps one verified summary with the actual charge, banks, renewal date and billing link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ subscriptions: [{ id: "sub_fixture", status: "active", cancelAtPeriodEnd: false, cancelAt: null, bankSelection: { kind: "selected", banks: [{ slug: "igcse", name: "Mathematics 0580" }] }, items: [{ id: "si_fixture", quantity: 1, recurringSubtotalCents: 499, price: { id: "price_fixture", currency: "usd", interval: "month", intervalCount: 1 }, currentPeriodEnd: "2027-06-30T00:00:00Z" }] }], invoices: [], paymentMethod: null, management: { editable: true }, bankOptions: banks.map(b => ({ slug: b.slug, name: b.shortName })) }) }));
    const { container } = render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["bank_igcse"]} ownedBankIds={["igcse"]} availableBanks={banks} />);
    await screen.findByRole("heading", { name: "Choose your plan" });
    expect(screen.getAllByText("Your plan")).toHaveLength(1);
    expect(container.querySelectorAll(".account-current-access-summary")).toHaveLength(1);
    expect(container.querySelector(".pricing-current-plan")).toBeNull();
    expect(container.querySelector(".account-plan-summary-price")).toHaveTextContent("$4.99 / mo");
    expect(screen.getByText(/Renews Jun 30, 2027/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Manage billing" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Manage billing" })).toHaveAttribute("href", "/account/billing");
    fireEvent.click(screen.getByRole("button", { name: /Annual/ }));
    expect(screen.getAllByText("Your plan")).toHaveLength(1);
    expect(container.querySelector(".account-plan-summary-price")).toHaveTextContent("$4.99 / mo");
  });
  it("uses the same single summary in the local example without enabling billing", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess previewOnly currentPlanProductIds={["bank_igcse"]} ownedBankIds={["igcse"]} availableBanks={banks} />);
    expect(screen.getAllByText("Your plan")).toHaveLength(1);
    expect(container.querySelectorAll(".account-current-access-summary")).toHaveLength(1);
    expect(container.querySelector(".pricing-current-plan")).toBeNull();
    expect(screen.getByText("Manage billing")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name: "Manage billing" })).not.toBeInTheDocument();
  });
});
