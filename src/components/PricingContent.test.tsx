import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("approved custom-bank pricing", () => {
  it("shows concise, visually distinct plans without duplicate price counters", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    const cards = container.querySelectorAll(".pricing-option");

    expect(screen.getByRole("heading", { name: "One Bank" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build Your Plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Access" })).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText("$6")).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText("$25")).toBeInTheDocument();
    expect(cards[0]).toHaveAttribute("data-plan-tone", "starter");
    expect(cards[1]).toHaveAttribute("data-plan-tone", "builder");
    expect(cards[2]).toHaveAttribute("data-plan-tone", "premium");
    expect(container.querySelector(".plan-art")).toBeNull();
    expect(container.querySelectorAll(".plan-icon[aria-hidden=\"true\"]")).toHaveLength(3);
    expect(container.querySelectorAll(".plan-feature-list")).toHaveLength(3);
    expect(within(cards[0] as HTMLElement).getByText("Focus on one syllabus.")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("Mix the banks you actually take.")).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText("Everything, including future banks.")).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText("Every question in one bank")).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText("Choose 1–5 exact banks")).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByText("All 12 current banks")).toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByRole("link", { name: "Choose One Bank" })).toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByRole("link", { name: "Build Your Plan" })).toBeInTheDocument();
    expect(within(cards[2] as HTMLElement).getByRole("link", { name: "Get All Access" })).toBeInTheDocument();
    expect(screen.queryByText(/Choose exactly one question bank/)).not.toBeInTheDocument();
    expect(screen.queryByText(/The first bank is \$6\/month/)).not.toBeInTheDocument();
    expect(container.querySelector(".custom-bundle-effective-price")).toBeNull();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
  });

  it("updates the builder total from the exact selected bank count", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article");
    expect(builder).not.toBeNull();
    const checkboxes = within(builder!).getAllByRole("checkbox");
    expect(within(builder!).getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(checkboxes[1]);

    expect(within(builder!).getByText("2 selected")).toBeInTheDocument();
    expect(builder!.querySelector(".plan-price strong")).toHaveTextContent("$10");
    expect(builder!.querySelector(".custom-bundle-effective-price")).toBeNull();
  });

  it("reflects the selected bank count in the builder headline price", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const headlinePrice = () => builder.querySelector(".plan-price strong")?.textContent;
    const checkboxes = within(builder).getAllByRole("checkbox");

    expect(headlinePrice()).toBe("$6");
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

    expect(headlinePrice()).toBe("$4");
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(checkboxes[3]);
    fireEvent.click(checkboxes[4]);
    expect(headlinePrice()).toBe("$16");
  });

  it("keeps a zero-selection builder headline truthful", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} initialBankIds={[]} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;

    expect(builder.querySelector(".plan-price strong")).toHaveTextContent("$0");
    expect(within(builder).getByText("Select banks to see your price.")).toBeInTheDocument();
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
    expect(within(disclosure).getByText("1 selected")).toBeInTheDocument();
  });

  it("shows annual effective monthly prices, exact yearly totals, and annual builder math", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);

    expect(screen.getAllByText("$4").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Billed \$48 once a year/)).toHaveLength(2);
    expect(screen.getByText("$18")).toBeInTheDocument();
    expect(screen.getByText("Mix the banks you actually take.")).toBeInTheDocument();
    expect(screen.queryByText(/The first bank is/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Billed/).map((node) => node.textContent).some((text) => text?.includes("$216 once a year"))).toBe(true);
  });

  it("disables Build Your Plan checkout and pricing when no banks are selected", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const checkbox = within(builder).getAllByRole("checkbox")[0];

    fireEvent.click(checkbox);

    expect(within(builder).getByText("Select at least one bank to continue.")).toBeInTheDocument();
    expect(within(builder).queryByRole("button", { name: /choose monthly/i })).not.toBeInTheDocument();
    expect(builder.querySelector(".custom-bundle-effective-price")).toBeNull();
    expect(builder.querySelector(".custom-bundle-total")).toBeNull();
  });

  it("keeps the popular plan first on mobile and all three cards in one grid", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-decision-grid")).not.toBeNull();
    expect(container.querySelectorAll(".pricing-decision-grid > .pricing-option")).toHaveLength(3);
    expect(container.querySelector(".pricing-option-popular")).toHaveAttribute("data-mobile-order", "first");
  });

  it("offers exact bank choices and checkout continuations before sign-in", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(screen.getByRole("link", { name: "Choose One Bank" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Build Your Plan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get All Access" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "IB Math AI HL" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "IB Math AA HL" })).toBeInTheDocument();
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
