import type { BankSlug, CatalogBank } from "@/lib/catalog";

export type AssessmentPaper = {
  name: string;
  format: string;
  duration?: string;
  marks?: string;
  weighting?: string;
  route?: string;
};

export type AssessmentGuide = {
  version: string;
  summary: string;
  papers: AssessmentPaper[];
  caveat?: string;
};

const scienceCambridge = (subject: string): AssessmentGuide => ({
  version: subject === "Biology" ? "2026–2028 syllabus" : subject === "Co-ordinated Sciences" ? "2025–2027 syllabus" : "current syllabus structure",
  summary: `${subject} uses a Core or Extended route plus one practical-skills paper. Multiple-choice and theory test knowledge and application; Paper 5 or 6 tests experimental planning, observation, data handling, and evaluation.`,
  papers: subject === "Co-ordinated Sciences" ? [
    { name: "Paper 1", route: "Core", format: "Multiple choice", duration: "45 min", marks: "40", weighting: "30%" },
    { name: "Paper 2", route: "Extended", format: "Multiple choice", duration: "45 min", marks: "40", weighting: "30%" },
    { name: "Paper 3", route: "Core", format: "Theory", duration: "2 hr", marks: "120", weighting: "50%" },
    { name: "Paper 4", route: "Extended", format: "Theory", duration: "2 hr", marks: "120", weighting: "50%" },
    { name: "Paper 5", route: "Both routes", format: "Practical test", duration: "2 hr", marks: "60", weighting: "20%" },
    { name: "Paper 6", route: "Both routes", format: "Alternative to practical", duration: "1 hr 30 min", marks: "60", weighting: "20%" },
  ] : [
    { name: "Paper 1", route: "Core", format: "Multiple choice", duration: "45 min", marks: "40", weighting: "30%" },
    { name: "Paper 2", route: "Extended", format: "Multiple choice", duration: "45 min", marks: "40", weighting: "30%" },
    { name: "Paper 3", route: "Core", format: "Theory", duration: "1 hr 15 min", marks: "80", weighting: "50%" },
    { name: "Paper 4", route: "Extended", format: "Theory", duration: "1 hr 15 min", marks: "80", weighting: "50%" },
    { name: "Paper 5", route: "Both routes", format: "Practical test", duration: "1 hr 15 min", marks: "40", weighting: "20%" },
    { name: "Paper 6", route: "Both routes", format: "Alternative to practical", duration: "1 hr", marks: "40", weighting: "20%" },
  ],
  caveat: "The archive spans more than one syllabus cycle. Timings and structures shown here describe the named current cycle, not every historical paper in the bank.",
});

const ibMath = (level: "HL" | "SL", ai: boolean): AssessmentGuide => ({
  version: "First assessment 2021",
  summary: ai
    ? "Applications and Interpretation uses technology throughout its written papers and emphasises modelling, statistics, and interpretation."
    : "Analysis and Approaches combines algebraic reasoning, functions, geometry, and calculus. Paper 1 is completed without technology; later papers allow a graphic display calculator.",
  papers: level === "HL" ? [
    { name: "Paper 1", format: ai ? "Technology allowed" : "No technology", duration: "2 hr", weighting: "30%" },
    { name: "Paper 2", format: "Technology allowed", duration: "2 hr", weighting: "30%" },
    { name: "Paper 3", format: "Extended problem solving", duration: ai ? "1 hr" : "1 hr 15 min", weighting: "20%" },
    { name: "Exploration", format: "Internal assessment", weighting: "20%" },
  ] : [
    { name: "Paper 1", format: ai ? "Technology allowed" : "No technology", duration: "1 hr 30 min", weighting: "40%" },
    { name: "Paper 2", format: "Technology allowed", duration: "1 hr 30 min", weighting: "40%" },
    { name: "Exploration", format: "Internal assessment", weighting: "20%" },
  ],
  caveat: "Some Mathematics AA archive records predate the current AA/AI course split. Use the paper year and source when comparing formats.",
});

const ibScience = (subject: string, level: "HL" | "SL"): AssessmentGuide => ({
  version: "First assessment 2025",
  summary: `${subject} now separates Paper 1 into multiple-choice and data or experimental-work sections, followed by a written Paper 2. The scientific investigation remains the internal-assessment component.`,
  papers: [
    { name: "Paper 1A", format: "Multiple-choice questions" },
    { name: "Paper 1B", format: "Data-based and experimental-work questions" },
    { name: "Paper 2", format: level === "HL" ? "Short-answer and extended-response questions at HL depth" : "Short-answer and extended-response questions" },
    { name: "Scientific investigation", format: "Internal assessment report", weighting: "20%" },
  ],
  caveat: "The bank also contains legacy 2016–2024 Papers 1, 2, and 3. Current-paper timings and marks vary by subject and level; confirm them in the official guide linked below before planning a timed sitting.",
});

