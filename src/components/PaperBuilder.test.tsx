import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";

const { exportWorksheetPdf } = vi.hoisted(() => ({ exportWorksheetPdf: vi.fn() }));
vi.mock("@/lib/worksheet-export", () => ({ exportWorksheetPdf }));

import { PaperBuilder } from "@/components/PaperBuilder";

const readIndex = (bank: keyof typeof PUBLIC_BANK_INDEX_FILES) => JSON.parse(readFileSync(join(process.cwd(), "public", "bank-index", PUBLIC_BANK_INDEX_FILES[bank]), "utf8"));
const chemistry = readIndex("igcse-chemistry-0620");
const ib = readIndex("ib-hl");
const bank = { slug: "igcse-chemistry-0620" as const, label: "Chemistry 0620", indexUrl: "/idx/chemistry.json" };
const ibBank = { slug: "ib-hl" as const, label: "IB Math AA HL", indexUrl: "/idx/ib.json" };
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let worksheetResponse: (init?: RequestInit) => Response = () => Response.json({ worksheet: { id: "w-1", revision: 1 } }, { status: 201 });

const rows = () => within(screen.getByRole("list", { name: "Questions in this paper" })).queryAllByRole("listitem");
const rowSources = () => rows().map((row) => row.querySelector("small")!.textContent);
const topicList = () => screen.getByRole("list", { name: "Topics" });
async function ready() { await screen.findByRole("list", { name: "Questions in this paper" }); }

beforeEach(() => {
  calls = [];
  window.history.replaceState({}, "", "/worksheets/build");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url === bank.indexUrl) return Response.json(chemistry);
    if (url === ibBank.indexUrl) return Response.json(ib);
    if (url.startsWith("/api/worksheets")) return worksheetResponse(init);
    return new Response("{}", { status: 404 });
  }));
  exportWorksheetPdf.mockReset().mockResolvedValue({ heldNotice: null });
});
afterEach(() => vi.unstubAllGlobals());

