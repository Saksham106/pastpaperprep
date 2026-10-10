import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";
import { getCatalogBillingBanks, getCatalogRuntimeBanks, catalogBankToRuntimeBank } from "@/lib/catalog";

const availableBanks = getCatalogRuntimeBanks();
const cambridgeBankCount = availableBanks.filter((bank) => bank.qualification === "Cambridge IGCSE").length;
const ibBankCount = availableBanks.filter((bank) => bank.qualification === "International Baccalaureate").length;

describe("approved custom-bank pricing", () => {
  it("shows partial manual-access cards read-only in both billing periods", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess manualAccess currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    expect(container.querySelectorAll(".pricing-option button")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /annual/i }));
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    expect(container.querySelectorAll(".pricing-option button")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    expect(container.querySelectorAll(".pricing-option button")).toHaveLength(0);
    expect(screen.getByText("Manual access")).toBeInTheDocument();
    expect(screen.queryByText("All available banks are already included.")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".pricing-plan-access-note")[2]).toHaveTextContent("Shown for comparison. Your grant covers only selected banks.");
  });

  it("shows read-only plan cards for complimentary all-access without purchase controls", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess complimentaryAccess currentPlanProductIds={["bundle_all"]} availableBanks={availableBanks} />);
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    expect(container.querySelectorAll(".pricing-decision-grid button")).toHaveLength(0);
    expect(screen.getAllByText(/included with your complimentary access/i).length).toBeGreaterThan(0);
  });

  it("shows covered plan cards without subscription editors for lifetime owners", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess currentPlanProductIds={["lifetime_all_access"]} availableBanks={availableBanks} />);
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    expect(container.querySelector(".pricing-account-plan-editor")).toBeNull();
    expect(container.querySelectorAll(".pricing-option button")).toHaveLength(0);
  });

  it("shows optional add-on offers only for an explicit request and keeps account management primary", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanNames={["One Bank"]} currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    expect(screen.getByRole("link", { name: "Manage billing" })).toHaveAttribute("href", "/account/billing");
    const comparison = container.querySelector<HTMLDetailsElement>("details.pricing-additional-offers");
    expect(comparison).not.toBeNull();
    expect(comparison).toHaveAttribute("open");
    expect(comparison).toHaveTextContent(/separate charge and renewal/i);
    expect(within(comparison!).getByRole("heading", { name: "Build Your Plan" })).toBeInTheDocument();
  });

  it("does not offer another plan to an existing all-access owner, even on an add-on link", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanNames={["All Access"]} currentPlanProductIds={["bundle_all"]} ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(container.querySelector("details.pricing-additional-offers")).toBeNull();
    expect(container.querySelectorAll(".pricing-option")).toHaveLength(0);
  });

  it("preserves first-purchase cards for signed-in free students", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess={false} availableBanks={availableBanks} />);
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    expect(container.querySelector("details.pricing-additional-offers")).toBeNull();
  });

  it("does not show redundant plans to an all-access customer", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess currentPlanNames={["All Access"]} currentPlanProductIds={["bundle_all"]} ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(screen.queryByRole("heading", { name: "Your current access" })).not.toBeInTheDocument();
    expect(container.querySelector("details.pricing-additional-offers")).toBeNull();
    expect(container.querySelectorAll(".pricing-option")).toHaveLength(0);
    expect(screen.queryByText("Not ready to pay?")).not.toBeInTheDocument();
    expect(container.querySelector(".pricing-current-plan")).toBeNull();
    expect(screen.queryByText("Pay only for what you study.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unlock/ })).not.toBeInTheDocument();
  });

  it("gives paid subscribers a direct My Account path before offering a separate purchase", () => {
    render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    expect(within(screen.getByRole("region", { name: "Change your current subscription" })).getByRole("link", { name: "Manage billing" })).toHaveAttribute("href", "/account/billing");
  });

  it("shows One Bank as current for a one-bank customer without allowing repurchase", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    const one = screen.getByRole("heading", { name: "One Bank" }).closest("article")!;
    expect(container.querySelector(".pricing-current-plan")).toBeNull();
    const builder = container.querySelector("details.pricing-additional-offers [data-plan-tone=builder]") as HTMLElement;
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
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl", "bank_ib_hl"]} ownedBankIds={["ib-sl", "ib-hl"]} availableBanks={availableBanks} />);
    expect(screen.getByRole("heading", { name: "One Bank" }).closest("article")).toHaveAttribute("data-current-plan", "true");
    expect(screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")).not.toHaveAttribute("data-current-plan");
    expect(container.querySelectorAll('[data-current-plan="true"]')).toHaveLength(1);
    expect(screen.getByText("Your subscriptions")).toBeInTheDocument();
    expect(container.querySelector(".pricing-current-plan")).toBeNull();
  });

  it("highlights a real custom bundle and never implies it is the single-bank plan", () => {
    render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bundle_custom"]} ownedBankIds={["ib-sl", "ib-hl"]} availableBanks={availableBanks} />);
    expect(screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")).toHaveAttribute("data-current-plan", "true");
    expect(screen.getByRole("heading", { name: "One Bank" }).closest("article")).not.toHaveAttribute("data-current-plan");
  });

  it("marks a complimentary all-access grant as access, not a paid Stripe subscription", () => {
    render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanNames={["All Access"]} currentPlanProductIds={["bundle_all"]} complimentaryAccess ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(screen.getByText("Complimentary access")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your current access" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your access" })).toHaveAttribute("href", "/account/subscription");
    expect(screen.queryByText(/your existing rate stays unchanged/i)).not.toBeInTheDocument();
  });

  it("prices a separately selected two-bank add-on inside Build Your Plan without relabeling existing access", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    const builder = container.querySelector("details.pricing-additional-offers [data-plan-tone=builder]") as HTMLElement;
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
    render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    const card = screen.getByRole("heading", { name: "All Access" }).closest("article")!;
    expect(within(card).queryByRole("button", { name: /Add All Access subscription/i })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("checkbox", { name: /existing subscriptions keep renewing/i }));
    expect(within(card).getByRole("button", { name: /Add All Access subscription/i })).toBeInTheDocument();
  });

  it("keeps the no-purchase state for complimentary All Access without extra cards", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess complimentaryAccess currentPlanProductIds={["bundle_all"]} ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(container.querySelector(".pricing-additional-offers")).toBeNull();
    expect(container.querySelectorAll(".pricing-option input, .pricing-option button, .pricing-option a")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "View your access" })).toHaveAttribute("href", "/account/subscription");
  });

  it("keeps local preview entirely read-only even after choosing an add-on", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent previewOnly currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    expect(screen.getByText(/local preview.*no account or checkout/i)).toBeInTheDocument();
    const picker = container.querySelector("details.pricing-additional-offers .pricing-option") as HTMLElement;
    fireEvent.click(within(picker).getByRole("radio", { name: "IB Math AA HL" }));
    expect(within(picker).getByRole("button", { name: /Unlock IB Math AA HL/i })).toBeDisabled();
    expect(within(picker).getByText(/Preview only.*checkout is disabled/i)).toBeInTheDocument();
    expect(within(picker).queryByRole("link", { name: /Unlock/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
    const builder = container.querySelector("details.pricing-additional-offers [data-plan-tone=builder]") as HTMLElement;
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AA HL" }));
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AI HL" }));
    expect(within(builder).getByRole("button", { name: /Add 2 banks/i })).toBeDisabled();
    const all = container.querySelector("details.pricing-additional-offers [data-plan-tone=premium]") as HTMLElement;
    expect(within(all).getByRole("button", { name: /Add All Access subscription/i })).toBeDisabled();
  });

  it("lets paid members buy only unowned banks as separately priced subscriptions", () => {
    render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanNames={["One Bank"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
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
    render(<PricingContent authenticated hasPaidAccess addOnIntent ownedBankIds={["ib-sl"]} availableBanks={banks} />);
    const picker = screen.getByRole("heading", { name: "One Bank" }).closest("article")!;
    expect(within(picker).getByLabelText(/Economics HL/i)).toBeInTheDocument();
    expect(within(picker).getByLabelText(/Economics SL/i)).toBeInTheDocument();
  });

  it("does not offer an add-on when every billable bank is already included", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent ownedBankIds={availableBanks.map((bank) => bank.slug)} availableBanks={availableBanks} />);
    expect(container.querySelector("details.pricing-additional-offers")).toBeNull();
    expect(container.querySelectorAll(".pricing-option")).toHaveLength(0);
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
    expect(container.querySelectorAll(".pricing-plan-engraving")).toHaveLength(0);
    expect(container.querySelectorAll(".plan-icon[aria-hidden=\"true\"]")).toHaveLength(3);
    expect(container.querySelectorAll(".plan-feature-list")).toHaveLength(3);
    expect(within(screen.getByRole("list", { name: "One Bank includes" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Every year, including the newest papers", "Every official mark scheme", "Save and download PDFs", "Mock paper builder"]);
    expect(within(screen.getByRole("list", { name: "Build Your Plan includes" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Everything in One Bank", "For every subject you take", "One subscription, one bill"]);
    expect(within(screen.getByRole("list", { name: "All Access includes" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Every bank, every subject", "New banks as they launch", "Best for tutors and schools"]);
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
    expect(screen.getAllByText(/Secure checkout · Cancel any time/)).toHaveLength(3);
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

  it("shows the two-bank starting price with just the billing line while the builder selection is empty", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} initialBankIds={[]} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;

    expect(builder.querySelector(".plan-price strong")).toHaveTextContent("$10");
    expect(builder.querySelector(".plan-price")).toHaveTextContent(/^\$10\s*\/ month$/);
    expect(within(builder).getByText("Billed monthly")).toBeInTheDocument();
    expect(within(builder).queryByText(/two-bank minimum|for 2|for two/i)).not.toBeInTheDocument();
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

  it("offers referral credits beneath free practice, before bank comparison, only on public pricing", () => {
    const { container, rerender } = render(<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={availableBanks} />);
    const note = container.querySelector(".pricing-referral-note") as HTMLElement;
    const free = container.querySelector(".pricing-free-strip") as HTMLElement;
    const catalog = container.querySelector(".pricing-bank-catalog") as HTMLElement;
    expect(note).not.toBeNull();
    expect(free.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(note).getByRole("link", { name: "See referral rewards" })).toHaveAttribute("href", "/login?next=/account/referrals");
    expect(within(note).getByText("Refer friends. Get plan credit.")).toBeInTheDocument();
    expect(within(note).getByText("Eligible referrals can earn a month of credit toward a paid plan after review.")).toBeInTheDocument();
    expect(note.querySelector("a")?.classList.contains("button")).toBe(true);
    expect(container.querySelector(".pricing-includes-compact")).toBeNull();
    rerender(<PricingContent authenticated hasPaidAccess={false} availableBanks={availableBanks} />);
    expect(container.querySelectorAll(".pricing-referral-note")).toHaveLength(1);
    expect(within(container.querySelector(".pricing-referral-note") as HTMLElement).getByRole("link", { name: "See referral rewards" })).toHaveAttribute("href", "/account/referrals");
    rerender(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} availableBanks={availableBanks} />);
    expect(container.querySelector(".pricing-referral-note")).toBeNull();
  });

  it("switches between three recurring cards and the card-free lifetime panorama", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={availableBanks} />);
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Lifetime/ }));
    expect(screen.getByRole("button", { name: "Lifetime" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".lifetime-scenic")).toHaveLength(1);
    expect(within(container).getByRole("group", { name: "Billing period" })).toBeInTheDocument();
    expect(container.querySelectorAll(".lifetime-scenic article, .lifetime-scenic .pricing-option")).toHaveLength(0);
    expect(container.querySelectorAll(".billing-toggle")).toHaveLength(1);
    expect(container.querySelector(".billing-toggle")?.parentElement).toHaveClass("pricing-toggle-sticky");
    expect(screen.getByRole("heading", { name: "Lifetime full access" })).toBeInTheDocument();
    expect(screen.getByText("$299")).toBeInTheDocument();
    expect(screen.getByText("All current + future question banks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /unlock lifetime access/i })).toBeInTheDocument();
    expect(container.querySelector(".lifetime-card")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(container.querySelector(".lifetime-scenic")).toBeNull();
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
  });

  it("keeps the shared headline and toggle in one stable sticky parent across all modes", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={availableBanks} />);
    const intro = container.querySelector(".pricing-recurring-intro")!;
    const toggle = container.querySelector(".billing-toggle")!;
    const stickyParent = container.querySelector(".pricing-toggle-sticky")!;
    expect(intro.nextElementSibling).toBe(stickyParent);
    expect(stickyParent.querySelector(".billing-toggle")).toBe(toggle);
    expect(stickyParent.parentElement).toBe(container.querySelector(".pricing-page"));
    expect(intro.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Practise every past paper, newest first." })).toBeInTheDocument();
    expect(screen.getByText("Start free with older years. A plan unlocks the latest papers and every mark scheme.")).toBeInTheDocument();
    expect(container.querySelectorAll(".pricing-plan-engraving")).toHaveLength(0);
    expect(container.querySelectorAll(".pricing-option-popular .pricing-badge")).toHaveLength(1);
    const lifetimeButton = screen.getByRole("button", { name: "Lifetime" });
    lifetimeButton.focus();
    fireEvent.click(lifetimeButton);
    expect(screen.getByRole("heading", { name: "Practise every past paper, newest first." })).toBeInTheDocument();
    expect(container.querySelectorAll(".pricing-plan-engraving")).toHaveLength(0);
    expect(container.querySelector(".billing-toggle")).toBe(toggle);
    expect(document.activeElement).toBe(lifetimeButton);
    fireEvent.click(screen.getByRole("button", { name: /^Annual/ }));
    expect(screen.getByRole("heading", { name: "Practise every past paper, newest first." })).toBeInTheDocument();
    expect(container.querySelector(".billing-toggle")).toBe(toggle);
  });

  it("renders one full-width scenic lifetime offer, keeps checkout gated and restores three subscription cards", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} previewOnly availableBanks={availableBanks} />);
    fireEvent.click(screen.getByRole("button", { name: "Lifetime" }));
    expect(container.querySelectorAll(".lifetime-scenic")).toHaveLength(1);
    expect(within(container).getByRole("group", { name: "Billing period" })).toBeInTheDocument();
    expect(container.querySelector(".pricing-page")).toHaveClass("pricing-page-lifetime");
    expect(container.querySelector(".pricing-page")?.contains(container.querySelector(".pricing-recurring-intro"))).toBe(true);
    expect(container.querySelector(".pricing-page")?.contains(container.querySelector(".pricing-toggle-sticky"))).toBe(true);
    expect(container.querySelector(".pricing-page")?.contains(container.querySelector(".lifetime-scenic"))).toBe(true);
    expect(container.querySelector(".pricing-page")?.contains(container.querySelector(".pricing-free-strip"))).toBe(true);
    expect(container.querySelector(".lifetime-scenic")?.contains(container.querySelector(".pricing-free-strip"))).toBe(false);
    expect(container.querySelectorAll(".lifetime-scenic article, .lifetime-scenic .pricing-option")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Lifetime full access" })).toBeInTheDocument();
    expect(screen.getByText("$299")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Lifetime plan features" })).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /lifetime access/i })).toBeDisabled();
    expect(screen.getByText(/preview only.*checkout is disabled/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(container.querySelector(".lifetime-scenic")).toBeNull();
    expect(container.querySelectorAll(".pricing-decision-grid > article")).toHaveLength(3);
  });

  it("uses a distinct security icon for Secure checkout while retaining BookOpen for All subjects", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={availableBanks} />);
    fireEvent.click(screen.getByRole("button", { name: "Lifetime" }));
    const benefits = within(screen.getByRole("list", { name: "Lifetime plan features" }));
    const subjects = benefits.getByText("All subjects").closest("li")?.querySelector("svg");
    const secure = benefits.getByText("Secure checkout").closest("li")?.querySelector("svg");
    expect(subjects).toBeInTheDocument();
    expect(secure).toBeInTheDocument();
    expect(secure).not.toEqual(subjects);
    expect(container.querySelector(".pricing-page-lifetime .pricing-recurring-intro h1")).toHaveTextContent("Practise every past paper, newest first.");
  });
  it("keeps free access compact and switches the coverage comparison by qualification", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={availableBanks} />);
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

  it("answers the common questions for people choosing a plan, and not for subscribers", () => {
    const { unmount } = render(<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={availableBanks} />);
    const faq = screen.getByRole("region", { name: "Common questions" });
    expect(within(faq).getByText("What's free?")).toBeInTheDocument();
    expect(within(faq).getByText("Older exam years for each bank, with answers. No card needed.")).toBeInTheDocument();
    expect(within(faq).getByText("Yes, any time from your account. Access continues through the paid billing period.")).toBeInTheDocument();
    expect(within(faq).getByText(/Annual saves up to \d+%\. You can switch later\./)).toBeInTheDocument();
    unmount();
    render(<PricingContent authenticated hasPaidAccess complimentaryAccess availableBanks={availableBanks} />);
    expect(screen.queryByRole("region", { name: "Common questions" })).not.toBeInTheDocument();
  });
});
