import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsConsentBanner } from "./AnalyticsConsentBanner";

afterEach(cleanup);

describe("AnalyticsConsentBanner", () => {
  it("shows a single accept action and an inline customize link with concise copy", () => {
    const onChoice = vi.fn();
    render(<AnalyticsConsentBanner onChoice={onChoice} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sure, allow cookies" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "A little cookie housekeeping." })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize" }).closest("p")).toHaveTextContent("Optional analytics cookies");
    expect(screen.queryByText(/PostHog|a little transparency/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(onChoice).not.toHaveBeenCalled();
  });

  it("dismisses from the close button without changing the analytics choice", () => {
    const onChoice = vi.fn();
    const onDismiss = vi.fn();
    render(<AnalyticsConsentBanner onChoice={onChoice} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Close cookie banner" }));
    expect(onDismiss).toHaveBeenCalledExactlyOnceWith();
    expect(onChoice).not.toHaveBeenCalled();
  });

  it("accepts optional analytics without a second account-profile prompt", () => {
    const onChoice = vi.fn();
    render(<AnalyticsConsentBanner onChoice={onChoice} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sure, allow cookies" }));
    expect(onChoice).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByText(/signed in\? we link that usage to your account/i)).toBeVisible();
  });

  it("expands preferences in the same card with analytics off by default", () => {
    const onChoice = vi.fn();
    render(<AnalyticsConsentBanner onChoice={onChoice} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    expect(screen.queryByRole("button", { name: "Customize" })).not.toBeInTheDocument();
    const accept = screen.getByRole("button", { name: "Sure, allow cookies" });
    const save = screen.getByRole("button", { name: "Save preferences" });
    expect(save.parentElement).toBe(accept.parentElement);
    expect(accept.parentElement?.lastElementChild).toBe(accept);
    expect(screen.getByRole("checkbox", { name: "Optional analytics" })).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: "Optional analytics" })).not.toBeChecked();
    expect(screen.getByText("Always on")).toBeVisible();
    expect(onChoice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(onChoice).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("disables preference actions while saving and exposes a generic retry error", () => {
    render(<AnalyticsConsentBanner onChoice={vi.fn()} onDismiss={vi.fn()} busy error />);
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveTextContent("Saving");
  });

  it("saves explicit analytics opt-in from the customized state", () => {
    const onChoice = vi.fn();
    render(<AnalyticsConsentBanner onChoice={onChoice} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Optional analytics" }));
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(onChoice).toHaveBeenCalledExactlyOnceWith(true);
  });
});
