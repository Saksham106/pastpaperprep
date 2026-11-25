import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<object>()), trackProductEvent: vi.fn() }));

import { QuestionExplorer } from "@/components/QuestionExplorer";
import { trackProductEvent } from "@/lib/product-analytics";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { freeAssetResponse, isFreeAssetRequest } from "../../test/free-asset-fetch";

const questions = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 60), []);
const track = vi.mocked(trackProductEvent);
const eventsNamed = (name: string) => track.mock.calls.filter(([event]) => event === name);

describe("question list telemetry", () => {
  beforeEach(() => {
    track.mockClear();
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/banks/igcse");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => isFreeAssetRequest(input) ? freeAssetResponse(input) : new Response("{}", { status: 200 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const renderExplorer = () => render(<QuestionExplorer questions={questions} bankSlug="igcse" access={{ authenticated: true, bankAccess: true, canExportPdf: true }} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);

  it("counts how far the list was opened with Show more", () => {
    renderExplorer();
    fireEvent.click(screen.getByRole("button", { name: "Show 24 more questions" }));
    expect(eventsNamed("question_list_more")).toEqual([["question_list_more", { bank: "igcse", shown: 48 }]]);
  });

  it("reports a search that leaves nothing once it settles, without the search text", async () => {
    renderExplorer();
    const input = screen.getByRole("textbox", { name: "Search questions" });
    fireEvent.change(input, { target: { value: "zzqx" } });
    fireEvent.change(input, { target: { value: "zzqxv" } });
    await vi.waitFor(() => expect(eventsNamed("question_list_empty")).toHaveLength(1), { timeout: 3000 });
    expect(eventsNamed("question_list_empty")[0]).toEqual(["question_list_empty", { bank: "igcse", filters: 0, search: true, freeOnly: false }]);
    expect(JSON.stringify(track.mock.calls)).not.toContain("zzqx");
  });

  it("stays quiet when the list was never filtered by the student", async () => {
    render(<QuestionExplorer questions={[]} bankSlug="igcse" access={{ authenticated: true, bankAccess: true, canExportPdf: true }} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} />);
    await new Promise(resolve => setTimeout(resolve, 900));
    expect(eventsNamed("question_list_empty")).toHaveLength(0);
  });
});
