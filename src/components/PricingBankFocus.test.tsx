import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";
import { getCatalogRuntimeBanks } from "@/lib/catalog";

const availableBanks = getCatalogRuntimeBanks();
const focus = () => screen.getByRole("region", { name: "Unlock every Mathematics 0580 paper" });

describe("pricing for someone who came from a bank's upgrade prompt", () => {
  it("leads with their bank, keeps every plan below and offers another subject", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialProductId="bank_igcse" availableBanks={availableBanks} />);
    const panel = focus();
    expect(within(panel).getByText("A plan opens 2019–2026, including 2026’s papers.")).toBeInTheDocument();
    expect(within(panel).getByText("Cambridge IGCSE · Mathematics 0580")).toBeInTheDocument();
    expect(panel.querySelector(".plan-price")).toHaveTextContent(/^\$6\s*\/ month$/);
    expect(within(within(panel).getByRole("list", { name: "Mathematics 0580 plan includes" })).getAllByRole("listitem")[0]).toHaveTextContent("All 3,967 questions, 2016–2026");
    expect([...panel.querySelectorAll(".upgrade-years li.is-paid")].map((chip) => chip.firstChild?.textContent)).toEqual(["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(within(panel).getByRole("link", { name: "Unlock Mathematics 0580" })).toHaveAttribute("href", `/login?next=${encodeURIComponent("/pricing?interval=monthly&product=bank_igcse")}`);
    expect(within(panel).getByText("Taking another subject too?")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "+ Additional Mathematics 0606" })).toHaveAttribute("href", "/pricing?banks=igcse%2Cigcse-additional");
    expect(within(panel).getAllByRole("link", { name: /^\+ / }).length).toBeLessThanOrEqual(4);
    expect(within(panel).getByRole("link", { name: /^All \d+ banks · \$25\/mo$/ })).toHaveAttribute("href", "#plan-all");
    expect(screen.getByRole("heading", { name: "Or compare every plan" })).toBeInTheDocument();
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    expect(container.querySelector("#plan-all")).toHaveAttribute("data-plan-tone", "premium");
  });

  it("follows the billing period", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialProductId="bank_igcse" availableBanks={availableBanks} />);
    fireEvent.click(screen.getByRole("button", { name: /^Annual/ }));
    expect(focus().querySelector(".plan-price")).toHaveTextContent(/^\$4\s*\/ month$/);
    expect(within(focus()).getByText("Billed $48 once a year")).toBeInTheDocument();
    expect(within(focus()).getByRole("link", { name: "Unlock Mathematics 0580" })).toHaveAttribute("href", `/login?next=${encodeURIComponent("/pricing?interval=annual&product=bank_igcse")}`);
  });

  it("uses the regular checkout for signed-in visitors", () => {
    render(<PricingContent authenticated hasPaidAccess={false} initialProductId="bank_igcse" availableBanks={availableBanks} />);
    expect(within(focus()).getByRole("button", { name: "Unlock Mathematics 0580" })).toBeInTheDocument();
  });

  it("does not appear without a single-bank product or for subscribers", () => {
    const { unmount } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialProductId="bundle_all" availableBanks={availableBanks} />);
    expect(screen.queryByRole("heading", { name: "Or compare every plan" })).not.toBeInTheDocument();
    unmount();
    render(<PricingContent authenticated hasPaidAccess complimentaryAccess initialProductId="bank_igcse" availableBanks={availableBanks} />);
    expect(screen.queryByRole("region", { name: "Unlock every Mathematics 0580 paper" })).not.toBeInTheDocument();
  });

  it("keeps a subscriber's requested extra bank selected, minus banks they already own", () => {
    render(<PricingContent authenticated hasPaidAccess addOnIntent initialBankIds={["igcse", "ib-sl"]} ownedBankIds={["ib-sl"]} currentPlanProductIds={["bank_ib_sl"]} availableBanks={availableBanks} />);
    const builder = screen.getAllByRole("heading", { name: "Build Your Plan" }).map((heading) => heading.closest("article") as HTMLElement).find((card) => card.closest(".pricing-additional-offers"))!;
    const checked = within(builder).getAllByRole("checkbox").filter((box) => (box as HTMLInputElement).checked).map((box) => box.getAttribute("aria-label") ?? box.closest("label")?.textContent);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toMatch(/0580/);
  });
});
