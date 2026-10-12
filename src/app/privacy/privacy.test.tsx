import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("analytics privacy disclosure", () => {
  it("explains optional persistent analytics, account linkage and withdrawal", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/only after you allow optional analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/link usage and confirmed conversion events to your stable account identifier and send the email address on your Supabase account to PostHog/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookie settings in the footer/i)).toBeInTheDocument();
    expect(screen.getByText(/whether you accept, reject or close the cookie banner/i)).toBeInTheDocument();
    expect(screen.getByText(/baseline is not linked to your account, except that error reports and request logs from signed-in visits/i)).toBeInTheDocument();
    expect(screen.getByText(/Withdrawal does not stop the anonymous, cookieless baseline/i)).toBeInTheDocument();
  });

  it("discloses account-linked error reports and their limits without implying replay", () => {
    render(<PrivacyPage />);
    const errors = screen.getByText(/redacted error reports to PostHog/i);
    expect(errors).toHaveTextContent(/When you are signed in, these error reports and request logs include your account.s random identifier/i);
    expect(errors).toHaveTextContent(/never include your name, your email address, raw error messages or submitted form contents/i);
    expect(errors).toHaveTextContent(/request logs in PostHog for 14 days/i);
    expect(errors).toHaveTextContent(/Signed-out visitors.? error reports stay anonymous/i);
    expect(screen.getByText(/Session replay and automatic click capture are disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/strip URL query strings and fragments/i)).toBeInTheDocument();
  });
});
