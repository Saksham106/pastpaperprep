import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("analytics privacy disclosure", () => {
  it("explains optional persistent analytics, account linkage and withdrawal", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/only after you allow optional analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/link usage and confirmed conversion events to your account identifier/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookie settings in the footer/i)).toBeInTheDocument();
    expect(screen.getByText(/whether you accept, reject or close the cookie banner/i)).toBeInTheDocument();
    expect(screen.getByText(/baseline is not linked to your account/i)).toBeInTheDocument();
    expect(screen.getByText(/Withdrawal does not stop the anonymous, cookieless baseline/i)).toBeInTheDocument();
  });

  it("discloses performance and bounded error collection without implying replay", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/performance measurements and bounded browser error categories/i)).toBeInTheDocument();
    expect(screen.getByText(/Session replay and automatic click capture are disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/strip URL query strings and fragments/i)).toBeInTheDocument();
  });
});
