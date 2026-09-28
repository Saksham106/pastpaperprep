import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamStylePdfViewer } from "@/components/ExamStylePdfViewer";

describe("exam-style focused PDF viewer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("focuses the PDF in-page and restores the same viewer via button and Escape", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { unmount } = render(<ExamStylePdfViewer src="/api/exam-style/proof-by-induction/divisibility" title="Divisibility" />);
    const viewer = screen.getByRole("region", { name: "Divisibility practice PDF" });
    const opener = screen.getByRole("button", { name: "Focus view" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Divisibility focused practice PDF" });
    expect(dialog).toHaveClass("is-focused");
    expect(viewer).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to practice" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Divisibility practice PDF" })).toBe(viewer);
    expect(document.body.style.overflow).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Focus view" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Focus view" }));
    unmount();
    await act(async () => {});
    expect(document.body.style.overflow).toBe("");
  });
});
