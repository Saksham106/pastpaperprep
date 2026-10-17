import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { isPreviewQuestion, type AccessEntitlement } from "@/lib/access";
import { clearMemberCaches } from "@/lib/member-session-cache";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { accountIdFromCookieHeader, setSessionHint } from "@/lib/supabase/auth-cookie";

// Real-shaped Supabase session cookies: the account id is what tells A and B apart.
const A = "7f1b6a2e-0000-4000-8000-00000000000a";
const B = "7f1b6a2e-0000-4000-8000-00000000000b";
const COOKIE = "sb-switch-auth-token";
function signIn(id: string, token = "t1") {
  document.cookie = `${COOKIE}=base64-${Buffer.from(JSON.stringify({ access_token: token, user: { id } })).toString("base64url")}; path=/`;
  setSessionHint(true);
}
/** Replace the cookie with no signed-out moment in between, then let the page notice. */
function switchTo(id: string, token = "t1") {
  signIn(id, token);
  window.dispatchEvent(new Event("focus"));
}
const current = () => accountIdFromCookieHeader(document.cookie) === B ? "B" : "A";

const paid = { authenticated: true, bankAccess: true, canExportPdf: true };
const anonymous = { authenticated: false, bankAccess: false, canExportPdf: false };
const entitlement: AccessEntitlement[] = [{ productId: "bundle_all", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: null }];
const question = prepareQuestionsForDelivery([{ ...loadBankQuestions("ib-sl").find((q) => !isPreviewQuestion("ib-sl", q.id))!, hasExplanation: true }], entitlement)[0];
const member = () => Response.json({ access: paid, studyState: { savedIds: [question.id], attemptedIds: [question.id] } });
function deferred() { let resolve!: (r: Response) => void; const promise = new Promise<Response>((r) => { resolve = r; }); return { promise, resolve }; }
function signed(init: RequestInit | undefined, label: string) {
  const { requests } = JSON.parse(String(init?.body));
  return Response.json({ expiresIn: 600, assets: requests.map((r: { questionId: string; kind: string }) => ({
    ...r,
    urls: [r.kind === "explanation" ? `https://r2.example/explanations/${label}.json` : `https://assets.example/${label}-${r.kind}.webp`],
    details: { summary: `private ${label}`, accessibleText: `private ${label}`, solution: `solution ${label}`, sourceQuestionUrl: null, sourceMarkSchemeUrl: null },
  })) });
}
const signBodies = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls
  .filter(([url]) => String(url) === "/api/assets/sign")
  .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { requests: Array<{ questionId: string; kind: string }> });

