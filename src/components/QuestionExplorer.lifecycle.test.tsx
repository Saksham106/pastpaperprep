import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { isPreviewQuestion } from "@/lib/access";
import { clearMemberCaches, readCachedAccess, readCachedAssets, rememberAssets, sessionFingerprint } from "@/lib/member-session-cache";
import { setSessionHint } from "@/lib/supabase/auth-cookie";

const paid = { authenticated: true, bankAccess: true, canExportPdf: true };
const anonymous = { authenticated: false, bankAccess: false, canExportPdf: false };
const question = loadBankQuestions("igcse").find((q) => !isPreviewQuestion(q.bankSlug, q.id))!;
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const member = (access = paid) => response({ access, studyState: { savedIds: [question.id], attemptedIds: [question.id] } });
function deferred() { let resolve!: (r: Response) => void; const promise = new Promise<Response>((r) => { resolve = r; }); return { promise, resolve }; }
function owner(value: string | null) {
  document.cookie = value ? `sb-lifecycle-auth-token=${value}; path=/` : "sb-lifecycle-auth-token=; Max-Age=0; path=/";
  setSessionHint(Boolean(value));
}
function signed(init: RequestInit | undefined, label: string) {
  const { requests } = JSON.parse(String(init?.body));
  return response({ expiresIn: 600, assets: requests.map((r: object) => ({ ...r, urls: [`https://assets.example/${label}.webp`], details: { summary: `private ${label}`, accessibleText: `private ${label}`, solution: label, sourceQuestionUrl: null, sourceMarkSchemeUrl: null } })) });
}

