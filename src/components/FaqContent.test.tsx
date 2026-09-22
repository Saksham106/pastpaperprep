import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FaqContent } from "@/components/FaqContent";

describe("FaqContent", () => {
  it("answers the core product questions and makes support contact obvious", () => {
    render(<FaqContent />);

    expect(screen.getByRole("heading", { level: 1, name: "Frequently asked questions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what is pastpaperprep/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what can i use for free/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /how do pdf worksheets work/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /is pastpaperprep affiliated/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@pastpaperprep.com" })).toHaveAttribute("href", "mailto:hello@pastpaperprep.com");
  });
});
