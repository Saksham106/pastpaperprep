import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QuestionExplorer } from "@/components/QuestionExplorer";
import { publicMetadataToQuestion } from "@/lib/question-index";
import { clearMemberCaches, readCachedAssets, rememberAssets, sessionFingerprint } from "@/lib/member-session-cache";
import { signedAssetKey, type SignedAsset } from "@/lib/signed-assets";
import { setSessionHint } from "@/lib/supabase/auth-cookie";

const trackProductEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/product-analytics")>(), trackProductEvent,
}));
const cookie = "sb-delivery-auth-token";
function signIn(suffix: "a" | "b", notify = true) {
  document.cookie = `${cookie}=base64-${Buffer.from(JSON.stringify({ access_token: suffix, user: { id: `7f1b6a2e-0000-4000-8000-00000000000${suffix}` } })).toString("base64url")}; path=/`;
  if (notify) setSessionHint(true);
  return sessionFingerprint(document.cookie)!;
}

const access = { authenticated: true, bankAccess: true, canExportPdf: true };
const dailyLimit = "Daily download limit reached. Try again tomorrow.";
const privateError = "Private upstream bucket token=secret";
// Metadata-only fixture: exercise the real mounted explorer and signer, not a corpus loader.
const question = publicMetadataToQuestion({
  id: "0580-2025-march-22-q1", number: 1, paper: 2, year: 2025, session: "s",
  primaryTopic: "Algebra", secondaryTopics: [], skills: [], subtopics: [], granularLabels: [],
  subject: "Mathematics", option: "", zone: "1", component: "21", calculator: true,
  marks: 2, questionImageCount: 1, markschemeImageCount: 1,
}, "igcse");
type Request = { questionId: string; kind: string };
const signed = (requests: Request[]) => Response.json({ expiresIn: 3600, assets: requests.map((request) => ({
  ...request, urls: [`https://wrig.supabase.co/${request.questionId}-${request.kind}.webp`],
})) });
beforeEach(() => { clearMemberCaches(); trackProductEvent.mockReset(); window.history.replaceState({}, "", "/banks/igcse"); });
afterEach(() => {
  cleanup(); document.cookie = `${cookie}=; Max-Age=0; path=/`; setSessionHint(false);
  clearMemberCaches(); vi.unstubAllGlobals();
});

it.each(["question", "answer"])("preserves approved daily-limit guidance for %s signing", async (kind) => {
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const { requests = [] } = JSON.parse(String(init?.body ?? "{}")) as { requests?: Request[] };
    return requests.some((r) => r.kind === kind)
      ? Response.json({ error: dailyLimit }, { status: 429 }) : signed(requests);
  }));
  render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={access} />);
  if (kind === "answer") fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
  expect(await screen.findByText(dailyLimit)).toBeInTheDocument();
});

it("closes a broken paid answer and signs again only on each explicit Show answer", async () => {
  let answers = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/study-state") return Response.json({});
    const { requests = [] } = JSON.parse(String(init?.body ?? "{}")) as { requests?: Request[] };
    return Response.json({ expiresIn: 3600, assets: requests.map((r) => ({
      ...r, urls: [`https://wrig.supabase.co/${r.kind}-${r.kind === "answer" ? ++answers : 1}.webp`],
    })) });
  });
  vi.stubGlobal("fetch", fetcher);
  const owner = signIn("a");
  render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={access} />);
  await screen.findByRole("img", { name: /original question/i });
  const key = signedAssetKey(question.id, "answer");
  const unrelated: SignedAsset = { questionId: "other", kind: "answer", urls: ["https://wrig.supabase.co/other.webp"], expiresAt: Date.now() + 3600_000 };
  for (let attempt = 1; attempt <= 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    const image = await screen.findByRole("img", { name: "Official mark scheme page 1" });
    expect(image).toHaveAttribute("src", `https://wrig.supabase.co/answer-${attempt}.webp`);
    // The per-tab cache can also hold this same link; only this member's exact link is evicted.
    rememberAssets(owner, "igcse", new Map([
      [key, { questionId: question.id, kind: "answer", urls: [image.getAttribute("src")!], expiresAt: Date.now() + 3600_000 }],
      [signedAssetKey("other", "answer"), unrelated],
    ]));
    fireEvent.error(image);
    expect(screen.queryByRole("img", { name: "Official mark scheme page 1" })).toBeNull();
    expect(screen.getByText("The answer could not load. Try again.")).toBeInTheDocument();
    expect(readCachedAssets(owner, "igcse").has(key)).toBe(false);
    expect(readCachedAssets(owner, "igcse").get(signedAssetKey("other", "answer"))).toBe(unrelated);
    const button = screen.getByRole("button", { name: "Show answer" });
    fireEvent.pointerEnter(button); fireEvent.focus(button); fireEvent.touchStart(button);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    expect(answers).toBe(attempt);
  }
  expect(trackProductEvent.mock.calls.filter(([name]) => name === "asset_load_failed").map(([, properties]) => properties)).toEqual([
    expect.objectContaining({ bank: "igcse", question_id: question.id, kind: "answer", outcome: "failed", host: "supabase" }),
    expect.objectContaining({ bank: "igcse", question_id: question.id, kind: "answer", outcome: "failed", host: "supabase" }),
  ]);
});

