import { describe, expect, it } from "vitest";
import { looksLikePaper, matchTopics, searchSite, subjectTerms, type SearchIndex, type SearchPaper, type SearchPapers, type SearchSubject } from "@/lib/site-search";

const subject = (bank: string, name: string, extra: string[], papers = 10): SearchSubject => ({
  bank, name, qualification: bank.startsWith("ib") ? "ib" : "igcse", practiceHref: `/banks/${bank}`, questionCount: 100,
  papersHref: papers ? `/past-papers/${bank}` : null, paperCount: papers, terms: subjectTerms(name, ...extra),
});
const index: SearchIndex = {
  version: 1,
  subjects: [
    subject("igcse", "IGCSE Mathematics 0580", ["Cambridge IGCSE"]),
    subject("igcse-chemistry-0620", "IGCSE Chemistry 0620", ["Cambridge IGCSE"]),
    subject("ib-chemistry-hl", "IB Chemistry HL", ["IB Diploma"]),
    subject("ib-chemistry-sl", "IB Chemistry SL", ["IB Diploma"], 0),
  ],
  topics: [
    { bank: "igcse", label: "Quadratic equations", parent: "Algebra", href: "/banks/igcse?subtopic=Quadratic+equations", count: 40 },
    { bank: "igcse", label: "Algebra", parent: null, href: "/banks/igcse/topics/algebra", count: 900 },
    { bank: "igcse-chemistry-0620", label: "Acids, bases and salts", parent: null, href: "/banks/igcse-chemistry-0620?topic=Acids", count: 300 },
  ],
};
const paper = (id: string, bankSlug: string, syllabusCode: string, year: number, session: string, component: string, variant = ""): SearchPaper => ({
  id, bankSlug, qualification: bankSlug.startsWith("ib") ? "IB Diploma" : "Cambridge IGCSE", syllabusCode, year, session, sessionCode: "", component,
  paper: component[0], variant, href: `/past-papers/${id}`, title: id, detail: "",
} as SearchPaper);
const papers: SearchPapers = {
  version: 1,
  papers: [
    paper("0580-s24-42", "igcse", "0580", 2024, "May/June", "42"),
    paper("0580-s24-41", "igcse", "0580", 2024, "May/June", "41"),
    paper("0620-s24-42", "igcse-chemistry-0620", "0620", 2024, "May/June", "42"),
    paper("chem-hl-m24-p1-tz1", "ib-chemistry-hl", "", 2024, "May", "1", "TZ1"),
  ],
};

describe("site search", () => {
  it("answers a paper code with that one paper first", () => {
    for (const query of ["0580/42/M/J/24", "0580_s24_qp_42"]) {
      const results = searchSite(index, papers, query);
      expect(results.intent).toBe("paper");
      expect(results.papers.map(p => p.id)).toEqual(["0580-s24-42"]);
      expect(results.subjects.map(s => s.bank)).toEqual(["igcse"]);
      expect(results.topics).toEqual([]);
    }
  });

  it("needs a subject before matching a paper without a code", () => {
    expect(searchSite(index, papers, "may 2024 paper 1 tz1").papers).toEqual([]);
    expect(searchSite(index, papers, "chemistry hl may 2024 paper 1 tz1").papers.map(p => p.id)).toEqual(["chem-hl-m24-p1-tz1"]);
  });

  it("treats a syllabus code or subject name as a subject with both ways in", () => {
    const code = searchSite(index, papers, "0580");
    expect(code.intent).toBe("subject");
    expect(code.subjects.map(s => s.bank)).toEqual(["igcse"]);
    expect(code.subjects[0]).toMatchObject({ practiceHref: "/banks/igcse", papersHref: "/past-papers/igcse" });
    expect(searchSite(index, null, "IB Chemistry HL").subjects.map(s => s.bank)).toEqual(["ib-chemistry-hl"]);
    expect(searchSite(index, null, "chem").subjects).toHaveLength(3);
    expect(searchSite(index, null, "maths").subjects.map(s => s.bank)).toEqual(["igcse"]);
  });

  it("finds topics by their start, then anywhere, biggest first", () => {
    expect(searchSite(index, null, "quadratic").intent).toBe("topic");
    expect(matchTopics(index.topics, "alg").map(t => t.label)).toEqual(["Algebra"]);
    expect(matchTopics(index.topics, "equations").map(t => t.label)).toEqual(["Quadratic equations"]);
    expect(matchTopics(index.topics, "ac")).toEqual([]);
  });

  it("loads the paper index only for paper-like text", () => {
    expect(looksLikePaper("0580/42/M/J/24")).toBe(true);
    expect(looksLikePaper("s24 p42")).toBe(true);
    expect(looksLikePaper("0580")).toBe(false);
    expect(looksLikePaper("quadratic")).toBe(false);
  });

  it("says none when nothing matches", () => {
    expect(searchSite(index, papers, "zzzz")).toEqual({ intent: "none", papers: [], subjects: [], topics: [] });
  });
});
