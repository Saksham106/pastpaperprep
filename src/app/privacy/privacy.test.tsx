import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("analytics privacy disclosure", () => {
  it("discloses performance and bounded error collection without implying replay", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/performance measurements and bounded browser error categories/i)).toBeInTheDocument();
    expect(screen.getByText(/Session replay and automatic click capture are disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/strip URL query strings and fragments/i)).toBeInTheDocument();
  });
});
