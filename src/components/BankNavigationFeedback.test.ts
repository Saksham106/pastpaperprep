import { describe, expect, it } from "vitest";
import { shouldShowBankNavigationFeedback } from "@/components/BankNavigationFeedback";

describe("bank navigation feedback eligibility", () => {
  const link = (href: string, options?: { target?: string; download?: boolean }) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    if (options?.target) anchor.target = options.target;
    if (options?.download) anchor.setAttribute("download", "");
    return anchor;
  };

  it("covers internal bank links but excludes modifiers' native alternatives", () => {
    expect(shouldShowBankNavigationFeedback(link("/banks/biology"), "/dashboard")).toBe(true);
    expect(shouldShowBankNavigationFeedback(link("/banks/biology/topics/cells"), "/dashboard")).toBe(true);
    expect(shouldShowBankNavigationFeedback(link("/dashboard"), "/")).toBe(false);
    expect(shouldShowBankNavigationFeedback(link("/banks/biology#topics"), "/banks/biology")).toBe(false);
    expect(shouldShowBankNavigationFeedback(link("/banks/biology", { target: "_blank" }), "/dashboard")).toBe(false);
    expect(shouldShowBankNavigationFeedback(link("/banks/biology", { download: true }), "/dashboard")).toBe(false);
    expect(shouldShowBankNavigationFeedback(link("https://other.example/banks/biology"), "/dashboard")).toBe(false);
  });
});
