import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { EXAM_STYLE_COURSES } from "@/lib/exam-style-worksheets";

vi.mock("@/components/ExamStylePdfViewer", () => ({
  ExamStylePdfViewer: ({ src, title }: { src: string; title: string }) => <div data-testid="pdf-viewer" data-src={src}>{title}</div>,
}));

import { ExamStyleWorksheetLibrary } from "./ExamStyleWorksheetLibrary";

it("includes indices and retains one advanced trigonometry choice in the 0580 exam-style library", async () => {
  const user = userEvent.setup();
  render(<ExamStyleWorksheetLibrary worksheets={EXAM_STYLE_COURSES["igcse-0580"].worksheets} />);
  expect(screen.getAllByRole("button")).toHaveLength(8);
  expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/worksheets/igcse-0580/2d-shapes-and-3d-solids");
  await user.click(screen.getByRole("button", { name: /^Indices / }));
  expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/worksheets/igcse-0580/indices");
  expect(screen.getByTestId("pdf-viewer")).toHaveTextContent("Indices");
  expect(screen.getAllByRole("button", { name: /^Advanced Trigonometry / })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: /^Advanced Trigonometry / }));
  expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/worksheets/igcse-0580/advanced-trigonometry");
});
