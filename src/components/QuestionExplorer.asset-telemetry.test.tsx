import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const trackProductEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/product-analytics")>()), trackProductEvent }));

import { QuestionExplorer } from "@/components/QuestionExplorer";
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
});
