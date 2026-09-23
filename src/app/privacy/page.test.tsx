import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("Privacy policy", () => {
  it("discloses anonymous cookieless PostHog analytics without session replay", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/PostHog provides anonymous, cookieless product analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/session replay and automatic click capture are disabled/i)).toBeInTheDocument();
  });
});
