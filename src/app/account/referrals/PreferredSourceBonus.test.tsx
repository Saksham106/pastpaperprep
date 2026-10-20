import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { claimPreferredSourceBonus } = vi.hoisted(() => ({ claimPreferredSourceBonus: vi.fn() }));
vi.mock("./actions", () => ({ claimPreferredSourceBonus }));
vi.mock("next/script", () => ({ default: () => null }));
import { PreferredSourceBonus } from "./PreferredSourceBonus";

function googleButton() {
  return screen.getByTestId("preferred-source-button").querySelector("[google-add-preferred-source-btn]")!;
}

describe("preferred source bonus", () => {
  beforeEach(() => {
    claimPreferredSourceBonus.mockReset();
    delete window.PREFERRED_SOURCE;
  });

  it("asks Google's script to render its button on every mount", () => {
    const init = vi.fn();
    render(<PreferredSourceBonus claimed={false} />);
    const queue = window.PREFERRED_SOURCE as Array<(api: { init: typeof init }) => void>;
    expect(queue).toHaveLength(1);
    queue[0]({ init });
    expect(init).toHaveBeenCalledWith({ lang: "en" });
    expect(googleButton()).toBeInTheDocument();
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
