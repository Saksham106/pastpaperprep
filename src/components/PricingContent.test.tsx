import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";
import { getCatalogBillingBanks, getCatalogRuntimeBanks, catalogBankToRuntimeBank } from "@/lib/catalog";

const availableBanks = getCatalogRuntimeBanks();
const cambridgeBankCount = availableBanks.filter((bank) => bank.qualification === "Cambridge IGCSE").length;
const ibBankCount = availableBanks.filter((bank) => bank.qualification === "International Baccalaureate").length;

describe("approved custom-bank pricing", () => {
  it("shows all three plans to an all-access customer and highlights only All Access", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess currentPlanNames={["All Access"]} currentPlanProductIds={["bundle_all"]} ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(container.querySelectorAll(".pricing-decision-grid > .pricing-option")).toHaveLength(3);
    const all = screen.getByRole("heading", { name: "All Access" }).closest("article")!;
    expect(all).toHaveAttribute("data-current-plan", "true");
    expect(within(all).getByText("Your access")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-current-plan="true"]')).toHaveLength(1);
    expect(screen.getByText(/all available banks are included/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unlock/ })).not.toBeInTheDocument();
  });

  it("shows One Bank as current for a one-bank customer without allowing repurchase", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    const one = screen.getByRole("heading", { name: "One Bank" }).closest("article")!;
    expect(screen.getByRole("heading", { name: "Your current access" })).toBeInTheDocument();
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")!;
    const all = screen.getByRole("heading", { name: "All Access" }).closest("article")!;
    expect(screen.queryByRole("heading", { name: "Add another bank" })).not.toBeInTheDocument();
    expect(one).toHaveAttribute("data-current-plan", "true");
    expect(within(one).getByRole("radio", { name: "IB Math AA HL" })).toBeInTheDocument();
    expect(within(one).queryByRole("radio", { name: "IB Math AA SL" })).not.toBeInTheDocument();
    expect(within(builder).getByRole("checkbox", { name: "IB Math AA HL" })).toBeInTheDocument();
    expect(within(builder).queryByRole("checkbox", { name: "IB Math AA SL" })).not.toBeInTheDocument();
    expect(within(all).getByRole("checkbox", { name: /existing subscriptions keep renewing/i })).toBeInTheDocument();
    expect(within(all).queryByRole("button", { name: /all access/i })).not.toBeInTheDocument();
    expect(container.querySelectorAll(".pricing-decision-grid > .pricing-option")).toHaveLength(3);
    expect(within(one).getByText(/Standard price for a new subscription/i)).toBeInTheDocument();
  });

  it("does not mislabel two separately purchased banks as a discounted builder bundle", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["bank_ib_sl", "bank_ib_hl"]} ownedBankIds={["ib-sl", "ib-hl"]} availableBanks={availableBanks} />);
    expect(screen.getByRole("heading", { name: "One Bank" }).closest("article")).toHaveAttribute("data-current-plan", "true");
    expect(screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")).not.toHaveAttribute("data-current-plan");
    expect(container.querySelectorAll('[data-current-plan="true"]')).toHaveLength(1);
    expect(screen.getByText("Your subscriptions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your current access" })).toBeInTheDocument();
  });

  it("highlights a real custom bundle and never implies it is the single-bank plan", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["bundle_custom"]} ownedBankIds={["ib-sl", "ib-hl"]} availableBanks={availableBanks} />);
    expect(screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")).toHaveAttribute("data-current-plan", "true");
    expect(screen.getByRole("heading", { name: "One Bank" }).closest("article")).not.toHaveAttribute("data-current-plan");
  });

  it("marks a complimentary all-access grant as access, not a paid Stripe subscription", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanNames={["All Access"]} currentPlanProductIds={["bundle_all"]} complimentaryAccess ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(screen.getByText("Complimentary access")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your current access" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Access" }).closest("article")).toHaveAttribute("data-current-plan", "true");
    expect(screen.getByText("Included with your complimentary access.")).toBeInTheDocument();
    expect(screen.queryByText(/your existing rate stays unchanged/i)).not.toBeInTheDocument();
  });

  it("prices a separately selected two-bank add-on inside Build Your Plan without relabeling existing access", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")!;
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AA HL" }));
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AI HL" }));
    expect(within(builder).getByText("$10")).toBeInTheDocument();
    expect(within(builder).getByText("New plan: billed $10 monthly.")).toBeInTheDocument();
    expect(within(builder).queryByRole("button", { name: "Add 2 banks" })).not.toBeInTheDocument();
    fireEvent.click(within(builder).getByRole("checkbox", { name: /existing subscriptions keep renewing/i }));
    expect(within(builder).getByRole("button", { name: "Add 2 banks" })).toBeInTheDocument();
    expect(within(builder).getByText(/no credit for banks you already own/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "One Bank" }).closest("article")).toHaveAttribute("data-current-plan", "true");
  });

  it("requires explicit acknowledgment before offering a second All Access subscription", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    const card = screen.getByRole("heading", { name: "All Access" }).closest("article")!;
    expect(within(card).queryByRole("button", { name: /Add All Access subscription/i })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("checkbox", { name: /existing subscriptions keep renewing/i }));
    expect(within(card).getByRole("button", { name: /Add All Access subscription/i })).toBeInTheDocument();
  });

  it("keeps the no-purchase state for complimentary All Access in every card", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess complimentaryAccess currentPlanProductIds={["bundle_all"]} ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(container.querySelectorAll(".pricing-option")).toHaveLength(3);
    expect(container.querySelectorAll(".pricing-option input, .pricing-option button, .pricing-option a")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "All Access" }).closest("article")).toHaveAttribute("data-current-plan", "true");
  });

  it("keeps local preview entirely read-only even after choosing an add-on", () => {
    render(<PricingContent authenticated hasPaidAccess previewOnly currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    expect(screen.getByText(/local preview.*no account or checkout/i)).toBeInTheDocument();
    const picker = screen.getByRole("heading", { name: "One Bank" }).closest("article")!;
    fireEvent.click(within(picker).getByRole("radio", { name: "IB Math AA HL" }));
    expect(within(picker).getByRole("button", { name: /Unlock IB Math AA HL/i })).toBeDisabled();
    expect(within(picker).getByText(/Preview only.*checkout is disabled/i)).toBeInTheDocument();
    expect(within(picker).queryByRole("link", { name: /Unlock/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")!;
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AA HL" }));
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AI HL" }));
    expect(within(builder).getByRole("button", { name: /Add 2 banks/i })).toBeDisabled();
    const all = screen.getByRole("heading", { name: "All Access" }).closest("article")!;
    expect(within(all).getByRole("button", { name: /Add All Access subscription/i })).toBeDisabled();
  });

  it("lets paid members buy only unowned banks as separately priced subscriptions", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanNames={["One Bank"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    expect(screen.queryByRole("heading", { name: "Add another bank" })).not.toBeInTheDocument();
    const picker = screen.getByRole("heading", { name: "One Bank" }).closest("article")!;
    expect(within(picker).queryByLabelText(/Mathematics AA SL/i)).not.toBeInTheDocument();
    const choice = within(picker).getAllByRole("radio")[0];
    fireEvent.click(choice);
    expect(within(picker).getByRole("button", { name: /Unlock/ })).toBeInTheDocument();
    expect(within(picker).queryByRole("button", { name: /all banks/i })).not.toBeInTheDocument();
  });

  it("offers IB Economics only once its production asset and sale gates are enabled", () => {
    const enabled = { NODE_ENV: "production", PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true", PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true" };
    const banks = getCatalogBillingBanks(enabled).map(catalogBankToRuntimeBank);
    expect(banks.some((bank) => bank.slug === "ib-economics-hl")).toBe(true);
    render(<PricingContent authenticated hasPaidAccess ownedBankIds={["ib-sl"]} availableBanks={banks} />);
    const picker = screen.getByRole("heading", { name: "One Bank" }).closest("article")!;
    expect(within(picker).getByLabelText(/Economics HL/i)).toBeInTheDocument();
    expect(within(picker).getByLabelText(/Economics SL/i)).toBeInTheDocument();
  });

  it("does not offer an add-on when every billable bank is already included", () => {
    render(<PricingContent authenticated hasPaidAccess ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(screen.getByText(/all available banks are included/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unlock/ })).not.toBeInTheDocument();
  });

  it("shows three distinct plans without silently choosing any bank", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const cards = container.querySelectorAll(".pricing-option");

    expect(screen.getByRole("heading", { name: "One Bank" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build Your Plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Access" })).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText("$6")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("$10")).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText("$25")).toBeInTheDocument();
    expect(cards[0]).toHaveAttribute("data-plan-tone", "starter");
    expect(cards[1]).toHaveAttribute("data-plan-tone", "builder");
    expect(cards[2]).toHaveAttribute("data-plan-tone", "premium");
    expect(container.querySelectorAll(".plan-art")).toHaveLength(3);
    expect(new Set([...container.querySelectorAll<HTMLImageElement>(".plan-art")].map((image) => image.getAttribute("src"))).size).toBe(3);
    expect(container.querySelectorAll(".plan-icon[aria-hidden=\"true\"]")).toHaveLength(3);
    expect(container.querySelectorAll(".plan-feature-list")).toHaveLength(0);
    expect(within(cards[0] as HTMLElement).getByText("Focus on one syllabus.")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("Mix the banks you actually take.")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("2 to 5 banks")).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText("Everything, including future banks.")).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).queryByRole("link", { name: "Choose One Bank" })).not.toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).queryByRole("link", { name: /Continue with/ })).not.toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByRole("link", { name: "Unlock all banks" })).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText("Select one bank to continue.")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("Select at least two banks to continue.")).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
    expect(screen.getAllByRole("checkbox")).toHaveLength(availableBanks.length);
    expect(screen.getAllByText(/Secure Stripe checkout · Cancel any time/)).toHaveLength(3);
    expect(screen.getByText(/Existing subscribers remain grandfathered at their current price and access\./)).toBeInTheDocument();
  });

  it("updates the builder total only after the two-bank minimum is met", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article");
    expect(builder).not.toBeNull();
    const checkboxes = within(builder!).getAllByRole("checkbox");
    expect(within(builder!).getByText("None selected")).toBeInTheDocument();
    expect(within(builder!).queryByRole("button", { name: /Continue with/ })).not.toBeInTheDocument();

    fireEvent.click(checkboxes[0]);

    expect(within(builder!).getByText("1 selected")).toBeInTheDocument();
    expect(within(builder!).getByText("Select one more bank to continue.")).toBeInTheDocument();
    expect(within(builder!).queryByRole("button", { name: /Continue with/ })).not.toBeInTheDocument();

    fireEvent.click(checkboxes[1]);

    expect(within(builder!).getByText("2 selected")).toBeInTheDocument();
    expect(within(builder!).getByRole("button", { name: "Continue with 2 banks" })).toBeInTheDocument();
    expect(builder!.querySelector(".plan-price strong")).toHaveTextContent("$10");
  });

  it("updates the builder checkout CTA after two explicit selections", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const checkboxes = within(builder).getAllByRole("checkbox");

    expect(within(builder).queryByRole("link", { name: /Continue with/ })).not.toBeInTheDocument();
    fireEvent.click(checkboxes[0]);
    expect(within(builder).queryByRole("link", { name: /Continue with/ })).not.toBeInTheDocument();
    fireEvent.click(checkboxes[1]);
    expect(within(builder).getByRole("link", { name: "Continue with 2 banks" })).toBeInTheDocument();
  });

  it("keeps the builder headline at its true minimum until two banks are selected", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const headlinePrice = () => builder.querySelector(".plan-price strong")?.textContent;
    const checkboxes = within(builder).getAllByRole("checkbox");

    expect(headlinePrice()).toBe("$10");
    fireEvent.click(checkboxes[0]);
    expect(headlinePrice()).toBe("$10");
    fireEvent.click(checkboxes[1]);
    expect(headlinePrice()).toBe("$10");
    fireEvent.click(checkboxes[2]);
    expect(headlinePrice()).toBe("$14");
    fireEvent.click(checkboxes[3]);
    expect(headlinePrice()).toBe("$18");
    fireEvent.click(checkboxes[4]);
    expect(headlinePrice()).toBe("$22");
  });

  it("shows exact annual effective monthly headline prices for the selected bundle", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} initialInterval="annual" />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const headlinePrice = () => builder.querySelector(".plan-price strong")?.textContent;
    const checkboxes = within(builder).getAllByRole("checkbox");

    expect(headlinePrice()).toBe("$7");
    checkboxes.slice(0, 5).forEach((checkbox) => fireEvent.click(checkbox));
    expect(headlinePrice()).toBe("$16");
  });

  it("shows the two-bank starting price while the builder selection is empty", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} initialBankIds={[]} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;

    expect(builder.querySelector(".plan-price strong")).toHaveTextContent("$10");
    expect(within(builder).getByText("Two-bank minimum. Select banks to see your exact price.")).toBeInTheDocument();
  });

  it("organizes every bank choice into compact, discoverable subject groups", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const groups = builder.querySelectorAll(".custom-bank-group");

    expect(groups).toHaveLength(3);
    expect(within(builder).getByText("Cambridge")).toBeInTheDocument();
    expect(within(builder).getByText("IB Mathematics")).toBeInTheDocument();
    expect(within(builder).getByText("IB Sciences")).toBeInTheDocument();
    expect(builder.querySelectorAll("[data-bank-id]")).toHaveLength(availableBanks.length);
    expect(container.querySelectorAll("[data-pricing-bank]")).toHaveLength(availableBanks.length);
  });

  it("keeps the grouped picker collapsed until the student chooses to edit it", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const disclosure = builder.querySelector(".custom-bank-disclosure") as HTMLDetailsElement;

    expect(disclosure).not.toHaveAttribute("open");
    expect(within(disclosure).getByText("Choose your banks")).toBeInTheDocument();
    expect(within(disclosure).getByText("None selected")).toBeInTheDocument();
  });

  it("shows annual starting prices and exact yearly totals after selection", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const checkboxes = within(builder).getAllByRole("checkbox");

    expect(screen.getAllByText("$4")).toHaveLength(1);
    expect(within(builder).getByText("$7")).toBeInTheDocument();
    expect(screen.getByText("$18")).toBeInTheDocument();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(within(builder).getByText(/Billed \$84 once a year\. Save 30%/)).toBeInTheDocument();
    expect(screen.getAllByText(/Billed/).map((node) => node.textContent).some((text) => text?.includes("$216 once a year"))).toBe(true);
  });

  it("keeps Build Your Plan checkout closed below two banks", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const checkbox = within(builder).getAllByRole("checkbox")[0];

    expect(within(builder).getByText("Select at least two banks to continue.")).toBeInTheDocument();
    expect(within(builder).queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();

    fireEvent.click(checkbox);

    expect(within(builder).getByText("Select one more bank to continue.")).toBeInTheDocument();
    expect(within(builder).queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();
  });

  it("keeps the popular plan first on mobile and all three cards in one grid", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-decision-grid")).not.toBeNull();
    expect(container.querySelectorAll(".pricing-decision-grid > .pricing-option")).toHaveLength(3);
    expect(container.querySelector(".pricing-option-popular")).toHaveAttribute("data-mobile-order", "first");
  });

  it("places concise product coverage below the pricing cards without repeating the free-years message", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const plans = container.querySelector(".pricing-decision-grid") as HTMLElement;
    const proof = container.querySelector(".pricing-product-proof") as HTMLElement;

    expect(proof).not.toBeNull();
    expect(plans.compareDocumentPosition(proof) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(proof).getByText(/questions/)).toBeInTheDocument();
    expect(within(proof).getByText(/papers/)).toBeInTheDocument();
    expect(within(proof).getByText(/available banks/)).toBeInTheDocument();
    expect(within(proof).queryByText(/older exam years/i)).not.toBeInTheDocument();
  });

  it("offers checkout continuations only after explicit valid bank choices", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const oneBank = screen.getByRole("heading", { name: "One Bank" }).closest("article") as HTMLElement;
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;

    expect(within(oneBank).queryByRole("link", { name: "Choose One Bank" })).not.toBeInTheDocument();
    expect(within(builder).queryByRole("link", { name: /Continue with/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unlock all banks" })).toBeInTheDocument();

    fireEvent.click(within(oneBank).getByRole("radio", { name: "IB Math AI HL" }));
    expect(within(oneBank).getByRole("link", { name: "Unlock IB Math AI HL" })).toBeInTheDocument();

    const checkboxes = within(builder).getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(within(builder).getByRole("link", { name: "Continue with 2 banks" })).toBeInTheDocument();
  });

  it("restores a visitor's selected bank after sign-in", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" initialProductId="bank_ib_ai_hl" />);
    expect(screen.getByRole("radio", { name: "IB Math AI HL" })).toBeChecked();
    expect(screen.getByRole("button", { name: /annual.*save up to 33%/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/2 months free/i)).not.toBeInTheDocument();
  });

  it("keeps One Bank to exactly one selected canonical bank", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialBankIds={["ib-sl", "igcse"]} />);
    const oneBank = screen.getByRole("heading", { name: "One Bank" }).closest("article");
    expect(within(oneBank!).getAllByRole("radio", { checked: true })).toHaveLength(1);
    expect(within(oneBank!).getByRole("radio", { name: "IB Math AA SL" })).toBeChecked();
  });

  it("keeps free access compact and switches the coverage comparison by qualification", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-free-strip")).not.toBeNull();

    const cambridgeTab = screen.getByRole("tab", { name: "Cambridge IGCSE" });
    const ibTab = screen.getByRole("tab", { name: "IB Diploma" });
    expect(cambridgeTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("table", { name: "Question bank coverage" })).toBeVisible();
    expect(within(screen.getByRole("table", { name: "Question bank coverage" })).getAllByRole("row")).toHaveLength(cambridgeBankCount + 1);

    fireEvent.click(ibTab);
    expect(ibTab).toHaveAttribute("aria-selected", "true");
    expect(cambridgeTab).toHaveAttribute("aria-selected", "false");
    expect(within(screen.getByRole("table", { name: "Question bank coverage" })).getAllByRole("row")).toHaveLength(ibBankCount + 1);
    expect(container.querySelectorAll("[data-pricing-bank]")).toHaveLength(availableBanks.length);
  });
});
