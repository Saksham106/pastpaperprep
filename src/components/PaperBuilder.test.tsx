import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperBuilder } from "@/components/PaperBuilder";
import type { PublicBankIndex } from "@/lib/question-index";

const bank = { slug: "igcse-chemistry-0620" as const, label: "Chemistry 0620", indexUrl: "/bank-index/chemistry-test.json" };
const metadata = (id: string, paper: number, year: number, marks: number, topic: string) => ({
  id, paper, year, marks, number: 1, session: "Summer", primaryTopic: topic, secondaryTopics: [], skills: [], subtopics: [], granularLabels: [], subject: "Chemistry", option: "", zone: "", component: "", calculator: null, questionImageCount: 1, markschemeImageCount: 1,
});
const index = { version: 1, bank: bank.slug, questions: [metadata("a", 1, 2024, 1, "Atoms"), metadata("b", 1, 2023, 1, "Atoms"), metadata("c", 2, 2024, 3, "Atoms"), metadata("d", 2, 2024, 5, "Energy")] } satisfies PublicBankIndex;

afterEach(() => vi.unstubAllGlobals());

describe("PaperBuilder", () => {
  it("generates a filtered in-site set and saves exactly its IDs through the existing worksheet API", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(index)).mockResolvedValueOnce(Response.json({ worksheet: { id: "w-123" } }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PaperBuilder banks={[bank]} />);
    await waitFor(() => expect(screen.getByLabelText("From year").querySelectorAll("option")).toHaveLength(3));
    fireEvent.change(screen.getByLabelText("From year"), { target: { value: "2024" } });
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Atoms" } });
    fireEvent.change(screen.getByLabelText("Paper 1 questions"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Paper 2 questions"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate paper" }));
    const preview = await screen.findByRole("region", { name: "Generated paper preview" });
    expect(within(preview).getAllByRole("listitem")).toHaveLength(2);
    expect(preview).toHaveTextContent("4 marks");
    expect(fetchMock).toHaveBeenCalledTimes(1); // generation creates no worksheet and consumes no export
    fireEvent.change(screen.getByLabelText("Worksheet name"), { target: { value: "Atomic practice" } });
    fireEvent.click(screen.getByRole("button", { name: "Save worksheet" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/worksheets");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ bank: bank.slug, name: "Atomic practice", questionIds: ["a", "c"], contentMode: "both" });
    expect(await screen.findByRole("link", { name: "Open paper" })).toHaveAttribute("href", "/banks/igcse-chemistry-0620?worksheet=w-123");
    expect(screen.queryByRole("button", { name: /download pdf/i })).not.toBeInTheDocument();
  });

  it("does not save an impossible target and keeps preview stale-free when filters change", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(index));
    vi.stubGlobal("fetch", fetchMock);
    render(<PaperBuilder banks={[bank]} />);
    await waitFor(() => expect(screen.getByLabelText("From year").querySelectorAll("option")).toHaveLength(3));
    fireEvent.change(screen.getByLabelText("Paper 1 questions"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate paper" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/only 2 available/i);
    expect(screen.queryByRole("region", { name: "Generated paper preview" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Paper 1 questions"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate paper" }));
    expect(screen.getByRole("region", { name: "Generated paper preview" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From year"), { target: { value: "2024" } });
    expect(screen.queryByRole("region", { name: "Generated paper preview" })).not.toBeInTheDocument();
  });

  it("keeps the paper on screen and offers no open link when the worksheet API denies access", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(index)).mockResolvedValueOnce(Response.json({ error: "Bank access required" }, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PaperBuilder banks={[bank]} />);
    await waitFor(() => expect(screen.getByLabelText("From year").querySelectorAll("option")).toHaveLength(3));
    fireEvent.change(screen.getByLabelText("Paper 1 questions"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate paper" }));
    fireEvent.click(screen.getByRole("button", { name: "Save worksheet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bank access required");
    expect(screen.getByRole("region", { name: "Generated paper preview" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open paper" })).not.toBeInTheDocument();
  });
});
