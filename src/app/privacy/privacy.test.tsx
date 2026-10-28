import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("analytics privacy disclosure", () => {
  it("explains the anonymous baseline, optional analytics and withdrawal", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/anonymously, without cookies or persistent identifiers/i)).toBeInTheDocument();
    expect(screen.getByText(/share your email address with our analytics provider/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookie settings in the footer/i)).toBeInTheDocument();
    expect(screen.getByText(/Withdrawal does not stop the anonymous, cookieless baseline/i)).toBeInTheDocument();
  });

  it("discloses account-linked error reports and their limits", () => {
    render(<PrivacyPage />);
    const errors = screen.getByText(/redacted error reports/i);
    expect(errors).toHaveTextContent(/server request logs for 14 days/i);
    expect(errors).toHaveTextContent(/When you are signed in, these include your account.s random identifier/i);
    expect(errors).toHaveTextContent(/whether the page was translated or changed by a browser extension/i);
    expect(errors).toHaveTextContent(/never include your name, email address, raw error messages, page text or anything you type/i);
    expect(screen.getByText(/Session replay and automatic click capture are disabled/i)).toBeInTheDocument();
  });
});
