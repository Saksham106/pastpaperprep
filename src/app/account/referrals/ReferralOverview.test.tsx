import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferralOverview } from "./ReferralOverview";

const summary = { code: "c_111111111111111111111111", verifiedSignups: 2, awardedRewards: 0, awardedSignupMilestones: 0 };

describe("referral terms", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) { this.removeAttribute("open"); });
  });

  it("keeps the detailed rules out of the page until More info opens a closable dialog", () => {
    render(<ReferralOverview summary={summary} />);
    expect(screen.getByText(/5 verified signups.*1 month free/)).toBeVisible();
    expect(screen.getByText(/1 referred first purchase.*1 month free/)).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/For annual plans/)).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "More info" }));
    expect(screen.getByRole("dialog", { name: "How referral credits work" })).toBeVisible();
    expect(screen.getByText(/For annual plans/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close referral details" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets Escape close the details without changing progress", () => {
    render(<ReferralOverview summary={summary} />);
    fireEvent.click(screen.getByRole("button", { name: "More info" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeVisible();
  });
});
