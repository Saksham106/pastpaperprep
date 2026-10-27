import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { EXAM_STYLE_COURSES, type ExamStyleWorksheet } from "@/lib/exam-style-worksheets";

vi.mock("@/components/ExamStylePdfViewer", () => ({
  ExamStylePdfViewer: ({ src, title }: { src: string; title: string }) => <div data-testid="pdf-viewer" data-src={src}>{title}</div>,
}));

import { ExamStyleWorksheetLibrary } from "./ExamStyleWorksheetLibrary";

it("opens the first Economics PDF and groups selectable booklets by topic with explicit levels", async () => {
  const worksheets: ExamStyleWorksheet[] = [
    { course: "ib-economics", slug: "introduction", title: "Introduction", fileName: "introduction.pdf", section: "Introduction to economics", topics: ["Scarcity"], level: "SL and HL" },
    { course: "ib-economics", slug: "markets", title: "Markets", fileName: "markets.pdf", section: "Microeconomics", topics: ["Demand"], level: "SL and HL (includes HL-only subtopics)" },
  ];
  const user = userEvent.setup();
  render(<ExamStyleWorksheetLibrary worksheets={worksheets} />);
  expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/worksheets/ib-economics/introduction");
  expect(screen.getByRole("heading", { name: "Introduction to economics" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Microeconomics" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Introduction.*SL and HL/ })).toHaveAttribute("aria-pressed", "true");
  const markets = screen.getByRole("button", { name: /Markets.*includes HL-only subtopics/ });
  await user.click(markets);
  expect(markets).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/worksheets/ib-economics/markets");
});

it("exposes every imported Economics booklet in manifest order in one PDF workspace", async () => {
  const user = userEvent.setup();
  const worksheets = EXAM_STYLE_COURSES["ib-economics"].worksheets;
  render(<ExamStyleWorksheetLibrary worksheets={worksheets} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(10);
  expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([...new Set(worksheets.map(({ section }) => section))]);
  expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", "/api/exam-style/worksheets/ib-economics/what-is-economics");
  for (const [index, worksheet] of worksheets.entries()) {
    expect(buttons[index]).toHaveTextContent(worksheet.title);
    await user.click(buttons[index]);
    expect(buttons[index]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-src", `/api/exam-style/worksheets/ib-economics/${worksheet.slug}`);
  }
});

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
