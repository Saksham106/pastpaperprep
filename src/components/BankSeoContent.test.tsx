import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BankSeoContent } from "./BankSeoContent";
import { BANKS } from "@/lib/banks";

describe("BankSeoContent", () => {
  it("adds useful indexable guidance and internal links to a bank page", () => {
    render(<BankSeoContent bank={BANKS[0]} />);

    expect(screen.getByRole("heading", { name: /how to use the mathematics 0580 question bank/i })).toBeInTheDocument();
    expect(screen.getByText(/2,684 questions/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /igcse 0580 revision guide/i })).toHaveAttribute(
      "href",
      "/articles/igcse-maths-0580-past-papers-by-topic",
    );
  });
});
