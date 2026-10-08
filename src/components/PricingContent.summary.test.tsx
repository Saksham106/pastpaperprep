import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PricingContent } from "@/components/PricingContent";
import { getCatalogRuntimeBanks } from "@/lib/catalog";
const banks = getCatalogRuntimeBanks();
afterEach(() => vi.unstubAllGlobals());
describe("single subscriber summary on pricing", () => {
  it("keeps one verified summary with the actual charge, banks, renewal date and billing link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ subscriptions: [{ id: "sub_fixture", status: "active", cancelAtPeriodEnd: false, cancelAt: null, bankSelection: { kind: "selected", banks: [{ slug: "igcse", name: "Mathematics 0580" }] }, items: [{ id: "si_fixture", quantity: 1, recurringSubtotalCents: 499, price: { id: "price_fixture", currency: "usd", interval: "month", intervalCount: 1 }, currentPeriodEnd: "2027-06-30T00:00:00Z" }] }], invoices: [], paymentMethod: null, management: { editable: true }, bankOptions: banks.map(b => ({ slug: b.slug, name: b.shortName })) }) }));
    const { container } = render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["bank_igcse"]} ownedBankIds={["igcse"]} availableBanks={banks} />);
    await screen.findByRole("heading", { name: "Choose your plan" });
    expect(screen.getAllByText("Your current access")).toHaveLength(1);
    expect(container.querySelectorAll(".account-current-access-summary")).toHaveLength(1);
    expect(container.querySelector(".pricing-current-plan")).toBeNull();
    expect(screen.getByText(/\$4\.99 \/ month/)).toBeInTheDocument();
    expect(screen.getByText(/Current period ends Jun 30, 2027/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Manage billing" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Manage billing" })).toHaveAttribute("href", "/account/billing");
    fireEvent.click(screen.getByRole("button", { name: /Annual/ }));
    expect(screen.getAllByText("Your current access")).toHaveLength(1);
    expect(screen.getByText(/\$4\.99 \/ month/)).toBeInTheDocument();
  });
  it("uses the same single summary in the local example without enabling billing", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess previewOnly currentPlanProductIds={["bank_igcse"]} ownedBankIds={["igcse"]} availableBanks={banks} />);
    expect(screen.getAllByText("Your current access")).toHaveLength(1);
    expect(container.querySelectorAll(".account-current-access-summary")).toHaveLength(1);
    expect(container.querySelector(".pricing-current-plan")).toBeNull();
    expect(screen.getByText("Manage billing is disabled in this local example.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage billing" })).not.toBeInTheDocument();
  });
});
