import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("Privacy policy", () => {
  it("briefly discloses the separate 30-day referral cookie and partner commission purpose", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/first-party referral cookie for up to 30 days/i)).toBeInTheDocument();
    expect(screen.getByText(/associate the referral with your account/i)).toBeInTheDocument();
    expect(screen.getByText(/partner commission/i)).toBeInTheDocument();
  });

  it("discloses customer invite account binding and aggregate, manually reviewed reward progress", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/customer or partner referral link/i)).toBeInTheDocument();
    expect(screen.getByText(/verified account/i)).toBeInTheDocument();
    expect(screen.getByText(/aggregate signup/i)).toBeInTheDocument();
    expect(screen.getByText(/manually review.*purchase/i)).toBeInTheDocument();
  });

  it("discloses anonymous cookieless PostHog analytics without session replay", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/PostHog provides anonymous, cookieless product analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/session replay and automatic click capture are disabled/i)).toBeInTheDocument();
  });
});
