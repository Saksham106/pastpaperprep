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
