import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const trackProductEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/product-analytics")>()), trackProductEvent }));

import { QuestionExplorer } from "@/components/QuestionExplorer";
import { fetchFreeAssets, preferSignedFreeAssets } from "@/lib/signed-assets";
import { isPreviewQuestion } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";

const access = { authenticated: true, bankAccess: true, canExportPdf: true };
const entitlement = [{ productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }] as const;
const failures = () => trackProductEvent.mock.calls.filter(([name]) => name === "asset_load_failed").map(([, properties]) => properties);

describe("QuestionExplorer image failure telemetry", () => {
  afterEach(() => { vi.unstubAllGlobals(); trackProductEvent.mockReset(); });

  it("reports an expired link it re-signs, then a real failure, naming the store but not the URL", async () => {
    let issued = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      issued += 1;
      return new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://abc123.r2.cloudflarestorage.com/${request.questionId}-v${issued}.webp?X-Amz-Signature=secret`] })) }), { status: 200 });
    }));
    const [question] = prepareQuestionsForDelivery(loadBankQuestions("igcse").slice(0, 1), [...entitlement]);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={access} />);

    const first = await screen.findByRole("img", { name: /original question/i });
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60_000);
    try {
      fireEvent.error(first);
      await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("-v2.webp"));
      fireEvent.error(screen.getByRole("img", { name: /original question/i }));
    } finally { now.mockRestore(); }

    expect(failures()).toEqual([
      { bank: "igcse", question_id: question.id, kind: "question", outcome: "expired_resign", host: "r2" },
      { bank: "igcse", question_id: question.id, kind: "question", outcome: "failed", host: "r2" },
    ]);
    expect(JSON.stringify(trackProductEvent.mock.calls)).not.toMatch(/secret|abc123/);
  });

  it("reports a mark-scheme image that fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ expiresIn: 600, assets: (body.requests ?? []).map((request: { questionId: string; kind: string }) => ({ ...request, urls: [`https://wrig.supabase.co/${request.questionId}-${request.kind}.webp`] })) }), { status: 200 });
    }));
    const [question] = prepareQuestionsForDelivery(loadBankQuestions("igcse").filter((item) => item.markschemeImageCount > 0).slice(0, 1), [...entitlement]);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={access} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show answer" }));
    fireEvent.error(await screen.findByRole("img", { name: /official mark scheme page 1/i }));
    expect(failures()).toContainEqual({ bank: "igcse", question_id: question.id, kind: "answer", outcome: "failed", host: "supabase" });
  });
  it("retries a failed free image immediately after signer recovery without repeating automatic rescue", async () => {
    const [question] = prepareQuestionsForDelivery(loadBankQuestions("igcse").filter((item) => isPreviewQuestion("igcse", item.id)).slice(0, 1), []);
    const details = { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
    const publicUrl = `https://free.pastpaperprep.com/images/igcse/questions/${question.id}.webp`;
    let recovered = false;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/free-assets/igcse.json") return Response.json({ version: 1, bank: "igcse", questions: { [question.id]: { details, question: { urls: [publicUrl], displayCrops: [null] } } } });
      if (url.startsWith("/api/assets/free?")) return recovered
        ? Response.json({ expiresIn: 3600, maxAge: 900, asset: { questionId: question.id, kind: "question", urls: ["https://wrig.supabase.co/recovered.webp"] } })
        : new Response(null, { status: 503 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} />);
    const image = await screen.findByRole("img", { name: /original question/i });
    fireEvent.error(image);
    fireEvent.error(image);
    await screen.findByRole("button", { name: "Retry images" });
    const signerCalls = () => fetcher.mock.calls.filter(([url]) => String(url).startsWith("/api/assets/free?"));
    expect(signerCalls()).toHaveLength(1);
    recovered = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry images" }));
    // Explicit retry can probe the public object again; if still broken it must start a new rescue.
    const retried = await screen.findByRole("img", { name: /original question/i });
    if (retried.getAttribute("src")?.includes("free.pastpaperprep.com")) fireEvent.error(retried);
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("recovered.webp"));
    expect(signerCalls()).toHaveLength(2);
  });

  it.each(["answer", "explanation"] as const)("explicit %s retry escapes a failed rescue without bypassing cooldown on intent", async (kind) => {
    const [original] = prepareQuestionsForDelivery(loadBankQuestions("igcse").filter((item) => isPreviewQuestion("igcse", item.id) && item.markschemeImageCount > 0).slice(0, 1), []);
    const question = { ...original, hasExplanation: true };
    const details = { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
    const publicUrl = `https://free.pastpaperprep.com/images/igcse/${question.id}.webp`;
    let recovered = false;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/free-assets/igcse.json") return Response.json({ version: 1, bank: "igcse", questions: { [question.id]: { details, question: { urls: [publicUrl], displayCrops: [null] }, explanation: { urls: [publicUrl], displayCrops: [null] } } } });
      if (url === publicUrl) return new Response(null, { status: 404 });
      if (url === "https://wrig.supabase.co/recovered-explanation.json") return Response.json({ schemaVersion: 1, bank: "igcse", questionId: question.id, totalMarks: 1, parts: [{ label: "", marks: 1, approach: "Recovered explanation", steps: [{ text: "Compute it.", marks: ["A1"] }], answer: "4" }] });
      if (url.startsWith("/api/assets/free?")) return recovered
        ? Response.json({ expiresIn: 3600, maxAge: 900, asset: { questionId: question.id, kind, urls: [kind === "answer" ? "https://wrig.supabase.co/recovered-answer.webp" : "https://wrig.supabase.co/recovered-explanation.json"] } })
        : new Response(null, { status: 503 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    // Reproduce a prior public answer failure with the real recovery cache, not a helper mock.
    if (kind === "answer") preferSignedFreeAssets("igcse", { questionId: question.id, kind }, fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} />);
    const buttonName = kind === "answer" ? "Show answer" : "Explanation";
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    await screen.findByText(kind === "answer" ? "The answer could not load. Try again." : "The explanation could not load. Try again.");
    const request = { questionId: question.id, kind };
    await fetchFreeAssets("igcse", [request], fetcher);
    const signerCalls = () => fetcher.mock.calls.filter(([url]) => String(url).startsWith("/api/assets/free?"));
    expect(signerCalls()).toHaveLength(1);
    recovered = true;
    fireEvent.pointerEnter(screen.getByRole("button", { name: buttonName }));
    fireEvent.focus(screen.getByRole("button", { name: buttonName }));
    await fetchFreeAssets("igcse", [request], fetcher);
    expect(signerCalls()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    if (kind === "answer") {
      await waitFor(() => expect(screen.getByRole("img", { name: /official mark scheme page 1/i }).getAttribute("src")).toContain("recovered-answer.webp"));
    } else {
      await screen.findByText("Recovered explanation");
    }
    expect(signerCalls()).toHaveLength(2);
  });

  it("switches a free question to a signed link by itself when its public link fails", async () => {
    const [question] = prepareQuestionsForDelivery(loadBankQuestions("igcse").filter((item) => isPreviewQuestion("igcse", item.id)).slice(0, 1), []);
    const details = { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
    const publicUrl = `https://free.pastpaperprep.com/images/igcse/questions/${question.id}.webp`;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/free-assets/igcse.json") return new Response(JSON.stringify({ version: 1, bank: "igcse", questions: { [question.id]: { details, question: { urls: [publicUrl], displayCrops: [null] } } } }));
      if (url.startsWith("/api/assets/free?")) return new Response(JSON.stringify({ expiresIn: 3600, maxAge: 900, asset: { questionId: question.id, kind: "question", urls: [`https://wrig.supabase.co/${question.id}.webp`] } }));
      return new Response(JSON.stringify({ access: { authenticated: false, bankAccess: false, canExportPdf: false }, studyState: { savedIds: [], attemptedIds: [] } }));
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={{ authenticated: false, bankAccess: false, canExportPdf: false }} />);

    const image = await screen.findByRole("img", { name: /original question/i });
    expect(image.getAttribute("src")).toContain("free.pastpaperprep.com");
    fireEvent.error(image);
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("wrig.supabase.co"));
    expect(screen.queryByText("Some question images could not load.")).toBeNull();
    expect(failures()).toEqual([{ bank: "igcse", question_id: question.id, kind: "question", outcome: "public_fallback", host: "free" }]);
  });
});
