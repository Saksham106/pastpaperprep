import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<object>()), trackProductEvent: track }));
// A low threshold keeps the test small: two questions count as a "large" export here.
vi.mock("@/lib/export-limits", async (importOriginal) => ({ ...(await importOriginal<object>()), LARGE_PDF_QUESTIONS: 2 }));
vi.mock("@/lib/pdf-export", async (importOriginal) => ({ ...(await importOriginal<object>()), downloadQuestionPdf: download }));

import { QuestionExplorer } from "@/components/QuestionExplorer";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";

const fullAccess = { authenticated: true, bankAccess: true, canExportPdf: true };
const paid = [{ productId: "bank_ib_sl" as const, status: "active" as const, startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];

function setup(signResponse: () => Response | Promise<Response>) {
  const questions = prepareQuestionsForDelivery(loadBankQuestions("ib-sl").slice(0, 8), paid);
  const signCalls: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/pdf/sign") { signCalls.push(JSON.parse(String(init?.body))); return signResponse(); }
    if (url === "/api/worksheets") return Response.json({ worksheets: [] });
    if (url === "/api/study-state") return new Response("{}", { status: 200 });
    const body = init?.body ? JSON.parse(String(init.body)) : { requests: [] };
    return Response.json({ expiresIn: 600, assets: (body.requests ?? []).map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) });
  }));
  window.history.replaceState({}, "", "/banks/ib-sl");
  render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={fullAccess} />);
  const boxes = screen.getAllByRole("checkbox", { name: /add question/i });
  fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
  fireEvent.click(screen.getByRole("button", { name: "Save PDF (2 selected)" }));
  const dialog = screen.getByRole("dialog", { name: /save 2 questions as a pdf/i });
  fireEvent.click(within(dialog).getByRole("radio", { name: "Answers" }));
  return { dialog, signCalls };
}

const events = (name: string) => track.mock.calls.filter(([event]) => event === name).map(([, props]) => props);

describe("QuestionExplorer PDF download", () => {
  afterEach(() => { vi.unstubAllGlobals(); track.mockClear(); download.mockReset(); });

  it("asks before a large export and does nothing until confirmed", async () => {
    download.mockResolvedValue({ heldRows: [] });
    const { dialog, signCalls } = setup(() => Response.json({ expiresIn: 600, assets: [] }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Download PDF without saving" }));
    const confirm = within(dialog).getByRole("group", { name: /download all 2 questions\?/i });
    expect(signCalls).toHaveLength(0);
    expect(events("pdf_export_attempt")).toHaveLength(0);

    fireEvent.click(within(confirm).getByRole("button", { name: "Go back" }));
    expect(within(dialog).queryByRole("group", { name: /download all 2 questions\?/i })).not.toBeInTheDocument();
    expect(signCalls).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Download PDF without saving" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Download 2" }));
    await waitFor(() => expect(events("pdf_export_success")).toHaveLength(1));
    expect(signCalls).toHaveLength(1);
  });

  it("counts the daily limit as a blocked export, not an error, and shows the server message", async () => {
    const { dialog } = setup(() => Response.json({ error: "Daily worksheet limit reached. Try again tomorrow." }, { status: 429 }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Download PDF without saving" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Download 2" }));
    expect(await within(dialog).findByText("Daily worksheet limit reached. Try again tomorrow.")).toBeInTheDocument();
    expect(events("pdf_export_blocked")).toEqual([expect.objectContaining({ reason: "daily_limit", status: 429, questionCount: 2 })]);
    expect(events("pdf_export_error")).toHaveLength(0);
  });

  it("records a bounded reason for real failures", async () => {
    const { dialog } = setup(() => Response.json({ error: "Private assets are temporarily unavailable" }, { status: 503 }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Download PDF without saving" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Download 2" }));
    await waitFor(() => expect(events("pdf_export_error")).toEqual([expect.objectContaining({ reason: "sign_unavailable", status: 503 })]));
    expect(JSON.stringify(events("pdf_export_error"))).not.toContain("temporarily unavailable");
  });

  it("keeps Download disabled while an export builds and starts only one export", async () => {
    let finish!: () => void;
    download.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ heldRows: [] }); }));
    const { dialog, signCalls } = setup(() => Response.json({ expiresIn: 600, assets: [] }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Download PDF without saving" }));
    const confirmButton = within(dialog).getByRole("button", { name: "Download 2" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole("button", { name: "Download PDF without saving" })).toBeDisabled();
    expect(signCalls).toHaveLength(1);
    await act(async () => { finish(); });
    await waitFor(() => expect(events("pdf_export_success")).toHaveLength(1));
    expect(events("pdf_export_attempt")).toHaveLength(1);
  });
});