describe("PaperBuilder", () => {
  it("gives free members a direct pricing decision", () => {
    render(<PaperBuilder banks={[]} />);
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/pricing");
  });

  it("shows a ten-question paper straight away, with no generate step, named after its topics", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    expect(rows()).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /generate/i })).not.toBeInTheDocument();
    expect((screen.getByLabelText("Worksheet name") as HTMLInputElement).value).not.toBe("");
    expect(screen.getByRole("group", { name: "Your Cambridge route" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("bank")).toBe(bank.slug);
  });

  it("counts every topic live and narrows the counts when the years narrow", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    const firstCount = () => Number(within(topicList()).getAllByRole("listitem")[0].querySelector(".builder-count")!.textContent);
    const before = firstCount();
    const latest = Math.max(...chemistry.questions.map((question: { year: number }) => question.year));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: String(latest) } });
    expect(firstCount()).toBeLessThan(before);
    const empty = [...topicList().querySelectorAll("label.is-empty input")] as HTMLInputElement[];
    expect(empty.every((input) => input.disabled)).toBe(true);
  });

  it("builds only from the topics picked", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    const first = within(topicList()).getAllByRole("listitem")[0];
    const count = Number(first.querySelector(".builder-count")!.textContent);
    fireEvent.click(within(first).getAllByRole("checkbox")[0]);
    expect(screen.getByText(new RegExp(`✓ ${count} questions? match`))).toBeInTheDocument();
    expect(rows().length).toBe(Math.min(10, count));
  });

  it("resizes by questions or marks", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    expect(rows()).toHaveLength(20);
    fireEvent.click(within(screen.getByRole("group", { name: "Size by" })).getByRole("button", { name: "Marks" }));
    fireEvent.click(screen.getByRole("button", { name: "25" }));
    expect(screen.getByText(/· 25 marks$/)).toBeInTheDocument();
  });

  it("removes a question for good, swaps one in place and reorders", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    const [first, second] = rowSources();
    fireEvent.click(screen.getByRole("button", { name: "Move question 1 down" }));
    expect(rowSources().slice(0, 2)).toEqual([second, first]);
    fireEvent.click(screen.getByRole("button", { name: "Remove question 1" }));
    expect(rows()).toHaveLength(9);
    expect(rowSources()).not.toContain(second);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: String(Math.max(...chemistry.questions.map((question: { year: number }) => question.year))) } });
    expect(rowSources()).not.toContain(second);
    const before = rowSources()[0];
    fireEvent.click(screen.getByRole("button", { name: "Swap question 1" }));
    expect(rowSources()[0]).not.toBe(before);
    expect(rows()).toHaveLength(9);
  });

  it("matches a real paper with per-paper targets", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    fireEvent.click(screen.getByText("Match a real paper"));
    fireEvent.change(screen.getByLabelText("Paper 2 questions"), { target: { value: "3" } });
    expect(rows()).toHaveLength(3);
    expect(rowSources().every((source) => /· Paper 2\d ·/.test(source ?? ""))).toBe(true);
    expect(screen.queryByRole("group", { name: "Size by" })).not.toBeInTheDocument();
  });

  it("hides the Cambridge route on IB banks and resets the paper on a bank switch", async () => {
    render(<PaperBuilder banks={[bank, ibBank]} />);
    await ready();
    fireEvent.change(screen.getByLabelText("Question bank"), { target: { value: "ib-hl" } });
    await waitFor(() => expect(screen.queryByRole("group", { name: "Your Cambridge route" })).not.toBeInTheDocument());
    await waitFor(() => expect(rowSources()[0]).toMatch(/20\d\d (May|November) · Paper/));
  });

  it("rebuilds the paper a link describes", async () => {
    window.history.replaceState({}, "", "/worksheets/build?size=q5&seed=42");
    const { unmount } = render(<PaperBuilder banks={[bank]} />);
    await ready();
    await waitFor(() => expect(rows()).toHaveLength(5));
    const first = rowSources();
    unmount();
    window.history.replaceState({}, "", "/worksheets/build?size=q5&seed=42");
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    await waitFor(() => expect(rowSources()).toEqual(first));
  });

  it("lets Shuffle bring back questions that were swapped out", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    // A subtopic small enough that swaps exhaust it.
    within(topicList()).getAllByRole("button", { name: /^Show .* subtopics$/ }).forEach((button) => fireEvent.click(button));
    const subtopic = [...topicList().querySelectorAll(".builder-subtopics li")].find((row) => {
      const count = Number(row.querySelector(".builder-count")!.textContent);
      return count >= 7 && count <= 20;
    })!;
    const count = Number(subtopic.querySelector(".builder-count")!.textContent);
    fireEvent.click(within(subtopic as HTMLElement).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    for (let swap = 0; swap < 2; swap += 1) fireEvent.click(screen.getByRole("button", { name: "Swap question 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    fireEvent.change(screen.getByLabelText("Number of questions"), { target: { value: String(count) } });
    expect(rows()).toHaveLength(count);
  });

  it("drops paper targets a link names that this bank or route cannot use", async () => {
    window.history.replaceState({}, "", "/worksheets/build?papers=9q5");
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(screen.getByRole("group", { name: "Size by" })).toBeInTheDocument();
  });

  it("rebuilds exactly the paper on screen from its link, after choices and edits change it", async () => {
    window.history.replaceState({}, "", "/worksheets/build?size=q10&seed=7");
    const { unmount } = render(<PaperBuilder banks={[bank]} />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(within(within(topicList()).getAllByRole("listitem")[1]).getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Swap question 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Move question 1 down" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove question 3" }));
    const shown = rowSources();
    const link = window.location.search;
    unmount();
    window.history.replaceState({}, "", `/worksheets/build${link}`);
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    await waitFor(() => expect(rowSources()).toEqual(shown));
  });

  it("gives the download a scope that ends on sign-out or when the builder closes", async () => {
    document.cookie = "sb-test-auth-token=1; path=/";
    const { unmount } = render(<PaperBuilder banks={[bank]} />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    await waitFor(() => expect(exportWorksheetPdf).toHaveBeenCalled());
    const { isCurrent } = exportWorksheetPdf.mock.calls[0][0];
    expect(isCurrent()).toBe(true);
    document.cookie = "sb-test-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    expect(isCurrent()).toBe(false);
    document.cookie = "sb-test-auth-token=1; path=/";
    unmount();
    expect(isCurrent()).toBe(false);
    document.cookie = "sb-test-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("saves in sheet order, then saves later edits to the same worksheet", async () => {
    render(<PaperBuilder banks={[bank]} existingTitles={[]} />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Move question 1 down" }));
    fireEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    await screen.findByRole("link", { name: /saved to my worksheets/i });
    const post = calls.find((call) => call.init?.method === "POST")!;
    const body = JSON.parse(String(post.init!.body));
    expect(body.questionIds).toHaveLength(10);
    expect(body).toMatchObject({ bank: bank.slug, contentMode: "both" });
    expect(screen.getByRole("link", { name: /saved to my worksheets/i })).toHaveAttribute("href", `/banks/${bank.slug}?worksheet=w-1`);
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Worksheet name"), { target: { value: "Mock" } });
    worksheetResponse = () => Response.json({ error: "Someone else changed this worksheet" }, { status: 409 });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else changed this worksheet");
    expect(screen.getByLabelText("Worksheet name")).toHaveValue("Mock");
    worksheetResponse = () => Response.json({ worksheet: { id: "w-1", revision: 2 } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("button", { name: "Saved" });
    const patch = calls.filter((call) => call.init?.method === "PATCH").at(-1)!;
    expect(patch.url).toBe("/api/worksheets/w-1");
    expect(JSON.parse(String(patch.init!.body))).toMatchObject({ name: "Mock", revision: 1 });
    worksheetResponse = () => Response.json({ worksheet: { id: "w-1", revision: 1 } }, { status: 201 });
  });

  it("downloads the PDF from the builder with its title and footer marker", async () => {
    render(<PaperBuilder banks={[bank]} exportMarker="ABC123" />);
    await ready();
    fireEvent.change(screen.getByLabelText("Worksheet name"), { target: { value: "Mock" } });
    const sources = rowSources();
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    await screen.findByText("PDF downloaded.");
    const args = exportWorksheetPdf.mock.calls[0][0];
    expect(args).toMatchObject({ bank: bank.slug, title: "Mock", marker: "ABC123" });
    expect(args.questions).toHaveLength(sources.length);
  });

  it("opens a question in the reader and returns focus when it closes", async () => {
    render(<PaperBuilder banks={[bank]} />);
    await ready();
    const opener = within(rows()[1]).getByRole("button", { name: /^Preview question 2/ });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Question preview" });
    expect(within(dialog).getByText("Question 2 of 10")).toBeInTheDocument();
    expect(document.querySelector(".builder-layout")).toHaveAttribute("inert");
    await act(async () => { fireEvent.keyDown(document, { key: "Escape" }); await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
    expect(document.querySelector(".builder-layout")).not.toHaveAttribute("inert");
  });
});