describe("QuestionExplorer session lifecycle", () => {
  beforeEach(() => { clearMemberCaches(); owner("A"); window.history.replaceState({}, "", "/banks/igcse"); });
  afterEach(() => { cleanup(); owner(null); clearMemberCaches(); vi.unstubAllGlobals(); Reflect.deleteProperty(window, "cookieStore"); });

  it("observes mounted signout, removes private images and does not fetch anonymous member state", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => String(url) === "/member" ? member() : signed(init, "A"));
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    await screen.findByRole("img", { name: /original question/i });
    act(() => owner(null));
    await waitFor(() => expect(screen.queryByRole("img", { name: /original question/i })).toBeNull());
    expect(fetcher.mock.calls.filter(([url]) => url === "/member")).toHaveLength(1);
  });

  it("still isolates mounted sessions when platform randomness is unavailable", async () => {
    const randomness = vi.spyOn(crypto, "randomUUID").mockImplementation(() => { throw new Error("randomness unavailable"); });
    try {
      const pendingB = deferred();
      let bootstraps = 0;
      const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => String(url) === "/member"
        ? (++bootstraps === 1 ? member() : pendingB.promise) : signed(init, "A"));
      vi.stubGlobal("fetch", fetcher);
      render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
      await screen.findByRole("img", { name: /original question/i });
      act(() => owner("B"));
      await waitFor(() => expect(screen.queryByRole("img", { name: /original question/i })).toBeNull());
      expect(bootstraps).toBe(2);
      await act(async () => pendingB.resolve(member(anonymous)));
    } finally { randomness.mockRestore(); }
  });

  it("does not let an unobserved stale image error evict the next owner's fresh link", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => signed(init, "A")));
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={paid} />);
    const oldImage = await screen.findByRole("img", { name: /original question/i });
    document.cookie = "sb-lifecycle-auth-token=B; path=/";
    const b = sessionFingerprint(document.cookie)!;
    const key = `${question.id}:question`;
    rememberAssets(b, "igcse", new Map([[key, { questionId: question.id, kind: "question", urls: ["https://assets.example/B.webp"], expiresAt: Date.now() + 600_000 }]]));
    expect(readCachedAssets(b, "igcse").size).toBe(1);
    await act(async () => { fireEvent.error(oldImage); });
    expect(readCachedAssets(b, "igcse").size).toBe(1);
  });

  it("rejects A's late parallel batches without issuing any new batch under B", async () => {
    const questions = loadBankQuestions("ib-sl").filter((q) => !isPreviewQuestion(q.bankSlug, q.id)).slice(0, 24);
    const late = deferred();
    let firstInit: RequestInit | undefined;
    const batches: Array<{ owner: string; count: number }> = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return member();
      const { requests } = JSON.parse(String(init?.body));
      batches.push({ owner: document.cookie, count: requests.length });
      if (batches.length === 1) { firstInit = init; return late.promise; }
      return signed(init, "B");
    });
    vi.stubGlobal("fetch", fetcher);
    window.history.replaceState({}, "", "/banks/ib-sl?free=0");
    render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={anonymous} bootstrapUrl="/member" initialState={{ search: "", sort: "paper", filters: {}, freeOnly: false, savedOnly: false, courseRoute: "all", visible: 24 }} hydrateFromLocation />);
    await waitFor(() => expect(batches).toHaveLength(2));
    act(() => owner("B"));
    await waitFor(() => expect(batches).toHaveLength(4));
    await act(async () => late.resolve(signed(firstInit, "A")));
    expect(batches.map(({ count }) => count)).toEqual([20, 4, 20, 4]);
    expect(batches.slice(0, 2).every(({ owner }) => owner.includes("=A"))).toBe(true);
    expect(batches.slice(2).every(({ owner }) => owner.includes("=B"))).toBe(true);
    expect(JSON.stringify([...readCachedAssets(sessionFingerprint(document.cookie)!, "ib-sl").values()])).not.toContain("private A");
  });

  it("starts B's signer without awaiting A and discards A's late links and rich details", async () => {
    const late = deferred();
    let firstInit: RequestInit | undefined;
    let signing = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return member();
      if (++signing === 1) { firstInit = init; return late.promise; }
      return signed(init, "B");
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    await waitFor(() => expect(signing).toBe(1));
    act(() => owner("B"));
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("B.webp"));
    await act(async () => late.resolve(signed(firstInit, "A")));
    expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("B.webp");
    expect(JSON.stringify([...readCachedAssets(sessionFingerprint(document.cookie)!, "igcse").values()])).not.toContain("private A");
    expect(fetcher.mock.calls.filter(([url]) => url === "/member")).toHaveLength(2);
  });

  it("discards a bootstrap that finishes after signout even before an observation event", async () => {
    const late = deferred();
    const originalOwner = sessionFingerprint(document.cookie)!;
    const fetcher = vi.fn(() => late.promise);
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    document.cookie = "sb-lifecycle-auth-token=; Max-Age=0; path=/";
    await act(async () => late.resolve(member()));
    expect(screen.queryByRole("img", { name: /original question/i })).toBeNull();
    expect(readCachedAccess("igcse", originalOwner)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("clears A's saved, practised, transcript and open-answer state while B bootstraps", async () => {
    const next = deferred();
    let bootstraps = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => String(url) === "/member"
      ? (++bootstraps === 1 ? member() : next.promise) : signed(init, "A"));
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    await screen.findByRole("img", { name: /original question/i });
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await screen.findByRole("img", { name: /official mark scheme/i });
    expect(screen.getByRole("button", { name: /remove question from saved/i })).toBeTruthy();
    expect(screen.getByText("Practised")).toBeTruthy();
    act(() => owner("B"));
    expect(screen.queryByText("Practised")).toBeNull();
    expect(screen.queryByRole("button", { name: /remove question from saved/i })).toBeNull();
    expect(screen.queryByText("private A")).toBeNull();
    expect(screen.queryByRole("img", { name: /official mark scheme/i })).toBeNull();
    await act(async () => next.resolve(response({ access: paid, studyState: { savedIds: [], attemptedIds: [] } })));
    await screen.findByRole("button", { name: `Save question ${question.id}` });
    expect(screen.queryByRole("button", { name: "Hide answer" })).toBeNull();
  });

  it("fences a late signer across a bank-generation remount", async () => {
    const late = deferred();
    const other = loadBankQuestions("ib-sl").find((q) => !isPreviewQuestion(q.bankSlug, q.id))!;
    let firstInit: RequestInit | undefined;
    const originalOwner = sessionFingerprint(document.cookie)!;
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { bank } = JSON.parse(String(init?.body));
      if (bank === "igcse") { firstInit = init; return late.promise; }
      return signed(init, "other-bank");
    });
    vi.stubGlobal("fetch", fetcher);
    const mounted = render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={paid} />);
    await waitFor(() => expect(firstInit).toBeDefined());
    mounted.rerender(<QuestionExplorer questions={[other]} bankSlug="ib-sl" access={paid} />);
    await screen.findByRole("img", { name: /original question/i });
    await act(async () => late.resolve(signed(firstInit, "old-bank")));
    expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("other-bank");
    expect(readCachedAssets(originalOwner, "igcse").size).toBe(0);
  });

  it("does not revive an old mount's signer after an A-B-A owner sequence", async () => {
    const late = deferred();
    let firstInit: RequestInit | undefined;
    let signing = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return member();
      signing += 1;
      if (signing === 1) { firstInit = init; return late.promise; }
      return signed(init, `generation-${signing}`);
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    await waitFor(() => expect(signing).toBe(1));
    act(() => owner("B"));
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("generation-2"));
    act(() => owner("A"));
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("generation-3"));
    await act(async () => late.resolve(signed(firstInit, "revived-old-A")));
    expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("generation-3");
    expect(JSON.stringify([...readCachedAssets(sessionFingerprint(document.cookie)!, "igcse").values()])).not.toContain("revived-old-A");
  });

  it.each([true, false])("abandons an answer after unobserved cookie turnover, success=%s", async (success) => {
    const late = deferred();
    let answerInit: RequestInit | undefined;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return member();
      const { requests } = JSON.parse(String(init?.body));
      if (requests[0].kind === "answer") { answerInit = init; return late.promise; }
      return signed(init, "A");
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    fireEvent.click(await screen.findByRole("button", { name: "Show answer" }));
    await waitFor(() => expect(answerInit).toBeDefined());
    document.cookie = "sb-lifecycle-auth-token=B; path=/";
    await act(async () => late.resolve(success ? signed(answerInit, "answer-A") : response({ error: "Old answer error" })));
    expect(screen.queryByRole("button", { name: "Hide answer" })).toBeNull();
    expect(screen.queryByText("The answer could not load. Try again.")).toBeNull();
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/study-state")).toHaveLength(0);
  });

  it("does not record A's late answer against the current account", async () => {
    const late = deferred();
    let answerInit: RequestInit | undefined;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === "/member") return response({ access: paid, studyState: { savedIds: [], attemptedIds: [] } });
      if (String(url) === "/api/study-state") return response({});
      const { requests } = JSON.parse(String(init?.body));
      if (requests[0].kind === "answer") { answerInit = init; return late.promise; }
      return signed(init, "A");
    });
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    fireEvent.click(await screen.findByRole("button", { name: "Show answer" }));
    await waitFor(() => expect(answerInit).toBeDefined());
    act(() => owner("B"));
    await screen.findByRole("button", { name: "Show answer" });
    await act(async () => late.resolve(signed(answerInit, "answer-A")));
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/study-state")).toHaveLength(0);
    expect(screen.queryByRole("img", { name: /official mark scheme/i })).toBeNull();
  });

  it.each(["focus", "visibilitychange", "cookieStore"])("observes cookie changes through %s without polling auth", async (observation) => {
    const cookieStore = new EventTarget();
    if (observation === "cookieStore") Object.defineProperty(window, "cookieStore", { configurable: true, value: cookieStore });
    let bootstraps = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => String(url) === "/member"
      ? (++bootstraps, member()) : signed(init, bootstraps === 1 ? "A" : "B"));
    vi.stubGlobal("fetch", fetcher);
    const mounted = render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={anonymous} bootstrapUrl="/member" />);
    await screen.findByRole("img", { name: /original question/i });
    const notify = () => observation === "cookieStore" ? cookieStore.dispatchEvent(new Event("change"))
      : observation === "visibilitychange" ? document.dispatchEvent(new Event(observation)) : window.dispatchEvent(new Event(observation));
    act(notify);
    expect(bootstraps).toBe(1);
    document.cookie = "sb-lifecycle-auth-token=B; path=/";
    act(notify);
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("B.webp"));
    expect(bootstraps).toBe(2);
    mounted.unmount();
    if (observation === "cookieStore") Reflect.deleteProperty(window, "cookieStore");
  });

  it("never adopts private assets belonging to the anonymous fallback owner", async () => {
    owner(null);
    rememberAssets("anonymous", "igcse", new Map([[`${question.id}:question`, { questionId: question.id, kind: "question", urls: ["https://assets.example/foreign.webp"], expiresAt: Date.now() + 600_000 }]]));
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => signed(init, "fresh"));
    vi.stubGlobal("fetch", fetcher);
    render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={paid} />);
    await waitFor(() => expect(screen.getByRole("img", { name: /original question/i }).getAttribute("src")).toContain("fresh.webp"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
