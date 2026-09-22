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
    { name: "Paper 3", route: "Core", format: "Theory", duration: "1 hr 15 min", marks: "120", weighting: "50%" },
    { name: "Paper 4", route: "Extended", format: "Theory", duration: "1 hr 15 min", marks: "120", weighting: "50%" },
    { name: "Paper 5", route: "Both routes", format: "Practical test", duration: "1 hr 15 min", marks: "60", weighting: "20%" },
    { name: "Paper 6", route: "Both routes", format: "Alternative to practical", duration: "1 hr 40 min", marks: "60", weighting: "20%" },
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
