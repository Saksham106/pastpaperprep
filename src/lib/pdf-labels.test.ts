import { describe, expect, it } from "vitest";
import { pdfCoverSummary, pdfFileName, pdfSessionLabel, pdfSourceLabel, type PdfLabelQuestion } from "@/lib/pdf-labels";

const question = (overrides: Partial<PdfLabelQuestion> = {}): PdfLabelQuestion => ({
  id: "0580-2024-june-22-q5", bankSlug: "igcse", year: 2024, session: "June", paper: 2, number: 5,
  component: "22", marks: 6, primaryTopic: "Algebra", ...overrides,
});

describe("pdfSessionLabel", () => {
  it("names Cambridge sessions in full, whichever code the bank stores", () => {
    expect(["June", "s", "March", "m", "November", "w"].map((session) => pdfSessionLabel("igcse", session)))
      .toEqual(["May/June", "May/June", "Feb/March", "Feb/March", "Oct/Nov", "Oct/Nov"]);
    expect(pdfSessionLabel("igcse-biology-0610", "march")).toBe("Feb/March");
    expect(["May/June", "February/March", "October/November"].map((session) => pdfSessionLabel("igcse-additional", session)))
      .toEqual(["May/June", "Feb/March", "Oct/Nov"]);
  });
  it("keeps IB session names as stored", () => {
    expect(pdfSessionLabel("ib-chemistry-hl", "May")).toBe("May");
    expect(pdfSessionLabel("ib-hl", "November")).toBe("November");
  });
});

describe("pdfSourceLabel", () => {
  it("reads year, session, component and original number", () => {
    expect(pdfSourceLabel(question())).toBe("2024 May/June · Paper 22 · Q5");
  });
  it("derives the component from the id, then falls back to the paper", () => {
    expect(pdfSourceLabel(question({ component: "" }))).toBe("2024 May/June · Paper 22 · Q5");
    expect(pdfSourceLabel(question({ component: "", id: "x" }))).toBe("2024 May/June · Paper 2 · Q5");
  });
});

describe("pdfCoverSummary", () => {
  it("names the bank and a shared Extended route", () => {
    const summary = pdfCoverSummary([question(), question({ id: "b", paper: 4 })], "igcse", "both");
    expect(summary.eyebrow).toBe("IGCSE MATHEMATICS 0580 · EXTENDED");
  });
  it("drops the route for mixed papers and ignores shared practicals", () => {
    expect(pdfCoverSummary([question(), question({ id: "b", paper: 1 })], "igcse", "both").eyebrow).toBe("IGCSE MATHEMATICS 0580");
    expect(pdfCoverSummary([question({ bankSlug: "igcse-biology-0610", paper: 1 }), question({ bankSlug: "igcse-biology-0610", id: "b", paper: 6 })], "igcse-biology-0610", "both").eyebrow)
      .toBe("IGCSE BIOLOGY 0610 · CORE");
  });
  it("uses the IB title without an IGCSE prefix and marks answer-only exports", () => {
    const summary = pdfCoverSummary([question({ bankSlug: "ib-chemistry-hl", paper: 1 })], "ib-chemistry-hl", "answers");
    expect(summary.eyebrow).toBe("IB CHEMISTRY HIGHER LEVEL · MARK SCHEME");
    expect(summary.showScore).toBe(false);
  });
  it("summarises count, marks and years", () => {
    const summary = pdfCoverSummary([question({ year: 2019 }), question({ id: "b", year: 2025, marks: 4 })], "igcse", "questions");
    expect(summary.meta).toBe("2 questions · 10 marks · 2019–2025");
    expect(summary.totalMarks).toBe(10);
    expect(summary.showScore).toBe(true);
    expect(pdfCoverSummary([question({ marks: 1 })], "igcse", "both").meta).toBe("1 question · 1 mark · 2024");
  });
  it("leaves marks out when any question has unknown marks", () => {
    const summary = pdfCoverSummary([question(), question({ id: "b", marks: null })], "igcse", "both");
    expect(summary.meta).toBe("2 questions · 2024");
    expect(summary.totalMarks).toBeNull();
  });
  it("ranks topic chips by frequency, then name, capped at five", () => {
    const topics = ["Graphs", "Algebra", "Algebra", "Vectors", "Sets", "Probability", "Number", "Mensuration"];
    const summary = pdfCoverSummary(topics.map((primaryTopic, index) => question({ id: `q${index}`, primaryTopic })), "igcse-biology-0610", "both");
    expect(summary.chips).toEqual(["Algebra", "Graphs", "Mensuration", "Number", "Probability", "+2 more"]);
  });
});

describe("pdfFileName", () => {
  it("joins the bank short name and the title", () => {
    expect(pdfFileName("igcse-biology-0610", "Respiration")).toBe("biology-0610-respiration.pdf");
    expect(pdfFileName("igcse", "Algebra & Graphs 2")).toBe("mathematics-0580-algebra-graphs-2.pdf");
    expect(pdfFileName("igcse", "Équations")).toBe("mathematics-0580-equations.pdf");
  });
  it("falls back when the title has no usable characters", () => {
    expect(pdfFileName("igcse", "!!!")).toBe("pastpaperprep-worksheet.pdf");
    expect(pdfFileName("igcse", "代数")).toBe("pastpaperprep-worksheet.pdf");
  });
  it("caps long names", () => {
    const name = pdfFileName("igcse", "a ".repeat(80));
    expect(name.length).toBeLessThanOrEqual(84);
    expect(name).not.toMatch(/-\.pdf$/);
  });
});