describe("QuestionExplorer account switch without a signed-out interval", () => {
  beforeEach(() => { clearMemberCaches(); signIn(A); window.history.replaceState({}, "", "/banks/ib-sl"); });
  afterEach(() => { cleanup(); document.cookie = `${COOKIE}=; Max-Age=0; path=/`; setSessionHint(false); clearMemberCaches(); vi.unstubAllGlobals(); });

  it("clears A's images, transcript, open answer and study state when B replaces A", async () => {
    let bootstraps = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => String(url) === "/member"
      ? (++bootstraps, member()) : signed(init, current()));
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/member" />);
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("A-question"));
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await screen.findByRole("img", { name: /official mark scheme/i });
    expect(screen.getByText("Practised")).toBeTruthy();
    expect(screen.getByText("private A")).toBeTruthy();

    act(() => switchTo(B));
    expect(screen.queryByText("private A")).toBeNull();
    expect(screen.queryByText("Practised")).toBeNull();
    expect(screen.queryByRole("img", { name: /official mark scheme/i })).toBeNull();
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("B-question"));
    expect(bootstraps).toBe(2);
    expect(screen.queryByRole("button", { name: "Hide answer" })).toBeNull();
  });

  it("does not finish A's explanation under B: no follow-up read, nothing shown", async () => {
    const late = deferred();
    let explanationInit: RequestInit | undefined;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return member();
      if (String(url).startsWith("https://r2.example/")) return Response.json({});
      const { requests } = JSON.parse(String(init?.body));
      if (requests[0].kind === "explanation") { explanationInit = init; return late.promise; }
      return signed(init, current());
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={paid} bootstrapUrl="/member" />);
    fireEvent.click(await screen.findByRole("button", { name: "Explanation" }));
    await waitFor(() => expect(explanationInit).toBeDefined());
    signIn(B); // unobserved: no event yet
    await act(async () => late.resolve(signed(explanationInit, "A")));
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith("https://r2.example/"))).toHaveLength(0);
    expect(fetcher.mock.calls.filter(([url]) => String(url) === "/api/study-state")).toHaveLength(0);
    expect(screen.queryByText("The explanation could not load. Try again.")).toBeNull();
  });

  it("does not sign an explanation or record study state for A after an unobserved switch to B", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return member();
      if (String(url) === "/api/study-state") return Response.json({});
      return signed(init, current());
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={paid} bootstrapUrl="/member" />);
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("A-question"));
    const explanationButton = screen.getByRole("button", { name: "Explanation" });
    const saveButton = screen.getByRole("button", { name: /remove question from saved/i });
    signIn(B); // the old page is still on screen
    await act(async () => { fireEvent.click(explanationButton); fireEvent.click(saveButton); });
    expect(signBodies(fetcher).filter(({ requests }) => requests.some((r) => r.kind === "explanation"))).toHaveLength(0);
    expect(fetcher.mock.calls.filter(([url]) => String(url) === "/api/study-state")).toHaveLength(0);
  });

  it("discards A's late signer after A-B-A and shows only the newest A generation", async () => {
    const late = deferred();
    let firstInit: RequestInit | undefined;
    let signing = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return member();
      if (++signing === 1) { firstInit = init; return late.promise; }
      return signed(init, `generation-${signing}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/member" />);
    await waitFor(() => expect(signing).toBe(1));
    act(() => switchTo(B));
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("generation-2"));
    act(() => switchTo(A));
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("generation-3"));
    await act(async () => late.resolve(signed(firstInit, "old-A")));
    expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("generation-3");
    expect(screen.queryByText("private old-A")).toBeNull();
  });

  it("keeps the open page through a same-account token refresh", async () => {
    let bootstraps = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => String(url) === "/member"
      ? (++bootstraps, member()) : signed(init, "A"));
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/member" />);
    await screen.findByRole("img", { name: /original question/i });
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await screen.findByRole("button", { name: "Hide answer" });
    const signs = signBodies(fetcher).length;
    act(() => switchTo(A, "t2"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByRole("button", { name: "Hide answer" })).toBeTruthy();
    expect(screen.getByText("Practised")).toBeTruthy();
    expect(signBodies(fetcher)).toHaveLength(signs);
    expect(bootstraps).toBe(1);
  });
});

describe("QuestionExplorer partial signing failure", () => {
  beforeEach(() => { clearMemberCaches(); signIn(A); window.history.replaceState({}, "", "/banks/ib-sl?free=0"); });
  afterEach(() => { cleanup(); document.cookie = `${COOKIE}=; Max-Age=0; path=/`; setSessionHint(false); clearMemberCaches(); vi.unstubAllGlobals(); });

  it.each([503, 429])("shows the batch that signed and retries only the %s batch's keys", async (status) => {
    const questions = loadBankQuestions("ib-sl").filter((q) => !isPreviewQuestion(q.bankSlug, q.id)).slice(0, 24);
    let calls = 0;
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { requests } = JSON.parse(String(init?.body));
      if (++calls === 1 && requests.length === 20) return Response.json({ error: "Busy" }, { status });
      return signed(init, "A");
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={paid} initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} hydrateFromLocation />);
    await screen.findByText("Some question images could not load.");
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(4));
    const firstRound = signBodies(fetcher).map(({ requests }) => requests.length);
    expect(firstRound).toEqual([20, 4]);
    const failedIds = signBodies(fetcher)[0].requests.map((r) => r.questionId);

    fireEvent.click(screen.getByRole("button", { name: /try again|retry/i }));
    await waitFor(() => expect(screen.getAllByRole("img", { name: /original question/i })).toHaveLength(24));
    const retried = signBodies(fetcher).slice(2).flatMap(({ requests }) => requests.map((r) => r.questionId));
    expect(retried.sort()).toEqual([...failedIds].sort());
    // 24 questions, 24 successful signatures: nothing signed twice.
    expect(signBodies(fetcher).slice(1).reduce((sum, { requests }) => sum + requests.length, 0)).toBe(24);
  });
});