it("does not evict a newer exact-key cache link when the displayed link fails", async () => {
  const owner = signIn("a");
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => signed(JSON.parse(String(init?.body ?? "{}")).requests ?? [])));
  render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={access} />);
  fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
  const image = await screen.findByRole("img", { name: "Official mark scheme page 1" });
  const key = signedAssetKey(question.id, "answer");
  const newer: SignedAsset = { questionId: question.id, kind: "answer", urls: ["https://wrig.supabase.co/newer.webp"], expiresAt: Date.now() + 3600_000 };
  rememberAssets(owner, "igcse", new Map([[key, newer]]));
  fireEvent.error(image);
  expect(readCachedAssets(owner, "igcse").get(key)).toBe(newer);
});

it("ignores an old answer error after an unobserved account switch, even with the same URL", async () => {
  signIn("a");
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => signed(JSON.parse(String(init?.body ?? "{}")).requests ?? [])));
  render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={access} />);
  fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
  const image = await screen.findByRole("img", { name: "Official mark scheme page 1" });
  const ownerB = signIn("b", false); // no focus/session event: A's image is still mounted
  const key = signedAssetKey(question.id, "answer");
  const assetB: SignedAsset = { questionId: question.id, kind: "answer", urls: [image.getAttribute("src")!], expiresAt: Date.now() + 3600_000 };
  rememberAssets(ownerB, "igcse", new Map([[key, assetB]]));
  trackProductEvent.mockClear();
  fireEvent.error(image);
  expect(readCachedAssets(ownerB, "igcse").get(key)).toBe(assetB);
  expect(screen.queryByText("The answer could not load. Try again.")).toBeNull();
  expect(trackProductEvent.mock.calls.filter(([name]) => name === "asset_load_failed")).toHaveLength(0);
});

it("keeps automatic public-to-signed free-answer fallback without a paid signing request", async () => {
  const freeQuestion = { ...question, id: "0580-2016-march-22-q1", year: 2016 };
  const publicUrl = "https://free.pastpaperprep.com/images/igcse/answers/free.webp";
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/free-assets/igcse.json") return Response.json({ version: 1, bank: "igcse", questions: {
      [freeQuestion.id]: { details: { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null },
        question: { urls: [publicUrl.replace("answers", "questions")], displayCrops: [null] },
        answer: { urls: [publicUrl] } },
    } });
    if (url.startsWith("/api/assets/free?")) return Response.json({ expiresIn: 3600, maxAge: 0, asset: { questionId: freeQuestion.id, kind: "answer", urls: ["https://wrig.supabase.co/free-answer.webp"] } });
    return Response.json({});
  });
  vi.stubGlobal("fetch", fetcher);
  render(<QuestionExplorer questions={[freeQuestion]} bankSlug="igcse" access={access} />);
  fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
  const image = await screen.findByRole("img", { name: "Official mark scheme page 1" });
  expect(image).toHaveAttribute("src", publicUrl);
  fireEvent.error(image);
  await waitFor(() => expect(screen.getByRole("img", { name: "Official mark scheme page 1" })).toHaveAttribute("src", "https://wrig.supabase.co/free-answer.webp"));
  expect(screen.getByRole("button", { name: "Hide answer" })).toBeInTheDocument();
  expect(screen.queryByText("The answer could not load. Try again.")).toBeNull();
  expect(fetcher.mock.calls.filter(([url]) => String(url) === "/api/assets/sign")).toHaveLength(0);
});

it.each(["question", "answer"])("does not expose arbitrary upstream %s signing errors", async (kind) => {
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const { requests = [] } = JSON.parse(String(init?.body ?? "{}")) as { requests?: Request[] };
    return requests.some((r) => r.kind === kind)
      ? Response.json({ error: privateError }, { status: 429 }) : signed(requests);
  }));
  render(<QuestionExplorer questions={[question]} bankSlug="igcse" access={access} />);
  if (kind === "answer") fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
  await screen.findByText(kind === "answer" ? "The answer could not load. Try again." : "Some question images could not load.");
  expect(screen.queryByText(privateError)).toBeNull();
});
