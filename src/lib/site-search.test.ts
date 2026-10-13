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
    subject("ib-hl", "IB Math AA HL", ["IB Math AA HL", "Mathematics Analysis and Approaches", "Higher Level", "IB Diploma"]),
  ],
  topics: [
    { bank: "igcse", label: "Quadratic equations", parent: "Algebra", href: "/banks/igcse?subtopic=Quadratic+equations", count: 40 },
    { bank: "igcse", label: "Algebra", parent: null, href: "/banks/igcse/topics/algebra", count: 900 },
    { bank: "igcse-chemistry-0620", label: "Acids, bases and salts", parent: null, href: "/banks/igcse-chemistry-0620?topic=Acids", count: 300 },
    { bank: "ib-hl", label: "1.18 Surds", parent: "Number and algebra", href: "/banks/ib-hl?free=0&subtopic=1.18+Surds", count: 20 },
  ],
};
const paper = (id: string, bankSlug: string, syllabusCode: string, year: number, session: string, component: string, variant = "", route: SearchPaper["route"] = null): SearchPaper => ({
  id, bankSlug, qualification: bankSlug.startsWith("ib") ? "IB Diploma" : "Cambridge IGCSE", syllabusCode, year, session, sessionCode: "", component,
  paper: component.replace(/^P/, "")[0], variant, route, href: `/past-papers/${id}`, title: id, detail: "",
} as SearchPaper);
const papers: SearchPapers = {
  version: 1,
  papers: [
    paper("0580-s24-42", "igcse", "0580", 2024, "May/June", "42", "2", "Extended"),
    paper("0580-s24-41", "igcse", "0580", 2024, "May/June", "41", "1", "Extended"),
    paper("0580-s24-12", "igcse", "0580", 2024, "May/June", "12", "2", "Core"),
    paper("0580-s24-22", "igcse", "0580", 2024, "May/June", "22", "2", "Extended"),
    paper("0620-s24-42", "igcse-chemistry-0620", "0620", 2024, "May/June", "42"),
    paper("chemistry-2024-may-tz1-hl-p1-english", "ib-chemistry-hl", "Chemistry", 2024, "May", "P1", "tz1"),
    paper("2018-may-tz0-p3-calculus", "ib-hl", "AA", 2018, "May", "P3", "tz0"),
    paper("2018-may-tz0-p3-discrete-mathematics", "ib-hl", "AA", 2018, "May", "P3", "tz0"),
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
    expect(searchSite(index, papers, "chemistry hl may 2024 paper 1 tz1").papers.map(p => p.id)).toEqual(["chemistry-2024-may-tz1-hl-p1-english"]);
  });

  it("treats a syllabus code or subject name as a subject with both ways in", () => {
    const code = searchSite(index, papers, "0580");
    expect(code.intent).toBe("subject");
    expect(code.subjects.map(s => s.bank)).toEqual(["igcse"]);
    expect(code.subjects[0]).toMatchObject({ practiceHref: "/banks/igcse", papersHref: "/past-papers/igcse" });
    expect(searchSite(index, null, "IB Chemistry HL").subjects.map(s => s.bank)).toEqual(["ib-chemistry-hl"]);
    expect(searchSite(index, null, "chem").subjects).toHaveLength(3);
    expect(searchSite(index, null, "maths").subjects.map(s => s.bank)).toEqual(["igcse", "ib-hl"]);
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

  it("lets words the paper parser understood drop out of subject matching (review F3)", () => {
    expect(searchSite(index, papers, "IB Math AA HL May 2018 Paper 3 Calculus").papers.map(p => p.id)).toEqual(["2018-may-tz0-p3-calculus"]);
    for (const query of ["IB chemistry HL May/June 2024 Paper 1 TZ1", "IB chemistry HL May 2024 Paper 1 TZ 1"]) {
      expect(searchSite(index, papers, query).papers.map(p => p.id), query).toEqual(["chemistry-2024-may-tz1-hl-p1-english"]);
    }
  });

  it("finds numbered syllabus topics by their exact label (review F5)", () => {
    expect(searchSite(index, papers, "1.18 Surds").topics.map(t => t.label)).toEqual(["1.18 Surds"]);
    expect(searchSite(index, papers, "1.18 Surds").intent).toBe("topic");
  });

  it("accepts the full course name, stopwords and all (review F6)", () => {
    expect(searchSite(index, null, "IB Mathematics Analysis and Approaches Higher Level").subjects.map(s => s.bank)).toEqual(["ib-hl"]);
  });

  it("applies Core / Extended instead of ignoring it (review F7)", () => {
    expect(searchSite(index, papers, "0580 extended may 2024").papers.map(p => p.component)).toEqual(["22", "41", "42"]);
    expect(searchSite(index, papers, "0580 core may 2024").papers.map(p => p.component)).toEqual(["12"]);
    // Contradictory: Paper 2 is Extended-only in this set, so a Core request finds nothing rather than the wrong tier.
    expect(searchSite(index, papers, "0580 core may 2024 paper 2").papers).toEqual([]);
  });

  it("says none when nothing matches", () => {
    expect(searchSite(index, papers, "zzzz")).toEqual({ intent: "none", papers: [], subjects: [], topics: [] });
  });
});
