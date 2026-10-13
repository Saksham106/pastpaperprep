import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { isPreviewQuestion } from "@/lib/access";
import { clearMemberCaches } from "@/lib/member-session-cache";
import { setSessionHint } from "@/lib/supabase/auth-cookie";

const mocks = vi.hoisted(() => ({ download: vi.fn(), saved: vi.fn(), track: vi.fn() }));
vi.mock("@/lib/pdf-export", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/pdf-export")>(),
  downloadQuestionPdf: mocks.download,
}));
vi.mock("@/lib/product-analytics", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/product-analytics")>(),
  trackProductEvent: mocks.track,
}));
const paid = { authenticated: true, bankAccess: true, canExportPdf: true };
const question = loadBankQuestions("ib-sl").find((q) => !isPreviewQuestion(q.bankSlug, q.id))!;
function owner(value: string) { document.cookie = `sb-signerscope-auth-token=${value}; path=/`; setSessionHint(true); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const pdfResponse = () => Response.json({ expiresIn: 600, assets: [{ questionId: question.id, kind: "question", urls: ["https://signed.test/q.webp"] }] });
beforeEach(async () => { await import("@/lib/pdf-export"); clearMemberCaches(); owner("A"); window.history.replaceState({}, "", "/banks/ib-sl?free=0"); mocks.download.mockReset(); mocks.saved.mockReset(); mocks.track.mockReset(); });
afterEach(() => { cleanup(); document.cookie = "sb-signerscope-auth-token=; Max-Age=0; path=/"; setSessionHint(false); clearMemberCaches(); vi.unstubAllGlobals(); });
function mount(pdf: Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === "/api/pdf/sign") return pdf;
    const { requests } = JSON.parse(String(init?.body));
    return Response.json({ expiresIn: 600, assets: requests.map((r: object) => ({ ...r, urls: ["https://signed.test/q.webp"] })) });
  }));
  render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={paid} />);
  fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
  fireEvent.click(screen.getByRole("radio", { name: "Questions" }));
  fireEvent.click(screen.getByRole("button", { name: "Download PDF without saving" }));
}
it.each([true, false])("abandons PDF authorization after an unobserved sign-out, success=%s", async (success) => {
  const pending = deferred<Response>();
  mocks.download.mockResolvedValue({ heldRows: [] });
  mount(pending.promise);
  await waitFor(() => expect(mocks.track).toHaveBeenCalledWith("pdf_export_attempt", expect.anything()));
  // No observation event: the captured predicate must still notice the sign-out.
  document.cookie = "sb-signerscope-auth-token=; Max-Age=0; path=/";
  await act(async () => pending.resolve(success ? pdfResponse() : Response.json({ error: "Old private error" }, { status: 403 })));
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.track.mock.calls.map(([event]) => event)).not.toContain("pdf_export_error");
  expect(mocks.track.mock.calls.map(([event]) => event)).not.toContain("pdf_export_success");
  expect(screen.queryByText("Old private error")).toBeNull();
  expect(window.location.search).not.toContain("worksheet=");
});
it("cancels PDF generation at its progress boundary before the final save", async () => {
  const generating = deferred<void>();
  mocks.download.mockImplementation(async (_questions, _content, progress) => {
    await generating.promise;
    // The real exporter reports its final progress synchronously before pdf.save.
    progress(1, 1);
    mocks.saved();
    return { heldRows: [] };
  });
  mount(Promise.resolve(pdfResponse()));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
  document.cookie = "sb-signerscope-auth-token=; Max-Age=0; path=/";
  await act(async () => generating.resolve());
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(mocks.track.mock.calls.map(([event]) => event)).not.toContain("pdf_export_error");
  expect(mocks.track.mock.calls.map(([event]) => event)).not.toContain("pdf_export_success");
});
