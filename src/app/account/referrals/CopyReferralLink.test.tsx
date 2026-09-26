import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyReferralLink } from "./CopyReferralLink";

describe("CopyReferralLink", () => {
  it("copies the exact share link and confirms success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CopyReferralLink url="https://pastpaperprep.com/invite/c_111111111111111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("https://pastpaperprep.com/invite/c_111111111111111111111111");
    expect(await screen.findByRole("status")).toHaveTextContent("Copied");
  });

  it("reports clipboard failure rather than claiming a copy", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("permission denied")) } });
    render(<CopyReferralLink url="https://pastpaperprep.com/invite/c_111111111111111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Select and copy the link above");
  });
});
