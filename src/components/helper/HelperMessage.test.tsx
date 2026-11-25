import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelperMessage } from "@/components/helper/HelperMessage";

describe("HelperMessage", () => {
  it("draws a marking reply as a score, mark points and a fix note", () => {
    const { container } = render(<HelperMessage text={"Mark: 1 / 3\n\n✓ M1 (a) correct method\n- ✗ A1 (a) wrong sign\n✗ B1 (b) missing units\n\nFix: check the sign when you expand."} />);
    expect(screen.getByRole("img", { name: "Marked 1 out of 3" })).toBeInTheDocument();
    expect(screen.queryByText(/Mark: 1/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Mark lost")).toHaveLength(2);
    expect(screen.getByLabelText("Mark earned")).toBeInTheDocument();
    expect([...container.querySelectorAll("code")].map((node) => node.textContent)).toEqual(["M1", "A1", "B1"]);
    expect(screen.getByText("Fix")).toBeInTheDocument();
  });

  it("leaves ordinary replies as plain text", () => {
    render(<HelperMessage text={"Try expanding the bracket first."} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Try expanding the bracket first.")).toBeInTheDocument();
  });
});

describe("HelperMessage score timing and celebration", () => {
  it("bursts confetti only for a finished marking reply with full marks", () => {
    const flecks = (node: HTMLElement) => node.querySelectorAll("[aria-hidden='true'] i").length;
    expect(flecks(render(<HelperMessage text={"Mark: 4 / 4\n✓ M1 good"} celebrate />).container)).toBe(10);
    expect(flecks(render(<HelperMessage text={"Mark: 3 / 4\n✗ A1 sign error"} celebrate />).container)).toBe(0);
    // History replay and ordinary answers: no celebrate flag, no confetti.
    expect(flecks(render(<HelperMessage text={"Mark: 4 / 4\n✓ M1 good"} />).container)).toBe(0);
    // Still streaming: no confetti yet.
    expect(flecks(render(<HelperMessage text={"Mark: 4 / 4\n✓ M1 good"} complete={false} celebrate />).container)).toBe(0);
  });

  it("waits for the whole score line while streaming", () => {
    const { container, rerender } = render(<HelperMessage text={"Mark: 1 / 1"} complete={false} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
    rerender(<HelperMessage text={"Mark: 1 / 10\n✓ M1"} complete={false} />);
    expect(screen.getByRole("img", { name: "Marked 1 out of 10" })).toBeInTheDocument();
  });
});
