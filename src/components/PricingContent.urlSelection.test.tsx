import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";
import { getCatalogRuntimeBanks } from "@/lib/catalog";

const availableBanks = getCatalogRuntimeBanks();
const props = { authenticated: false, hasPaidAccess: false, availableBanks } as const;
const builderOf = (container: HTMLElement) => container.querySelector<HTMLElement>("#plan-builder")!;
const checkedNames = (container: HTMLElement) => within(builderOf(container)).queryAllByRole("checkbox", { checked: true }).map((box) => box.getAttribute("aria-label") ?? box.closest("label")?.textContent);

describe("URL-derived pricing selection", () => {
  it("updates the Builder when client navigation changes the banks prop", () => {
    const { container, rerender } = render(<PricingContent {...props} initialProductId="bank_igcse" />);
    expect(within(builderOf(container)).getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    expect(builderOf(container)).toHaveTextContent("1 selected");
    rerender(<PricingContent {...props} initialBankIds={["igcse", "igcse-additional"]} />);
    expect(within(builderOf(container)).getAllByRole("checkbox", { checked: true })).toHaveLength(2);
    expect(within(builderOf(container)).getByRole("checkbox", { name: /Additional/i, checked: true })).toBeInTheDocument();
    expect(builderOf(container)).toHaveTextContent("2 selected");
    expect(builderOf(container)).not.toHaveTextContent("1 selected");
  });

  it("adopts an annual interval from the new URL", () => {
    const { rerender } = render(<PricingContent {...props} initialProductId="bank_igcse" />);
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    rerender(<PricingContent {...props} initialProductId="bank_igcse" initialInterval="annual" />);
    expect(screen.getByRole("button", { name: /^Annual/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps manual edits across rerenders with unchanged URL props", () => {
    const { container, rerender } = render(<PricingContent {...props} initialBankIds={["igcse", "igcse-additional"]} />);
    const builder = builderOf(container);
    const extra = within(builder).getAllByRole("checkbox", { checked: false })[0];
    fireEvent.click(extra);
    expect(within(builder).getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    rerender(<PricingContent {...props} initialBankIds={["igcse", "igcse-additional"]} source={undefined} />);
    expect(within(builderOf(container)).getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    expect(checkedNames(container)).toHaveLength(3);
  });
});

describe("URL navigation re-adopts billing intent", () => {
  it("resets a manual Annual choice when the new URL says monthly", () => {
    const { rerender } = render(<PricingContent {...props} initialInterval="monthly" initialBankIds={["igcse"]} />);
    fireEvent.click(screen.getByRole("button", { name: /^Annual/ }));
    expect(screen.getByRole("button", { name: /^Annual/ })).toHaveAttribute("aria-pressed", "true");
    rerender(<PricingContent {...props} initialInterval="monthly" initialBankIds={["igcse", "igcse-additional"]} />);
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Annual/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("leaves Lifetime when navigating to a recurring bank selection", () => {
    const { container, rerender } = render(<PricingContent {...props} initialBankIds={["igcse"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Lifetime/ }));
    expect(screen.getByRole("button", { name: /Lifetime/ })).toHaveAttribute("aria-pressed", "true");
    rerender(<PricingContent {...props} initialBankIds={["igcse", "igcse-additional"]} />);
    expect(screen.getByRole("button", { name: /Lifetime/ })).toHaveAttribute("aria-pressed", "false");
    expect(within(builderOf(container)).getAllByRole("checkbox", { checked: true })).toHaveLength(2);
  });
});
