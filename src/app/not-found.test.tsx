import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";

describe("NotFound", () => {
  it("gives lost visitors useful recovery paths", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: /this page is missing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse question banks/i })).toHaveAttribute("href", "/#question-banks");
    expect(screen.getByRole("link", { name: /read revision guides/i })).toHaveAttribute("href", "/articles");
    expect(screen.getByRole("link", { name: /compare plans/i })).toHaveAttribute("href", "/pricing");
  });
});
