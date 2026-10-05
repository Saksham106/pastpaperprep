import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BankSeoContent } from "./BankSeoContent";
import { BANKS } from "@/lib/banks";

describe("BankSeoContent", () => {
  it("adds useful indexable guidance and internal links to a bank page", () => {
    render(<BankSeoContent bank={BANKS[0]} />);

    expect(screen.getByRole("heading", { name: /how to use the mathematics 0580 question bank/i })).toBeInTheDocument();
    expect(screen.getByText(/3,967 questions/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /igcse 0580 revision guide/i })).toHaveAttribute(
      "href",
      "/articles/igcse-maths-0580-past-papers-by-topic",
    );
  });

  it("puts the AA HL printable workflow early and states account, plan, and quota gates", () => {
    render(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "ib-hl")!} />);
    expect(screen.getByRole("heading", { name: /build a printable ib maths aa hl practice set/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IB Maths AA HL past papers by topic" })).toHaveAttribute("href", "/articles/ib-math-past-papers-by-topic");
    expect(screen.getByText(/free questions require an account/i)).toBeInTheDocument();
    expect(screen.getByText(/eligible paid plan and subject to its export quota/i)).toBeInTheDocument();
    expect(screen.getByText(/Paid questions remain locked unless your plan includes this bank/i)).toBeInTheDocument();
  });

  it("leaves non-AA-HL bank guidance unchanged", () => {
    render(<BankSeoContent bank={BANKS[0]} />);
    expect(screen.getByRole("heading", { name: /how to use the mathematics 0580 question bank/i })).toBeInTheDocument();
    expect(screen.queryByText(/build a printable/i)).not.toBeInTheDocument();
  });
});
