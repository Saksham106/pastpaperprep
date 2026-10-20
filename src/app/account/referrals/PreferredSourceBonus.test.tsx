import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { claimPreferredSourceBonus } = vi.hoisted(() => ({ claimPreferredSourceBonus: vi.fn() }));
vi.mock("./actions", () => ({ claimPreferredSourceBonus }));
import { PREFERRED_SOURCE_URL, PreferredSourceBonus } from "./PreferredSourceBonus";

describe("preferred source bonus", () => {
  beforeEach(() => claimPreferredSourceBonus.mockReset());

  it("opens Google in a new tab and records the bonus on click", async () => {
    claimPreferredSourceBonus.mockResolvedValue(true);
    render(<PreferredSourceBonus claimed={false} />);
    const link = screen.getByRole("link", { name: /preferred source on Google/ });
    expect(link).toHaveAttribute("href", PREFERRED_SOURCE_URL);
    expect(link).toHaveAttribute("target", "_blank");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(claimPreferredSourceBonus).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText(/\+1 signup counted/)).toBeVisible());
  });

  it("keeps the button when the claim is refused", async () => {
    claimPreferredSourceBonus.mockResolvedValue(false);
    render(<PreferredSourceBonus claimed={false} />);
    const link = screen.getByRole("link", { name: /preferred source on Google/ });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    await waitFor(() => expect(claimPreferredSourceBonus).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /preferred source on Google/ })).toBeVisible();
  });

  it("shows the done state once claimed", () => {
    render(<PreferredSourceBonus claimed />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/\+1 signup counted/)).toBeVisible();
  });
});
