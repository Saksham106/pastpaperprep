import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { claimPreferredSourceBonus } = vi.hoisted(() => ({ claimPreferredSourceBonus: vi.fn() }));
vi.mock("./actions", () => ({ claimPreferredSourceBonus }));
import { PreferredSourceBonus } from "./PreferredSourceBonus";

function googleButton() {
  return screen.getByTestId("preferred-source-button").querySelector("[google-add-preferred-source-btn]")!;
}

describe("preferred source bonus", () => {
  beforeEach(() => {
    claimPreferredSourceBonus.mockReset();
  });

  it("records the bonus when Google's button is clicked", async () => {
    claimPreferredSourceBonus.mockResolvedValue(true);
    render(<PreferredSourceBonus claimed={false} />);
    expect(screen.getByText("Counts as 1 signup")).toBeVisible();
    fireEvent.click(googleButton());
    expect(claimPreferredSourceBonus).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText("+1 signup counted")).toBeVisible());
  });

  it("keeps the offer when the claim is refused", async () => {
    claimPreferredSourceBonus.mockResolvedValue(false);
    render(<PreferredSourceBonus claimed={false} />);
    fireEvent.click(googleButton());
    await waitFor(() => expect(claimPreferredSourceBonus).toHaveBeenCalled());
    expect(screen.getByText("Counts as 1 signup")).toBeVisible();
  });

  it("does not claim again once counted, but keeps Google's button", () => {
    render(<PreferredSourceBonus claimed />);
    fireEvent.click(googleButton());
    expect(claimPreferredSourceBonus).not.toHaveBeenCalled();
    expect(screen.getByText("+1 signup counted")).toBeVisible();
  });
});
