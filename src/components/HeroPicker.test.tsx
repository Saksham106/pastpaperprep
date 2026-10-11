import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroPicker } from "@/components/HeroPicker";

const groups = [
  { id: "igcse", label: "IGCSE", banks: [
    { slug: "igcse", label: "Mathematics 0580", href: "/banks/igcse?free=1" },
    { slug: "igcse-additional", label: "Additional Mathematics 0606", href: "/banks/igcse-additional?free=1" },
  ] },
  { id: "ib", label: "IB", banks: [{ slug: "ib-hl", label: "IB Math AA HL", href: "/banks/ib-hl?free=1" }] },
];

describe("HeroPicker", () => {
  it("starts on the first qualification and bank", () => {
    render(<HeroPicker groups={groups} />);
    expect(screen.getByRole("button", { name: "IGCSE" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "IB" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute("href", "/banks/igcse?free=1");
  });

  it("follows the chosen subject", () => {
    render(<HeroPicker groups={groups} />);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "igcse-additional" } });
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute("href", "/banks/igcse-additional?free=1");
  });

  it("resets to the first bank when switching qualification", () => {
    render(<HeroPicker groups={groups} />);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "igcse-additional" } });
    fireEvent.click(screen.getByRole("button", { name: "IB" }));
    expect(screen.getByRole("button", { name: "IB" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Subject")).toHaveValue("ib-hl");
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute("href", "/banks/ib-hl?free=1");
  });

  it("hides qualifications without banks and renders nothing when empty", () => {
    const { rerender, container } = render(<HeroPicker groups={[groups[0], { id: "ib", label: "IB", banks: [] }]} />);
    expect(screen.queryByRole("button", { name: "IB" })).toBeNull();
    expect(screen.getByLabelText("Subject")).toHaveValue("igcse");
    rerender(<HeroPicker groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
