import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("analytics privacy disclosure", () => {
  it("explains optional persistent analytics, account linkage and withdrawal", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/only after you allow optional analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/link usage and confirmed conversion events to your account identifier/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookie settings in the footer/i)).toBeInTheDocument();
    expect(screen.queryByText(/anonymous, cookieless product analytics/i)).not.toBeInTheDocument();
  });

  it("discloses performance and bounded error collection without implying replay", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/performance measurements and bounded browser error categories/i)).toBeInTheDocument();
    expect(screen.getByText(/Session replay and automatic click capture are disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/strip URL query strings and fragments/i)).toBeInTheDocument();
  });
});
