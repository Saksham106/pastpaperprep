import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("approved custom-bank pricing", () => {
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
    expect(container.querySelector(".plan-art")).toBeNull();
    expect(container.querySelectorAll(".plan-icon[aria-hidden=\"true\"]")).toHaveLength(3);
    expect(container.querySelectorAll(".plan-feature-list")).toHaveLength(0);
    expect(within(cards[0] as HTMLElement).getByText("Focus on one syllabus.")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("Mix the banks you actually take.")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("Two to five banks")).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText("Everything, including future banks.")).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).queryByRole("link", { name: "Choose One Bank" })).not.toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).queryByRole("link", { name: /Continue with/ })).not.toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByRole("link", { name: "Get All Access" })).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText("Select one bank to continue.")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("Select at least two banks to continue.")).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
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
    expect(builder.querySelectorAll("[data-bank-id]")).toHaveLength(12);
    expect(container.querySelectorAll("[data-pricing-bank]")).toHaveLength(12);
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

  it("offers checkout continuations only after explicit valid bank choices", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const oneBank = screen.getByRole("heading", { name: "One Bank" }).closest("article") as HTMLElement;
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;

    expect(within(oneBank).queryByRole("link", { name: "Choose One Bank" })).not.toBeInTheDocument();
    expect(within(builder).queryByRole("link", { name: /Continue with/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get All Access" })).toBeInTheDocument();

    fireEvent.click(within(oneBank).getByRole("radio", { name: "IB Math AI HL" }));
    expect(within(oneBank).getByRole("link", { name: "Choose One Bank" })).toBeInTheDocument();

    const checkboxes = within(builder).getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(within(builder).getByRole("link", { name: "Continue with 2 banks" })).toBeInTheDocument();
  });

  it("restores a visitor's selected bank after sign-in", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" initialProductId="bank_ib_ai_hl" />);
    expect(screen.getByRole("radio", { name: "IB Math AI HL" })).toBeChecked();
    expect(screen.getByRole("button", { name: /annual.*save up to 33%/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps One Bank to exactly one selected canonical bank", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialBankIds={["ib-sl", "igcse"]} />);
    const oneBank = screen.getByRole("heading", { name: "One Bank" }).closest("article");
    expect(within(oneBank!).getAllByRole("radio", { checked: true })).toHaveLength(1);
    expect(within(oneBank!).getByRole("radio", { name: "IB Math AA SL" })).toBeChecked();
  });

  it("keeps free access compact and preserves the coverage comparison", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-free-strip")).not.toBeNull();
    const table = screen.getByRole("table", { name: "Question bank coverage" });
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(container.querySelectorAll("[data-pricing-bank]")).toHaveLength(12);
  });
});