const ibEconomics = (level: "HL" | "SL"): AssessmentGuide => ({
  version: "First assessment 2022",
  summary: level === "HL"
    ? "HL combines extended response, data response, and a quantitative policy paper, plus three internally assessed commentaries."
    : "SL combines extended response and data response, plus three internally assessed commentaries.",
  papers: level === "HL" ? [
    { name: "Paper 1", format: "Extended response", duration: "1 hr 15 min", weighting: "20%" },
    { name: "Paper 2", format: "Data response", duration: "1 hr 45 min", weighting: "30%" },
    { name: "Paper 3", format: "Quantitative work and policy advice", duration: "1 hr 45 min", weighting: "30%" },
    { name: "Commentary portfolio", format: "Internal assessment", weighting: "20%" },
  ] : [
    { name: "Paper 1", format: "Extended response", duration: "1 hr 15 min", weighting: "30%" },
    { name: "Paper 2", format: "Data response", duration: "1 hr 45 min", weighting: "40%" },
    { name: "Commentary portfolio", format: "Internal assessment", weighting: "30%" },
  ],
  caveat: "The archive includes papers from before first assessment 2022. Keep legacy and current structures separate when planning timed practice.",
});

const GUIDES: Partial<Record<BankSlug, AssessmentGuide>> = {
  igcse: {
    version: "2025–2027 syllabus",
    summary: "Core and Extended candidates each take one non-calculator paper and one calculator paper. The pair is equally weighted within the chosen route.",
    papers: [
      { name: "Paper 1", route: "Core", format: "Non-calculator", duration: "1 hr 30 min", marks: "80", weighting: "50%" },
      { name: "Paper 3", route: "Core", format: "Calculator", duration: "1 hr 30 min", marks: "80", weighting: "50%" },
      { name: "Paper 2", route: "Extended", format: "Non-calculator", duration: "2 hr", marks: "100", weighting: "50%" },
      { name: "Paper 4", route: "Extended", format: "Calculator", duration: "2 hr", marks: "100", weighting: "50%" },
    ],
    caveat: "Older archive papers can follow earlier calculator and paper structures. Check the year before using a historical paper as a current-format mock.",
  },
  "igcse-additional": {
    version: "2025–2027 syllabus",
    summary: "All candidates take two equally weighted written papers. Paper 1 is non-calculator; Paper 2 allows a scientific calculator.",
    papers: [
      { name: "Paper 1", format: "Non-calculator written paper", duration: "2 hr", marks: "80", weighting: "50%" },
      { name: "Paper 2", format: "Calculator written paper", duration: "2 hr", marks: "80", weighting: "50%" },
    ],
    caveat: "The archive covers older syllabus cycles as well as the current one.",
  },
  "igcse-biology-0610": scienceCambridge("Biology"),
  "igcse-chemistry-0620": scienceCambridge("Chemistry"),
  "igcse-physics-0625": scienceCambridge("Physics"),
  "igcse-coordinated-sciences-0654": scienceCambridge("Co-ordinated Sciences"),
  // Durations and totals: the 2026–2027 syllabus assessment table (source workspace data/paper-facts.json).
  "a-level-maths-9709": {
    version: "2026–2027 syllabus",
    summary: "Students sit specific papers. AS Level: Paper 1 with Paper 2, 4 or 5. A Level: Papers 1, 3, 4 and 5, or Papers 1, 3, 5 and 6.",
    papers: [
      { name: "Paper 1", format: "Pure Mathematics 1", duration: "1 hr 50 min", marks: "75" },
      { name: "Paper 2", format: "Pure Mathematics 2 (AS only)", duration: "1 hr 15 min", marks: "50" },
      { name: "Paper 3", format: "Pure Mathematics 3", duration: "1 hr 50 min", marks: "75" },
      { name: "Paper 4", format: "Mechanics", duration: "1 hr 15 min", marks: "50" },
      { name: "Paper 5", format: "Probability & Statistics 1", duration: "1 hr 15 min", marks: "50" },
      { name: "Paper 6", format: "Probability & Statistics 2", duration: "1 hr 15 min", marks: "50" },
    ],
    caveat: "Papers 4 and 6 cannot be combined. Pure 2 counts towards AS Level only. The May/June 2020 papers were published but never sat.",
  },
  // Durations, totals and weightings: the 2025–2027 syllabus assessment overview (source workspace data/paper-facts.json).
  "a-level-physics-9702": {
    version: "2025–2027 syllabus",
    summary: "AS Level is Papers 1, 2 and 3. A Level adds Papers 4 and 5. This bank holds Papers 1, 2 and 4.",
    papers: [
      { name: "Paper 1", format: "Multiple choice (AS content)", duration: "1 hr 15 min", marks: "40", weighting: "31% of AS, 15.5% of A Level" },
      { name: "Paper 2", format: "AS structured questions", duration: "1 hr 15 min", marks: "60", weighting: "46% of AS, 23% of A Level" },
      { name: "Paper 4", format: "A Level structured questions", duration: "2 hr", marks: "100", weighting: "38.5% of A Level" },
    ],
    caveat: "Papers 3 (practical) and 5 (planning) are not in the bank. 2020–2021 papers follow the earlier syllabus; removed content sits under its own earlier-syllabus topics. The May/June 2020 papers were published but never sat.",
  },
  // Durations, totals and weightings: the 2025–2027 syllabus assessment overview (source workspace data/paper-facts.json).
  // Paper 1 was 1 hour in 2020–2021 (2019–2021 syllabus and those question paper covers).
  "a-level-chemistry-9701": {
    version: "2025–2027 syllabus",
    summary: "AS Level is Papers 1, 2 and 3. A Level adds Papers 4 and 5. This bank holds Papers 1, 2 and 4.",
    papers: [
      { name: "Paper 1", format: "Multiple choice (AS content)", duration: "1 hr 15 min (1 hr in 2020–21)", marks: "40", weighting: "31% of AS, 15.5% of A Level" },
      { name: "Paper 2", format: "AS structured questions", duration: "1 hr 15 min", marks: "60", weighting: "46% of AS, 23% of A Level" },
      { name: "Paper 4", format: "A Level structured questions", duration: "2 hr", marks: "100", weighting: "38.5% of A Level" },
    ],
    caveat: "Papers 3 (practical) and 5 (planning) are not in the bank. 2020–2021 papers follow the earlier syllabus; removed content sits under its own earlier-syllabus topics. The May/June 2020 papers were published but never sat.",
  },
  // Durations, totals and weightings: the 2025–2027 syllabus assessment overview, p. 10 (source workspace data/paper-facts.json).
  // Paper 1 was 1 hour in 2020–2021 (2019–2021 syllabus and those question paper covers). In 2020–2021 Paper 4, Section B was a
  // choice of two 15-mark essays; candidates answered one.
  "a-level-biology-9700": {
    version: "2025–2027 syllabus",
    summary: "AS Level is Papers 1, 2 and 3. A Level adds Papers 4 and 5. This bank holds Papers 1, 2 and 4.",
    papers: [
      { name: "Paper 1", format: "Multiple choice (AS content)", duration: "1 hr 15 min (1 hr in 2020–21)", marks: "40", weighting: "31% of AS, 15.5% of A Level" },
      { name: "Paper 2", format: "AS structured questions", duration: "1 hr 15 min", marks: "60", weighting: "46% of AS, 23% of A Level" },
      { name: "Paper 4", format: "A Level structured questions", duration: "2 hr", marks: "100", weighting: "38.5% of A Level" },
    ],
    caveat: "Papers 3 (practical) and 5 (planning) are not in the bank. 2020–2021 papers follow the earlier syllabus; removed content sits under its own earlier-syllabus topics. In 2020–2021 Paper 4, candidates answered one of the two Section B essays (Q9 or Q10). The May/June 2020 papers were published but never sat.",
  },
  // Durations, totals and weightings: the 2026–2028 syllabus assessment overview, p. 11 (same in 2023–2025; source workspace
  // data/paper-facts.json). 2020–2022 papers used the 2019–2021/2022 syllabuses: Paper 2 was 40 marks in 1 hr 30 min and
  // Paper 4 was 70 marks in 2 hr 15 min, with two 25-mark essays from six.
  "a-level-economics-9708": {
    version: "2026–2028 syllabus",
    summary: "AS Level is Papers 1 and 2. A Level adds Papers 3 and 4. This bank holds all four papers.",
    papers: [
      { name: "Paper 1", format: "AS multiple choice", duration: "1 hr", marks: "30", weighting: "33% of AS, 17% of A Level" },
      { name: "Paper 2", format: "AS data response and essays", duration: "2 hr (1 hr 30 min in 2020–22)", marks: "60 (40 in 2020–22)", weighting: "67% of AS, 33% of A Level" },
      { name: "Paper 3", format: "A Level multiple choice", duration: "1 hr 15 min", marks: "30", weighting: "17% of A Level" },
      { name: "Paper 4", format: "A Level data response and essays", duration: "2 hr (2 hr 15 min in 2020–22)", marks: "60 (70 in 2020–22)", weighting: "33% of A Level" },
    ],
    caveat: "Section A data response is compulsory; you choose the essays (from 2023, one from Section B and one from Section C on each written paper). 2020–2022 papers follow the earlier syllabus; removed content sits under its own earlier-syllabus topics. The May/June 2020 papers were published but never sat.",
  },
  // Durations, totals and weightings: the 2026 syllabus assessment overview, p. 11 (identical in the 2021–2023 and 2024–2025
  // syllabuses). Paper 4 is a practical on a computer (Java, Visual Basic or Python), 2 hr 30 min, 75 marks, 25% of A Level.
  "a-level-computer-science-9618": {
    version: "2026 syllabus",
    summary: "AS Level is Papers 1 and 2. A Level adds Papers 3 and 4. This bank holds Papers 1, 2 and 3.",
    papers: [
      { name: "Paper 1", format: "Theory Fundamentals (sections 1–8)", duration: "1 hr 30 min", marks: "75", weighting: "50% of AS, 25% of A Level" },
      { name: "Paper 2", format: "Problem-solving and programming, in pseudocode (sections 9–12)", duration: "2 hr", marks: "75", weighting: "50% of AS, 25% of A Level" },
      { name: "Paper 3", format: "Advanced Theory (sections 13–20)", duration: "1 hr 30 min", marks: "75", weighting: "25% of A Level" },
    ],
    caveat: "Paper 4 (practical, programmed on a computer) is not in the bank. Calculators are not allowed in any paper.",
  },
  // Durations, totals and weightings: the 2026-2027 syllabus assessment overview, p. 11, and routes, p. 12 (the same in the
  // 2020-2022 and 2023-2025 syllabuses).
  "a-level-further-maths-9231": {
    version: "2026–2027 syllabus",
    summary: "AS Level is Paper 1 with Paper 3 or Paper 4. A Level is all four papers. Every question is compulsory.",
    papers: [
      { name: "Paper 1", format: "Further Pure Mathematics 1", duration: "2 hr", marks: "75", weighting: "60% of AS, 30% of A Level" },
      { name: "Paper 2", format: "Further Pure Mathematics 2", duration: "2 hr", marks: "75", weighting: "30% of A Level" },
      { name: "Paper 3", format: "Further Mechanics", duration: "1 hr 30 min", marks: "50", weighting: "40% of AS, 20% of A Level" },
      { name: "Paper 4", format: "Further Probability & Statistics", duration: "1 hr 30 min", marks: "50", weighting: "40% of AS, 20% of A Level" },
    ],
    caveat: "Paper 2 is A Level only. Knowledge of 9709 Mathematics is assumed. Candidates get the MF19 formula list and use a scientific calculator. The May/June 2020 papers were published but never sat.",
  },
  "igcse-economics-0455": {
    version: "2026 syllabus",
    summary: "There is no Core or Extended route. Paper 1 checks broad knowledge through multiple choice; Paper 2 tests structured economic reasoning, calculations, data interpretation, analysis, and evaluation.",
    papers: [
      { name: "Paper 1", format: "Multiple choice", duration: "45 min", marks: "30", weighting: "30%" },
      { name: "Paper 2", format: "Structured questions", duration: "2 hr 15 min", marks: "90", weighting: "70%" },
    ],
    caveat: "Historical archive papers span earlier syllabus cycles; use this table for the named current syllabus only.",
  },
};

export function assessmentGuideFor(bank: CatalogBank): AssessmentGuide {
  const exact = GUIDES[bank.slug];
  if (exact) return exact;
  if (bank.subject === "Mathematics AA") return ibMath(bank.level as "HL" | "SL", false);
  if (bank.subject === "Mathematics AI") return ibMath(bank.level as "HL" | "SL", true);
  if (["Biology", "Chemistry", "Physics"].includes(bank.subject)) return ibScience(bank.subject, bank.level as "HL" | "SL");
  if (bank.subject === "Economics") return ibEconomics(bank.level as "HL" | "SL");
  return {
    version: "Check the current official guide",
    summary: "Assessment structures can change between syllabus cycles. Use the official course source for current timings, marks, and weighting.",
    papers: [],
  };
}
