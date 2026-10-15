import { describe, expect, it } from "vitest";
import { suggestWorksheetTitle } from "@/lib/worksheet-title";

const bankSlug = "igcse-biology-0610" as const;
const q = (primaryTopic: string, paper = 2) => ({ bankSlug, primaryTopic, paper });

describe("suggestWorksheetTitle", () => {
  it("names a single-topic set after its topic", () => {
    expect(suggestWorksheetTitle([q("Respiration"), q("Respiration")])).toBe("Respiration");
  });
  it("joins two topics, most common first", () => {
    expect(suggestWorksheetTitle([q("Graphs"), q("Algebra"), q("Algebra")])).toBe("Algebra & Graphs");
  });
  it("names the top two of three or more topics", () => {
    expect(suggestWorksheetTitle([q("Graphs"), q("Algebra"), q("Algebra"), q("Sets")])).toBe("Algebra, Graphs & more");
  });
  it("falls back to the papers when there are no topics", () => {
    expect(suggestWorksheetTitle([q("", 4), q("", 2)])).toBe("Paper 2 & 4 mix");
    expect(suggestWorksheetTitle([q("", 2)])).toBe("Paper 2 mix");
    expect(suggestWorksheetTitle([q("", 4), q("", 1), q("", 2)])).toBe("Paper 1, 2 & 4 mix");
    expect(suggestWorksheetTitle([])).toBe("Practice set");
  });
  it("numbers a title that is already taken, ignoring case", () => {
    expect(suggestWorksheetTitle([q("Respiration")], ["respiration", "Respiration 2"])).toBe("Respiration 3");
    expect(suggestWorksheetTitle([q("Respiration")], ["Respiration 2"])).toBe("Respiration");
  });
  it("stays within 80 characters, suffix included", () => {
    const long = "x".repeat(120);
    expect(suggestWorksheetTitle([q(long)])).toHaveLength(80);
    const taken = suggestWorksheetTitle([q(long)]);
    const next = suggestWorksheetTitle([q(long)], [taken]);
    expect(next).toHaveLength(80);
    expect(next.endsWith(" 2")).toBe(true);
  });
});
