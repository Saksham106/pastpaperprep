import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_INDEX_VERSION, subjectTerms, type SearchIndex, type SearchPapers } from "@/lib/site-search";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const index: SearchIndex = {
  version: SEARCH_INDEX_VERSION,
  subjects: [
    { bank: "igcse", name: "IGCSE Maths 0580", qualification: "igcse", practiceHref: "/banks/igcse?free=1", questionCount: 3967, papersHref: "/past-papers/igcse-maths-0580", paperCount: 216, terms: subjectTerms("IGCSE Maths 0580", "Mathematics", "0580", "Cambridge IGCSE") },
    { bank: "ib-chemistry-hl", name: "IB Chemistry HL", qualification: "ib", practiceHref: "/banks/ib-chemistry-hl?free=1", questionCount: 1872, papersHref: "/past-papers/ib-chemistry-hl", paperCount: 84, terms: subjectTerms("IB Chemistry HL", "Chemistry", "Higher Level", "IB Diploma") },
  ],
  topics: [],
};
const papers: SearchPapers = {
  version: SEARCH_INDEX_VERSION,
  papers: [{ id: "0580-2024-june-42", bankSlug: "igcse", qualification: "Cambridge IGCSE", syllabusCode: "0580", year: 2024, session: "May/June", sessionCode: "s", component: "42", paper: "4", variant: "2", route: "Extended", href: "/past-papers/igcse-maths-0580/2024-may-june-42", title: "IGCSE Maths 0580/42 May/June 2024", detail: "Paper 42" }],
};

/** fetch for the two search files; the paper list answers only when the test says so. */
function serve(papersResponse: Promise<SearchPapers | null>) {
  vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("index.json")
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(index) })
    : papersResponse.then(value => value ? { ok: true, json: () => Promise.resolve(value) } : { ok: false, json: () => Promise.resolve(null) })));
}
// The component caches the files per tab, so each test loads a fresh module.
async function mount() {
  vi.resetModules();
  const { SmartSearch } = await import("@/components/SmartSearch");
  const view = render(<SmartSearch />);
  return Object.assign(screen.getByRole("combobox"), { unmount: view.unmount });
}
/** Submit a paper code while the paper list is still on its way; returns the hand that answers it. */
async function pendingPaperSubmit() {
  let answer!: (value: SearchPapers) => void;
  serve(new Promise(resolve => { answer = resolve; }));
  const box = await mount();
  const user = userEvent.setup();
  await user.type(box, "0580/42/M/J/24");
  await screen.findByRole("option", { name: /IGCSE Maths 0580.*by topic/i });
  await user.keyboard("{Enter}");
  expect(screen.getByText(/finding that paper/i)).toBeInTheDocument();
  return { box, user, answer };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe("SmartSearch", () => {
  beforeEach(() => push.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("opens the highlighted result from the Search button, though clicking it blurs the box (review F1)", async () => {
    serve(Promise.resolve(papers));
    const box = await mount();
    const user = userEvent.setup();
    await user.type(box, "chemistry");
    await screen.findByRole("option", { name: /IB Chemistry HL.*by topic/i });
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith("/banks/ib-chemistry-hl?free=1");
  });

  it("also opens it on Tab to Search, then Enter (review F1)", async () => {
    serve(Promise.resolve(papers));
    const box = await mount();
    const user = userEvent.setup();
    await user.type(box, "0580");
    await screen.findByRole("option", { name: /IGCSE Maths 0580.*by topic/i });
    await user.tab();
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/banks/igcse?free=1");
  });

  it("waits for the paper list before submitting a paper code, rather than sending it to topic practice (review F2)", async () => {
    let answer!: (value: SearchPapers) => void;
    serve(new Promise(resolve => { answer = resolve; }));
    const box = await mount();
    const user = userEvent.setup();
    await user.type(box, "0580/42/M/J/24");
    await screen.findByRole("option", { name: /IGCSE Maths 0580.*by topic/i });
    await user.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/finding that paper/i)).toBeInTheDocument();
    answer(papers);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/past-papers/igcse-maths-0580/2024-may-june-42"));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("drops a pending paper submit when Escape clears the box (re-review R1)", async () => {
    const { user, answer, box } = await pendingPaperSubmit();
    await user.keyboard("{Escape}");
    expect(box).toHaveValue("");
    answer(papers);
    await settle();
    expect(push).not.toHaveBeenCalled();
  });

  it("drops a pending paper submit when the query changes (re-review R1)", async () => {
    const { user, answer, box } = await pendingPaperSubmit();
    await user.clear(box);
    await user.type(box, "chemistry");
    answer(papers);
    await settle();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps a newer explicit choice, and goes nowhere after the box unmounts (re-review R1)", async () => {
    const { user, answer, box } = await pendingPaperSubmit();
    await user.clear(box);
    await user.type(box, "chemistry");
    await user.click(await screen.findByRole("option", { name: "IB Chemistry HL: practice by topic" }));
    expect(push).toHaveBeenLastCalledWith("/banks/ib-chemistry-hl?free=1");
    box.unmount();
    answer(papers);
    await settle();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("goes nowhere if the box unmounts while a paper submit waits (re-review R1)", async () => {
    const { answer, box } = await pendingPaperSubmit();
    box.unmount();
    answer(papers);
    await settle();
    expect(push).not.toHaveBeenCalled();
  });

  it("waits for the search index too, when Enter comes before it arrives", async () => {
    let answer!: (value: SearchIndex) => void;
    const slowIndex = new Promise<SearchIndex>(resolve => { answer = resolve; });
    vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("index.json")
      ? slowIndex.then(value => ({ ok: true, json: () => Promise.resolve(value) }))
      : Promise.resolve({ ok: true, json: () => Promise.resolve(papers) })));
    const box = await mount();
    const user = userEvent.setup();
    await user.type(box, "chemistry");
    await user.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
    answer(index);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/banks/ib-chemistry-hl?free=1"));
  });

  it("says when the paper list can't load and offers a retry, without redirecting (review F2)", async () => {
    serve(Promise.resolve(null));
    const box = await mount();
    const user = userEvent.setup();
    await user.type(box, "0580/42/M/J/24");
    await user.keyboard("{Enter}");
    expect(await screen.findByText(/couldn't load past papers/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    serve(Promise.resolve(papers));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByRole("option", { name: /IGCSE Maths 0580\/42 May\/June 2024/i });
  });

  it("names each subject action with its course (review F9)", async () => {
    serve(Promise.resolve(papers));
    const box = await mount();
    await userEvent.setup().type(box, "chem");
    expect(await screen.findByRole("option", { name: "IB Chemistry HL: practice by topic" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "IB Chemistry HL: full past papers" })).toBeInTheDocument();
  });
});
