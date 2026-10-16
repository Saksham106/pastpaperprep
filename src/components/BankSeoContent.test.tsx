import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BankSeoContent } from "./BankSeoContent";
import { BANKS } from "@/lib/banks";

describe("BankSeoContent", () => {
  it("adds useful indexable guidance and internal links to a bank page", () => {
    render(<BankSeoContent bank={BANKS[0]} />);

    expect(screen.getByRole("heading", { name: /how to use the mathematics 0580 question bank/i })).toBeInTheDocument();
    expect(screen.getByText(/4,174 authentic past-paper questions/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /igcse 0580 revision guide/i })).toHaveAttribute(
      "href",
      "/articles/igcse-maths-0580-past-papers-by-topic",
    );
  });

  it("links the bank's topic landing pages", () => {
    render(<BankSeoContent bank={BANKS[0]} topicLinks={[{ label: "Geometry", href: "/banks/igcse/topics/geometry" }]} />);
    expect(screen.getByRole("navigation", { name: /mathematics 0580 topics/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Geometry questions" })).toHaveAttribute("href", "/banks/igcse/topics/geometry");
  });

  it("links exam-style worksheets from their course bank hubs", () => {
    const { rerender } = render(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "igcse")!} />);
    expect(screen.getByRole("link", { name: "IGCSE 0580 exam-style practice" })).toHaveAttribute("href", "/banks/igcse/exam-style");
    rerender(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "igcse-additional")!} />);
    expect(screen.getByRole("link", { name: "IGCSE 0606 differentiation practice" })).toHaveAttribute("href", "/banks/igcse-additional/exam-style");
    rerender(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "ib-sl")!} />);
    expect(screen.getByRole("link", { name: "IB Math AA SL probability-distribution practice" })).toHaveAttribute("href", "/banks/ib-sl/exam-style/probability-distributions");
  });

  it("puts the AA HL printable workflow early and states account, plan, and quota gates", () => {
    render(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "ib-hl")!} />);
    expect(screen.getByRole("heading", { name: /build a printable ib maths aa hl practice set/i })).toBeInTheDocument();
    expect(screen.getByText(/PastPaperPrep lets you practise authentic AA HL past-paper questions/i)).toBeInTheDocument();
    expect(screen.getByText(/Guests can view up to 20 matching free questions/i)).toBeInTheDocument();
    expect(screen.getByText(/a free account unlocks the rest of the free selection/i)).toBeInTheDocument();
    expect(screen.getByText(/follows your plan’s download allowance/i)).toBeInTheDocument();
  });

  it("leaves non-AA-HL bank guidance unchanged", () => {
    render(<BankSeoContent bank={BANKS[0]} />);
    expect(screen.getByRole("heading", { name: /how to use the mathematics 0580 question bank/i })).toBeInTheDocument();
    expect(screen.queryByText(/build a printable/i)).not.toBeInTheDocument();
  });

  it("shows an indexable, clearly illustrative worked example only for a bank with published explanations", () => {
    const { container, rerender } = render(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "ib-hl")!} />);
    const example = container.querySelector("#worked-example");
    expect(example).not.toBeNull();
    expect(example).toHaveTextContent("not an official exam question");
    expect(example).toHaveTextContent("y = 7x − 4");
    expect(example).toHaveTextContent("Availability is per question");
    expect(example?.querySelector('a[href="/banks/ib-hl?topic=Calculus"]')).not.toBeNull();
    expect(example?.querySelector("img")).toBeNull();
    rerender(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "ib-biology-hl")!} />);
    expect(container.querySelector("#worked-example")).toBeNull();
  });

  it("distinguishes authentic archived questions from generated exam-style practice and states free access honestly", () => {
    render(<BankSeoContent bank={BANKS.find((bank) => bank.slug === "ib-biology-hl")!} />);
    expect(screen.getByText(/Practise 2,071 authentic past-paper questions from 93 archived papers/i)).toBeInTheDocument();
    expect(screen.getByText(/not AI-generated exam-style substitutes/i)).toBeInTheDocument();
    expect(screen.getByText(/Guests can view up to 20 matching free questions/i)).toBeInTheDocument();
    expect(screen.getByText(/account’s download allowance/i)).toBeInTheDocument();
    expect(screen.queryByText(/video|AI tutor/i)).not.toBeInTheDocument();
  });
});
