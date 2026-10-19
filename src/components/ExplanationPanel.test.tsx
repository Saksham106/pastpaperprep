import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import ExplanationPanel from "@/components/ExplanationPanel";
import type { Explanation } from "@/lib/explanation-format";

describe("ExplanationPanel code blocks", () => {
  it("keeps pseudocode line for line in a monospace block, escaped and outside KaTeX", () => {
    const code = "IF Mark > 50 AND $x < 3\n    OUTPUT \"<b>Pass</b>\"\nENDIF";
    const explanation: Explanation = {
      schemaVersion: 1,
      bank: "igcse-computer-science-0478",
      questionId: "0478-2026-s-21-q1",
      totalMarks: 1,
      parts: [{ label: "", marks: 1, approach: "Check the condition.", steps: [{ text: "Write the selection:", code, marks: ["✓"] }], answer: "The IF statement" }],
    };
    const { container } = render(<ExplanationPanel explanation={explanation} />);
    const block = container.querySelector("pre code");
    expect(block?.textContent).toBe(code);
    expect(block?.querySelector("b, .katex")).toBeNull();
  });
});
