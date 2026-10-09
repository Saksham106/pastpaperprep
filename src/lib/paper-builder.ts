import type { PublicQuestionMetadata } from "@/lib/question-index";
import type { BankSlug } from "@/lib/banks";
import { isCleanMathsBank, mathsSubtopicMatches, mathsTopicMatches } from "@/lib/maths-picker";
import { deriveCourseRoute, matchesCourseRoute, supportsCourseRoute, type CourseRouteSelection } from "@/lib/course-route";

export type PaperCandidate = Pick<PublicQuestionMetadata, "id" | "paper" | "year" | "marks" | "primaryTopic" | "secondaryTopics"> & { subtopics?: string[]; calculator?: boolean | null };

/** The calculator status shared by every question of a paper in the pool, or null when unknown or mixed. */
export function paperCalculator(pool: readonly { paper: number; calculator?: boolean | null }[], paper: number): boolean | null {
  const values = new Set(pool.filter((question) => question.paper === paper).map((question) => question.calculator ?? null));
  return values.size === 1 ? [...values][0] : null;
}
export type PaperTarget = { paper: number; amount: number };
export type PaperPlan = { mode: "questions" | "marks"; targets: PaperTarget[]; seed: number; yearFrom?: number; yearTo?: number; topics?: string[]; subtopics?: string[]; bank?: BankSlug; courseRoute?: CourseRouteSelection };

function shuffled<T>(items: readonly T[], initialSeed: number): T[] {
  let seed = initialSeed >>> 0;
  const result = [...items];
  function random() {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function exactMarks(pool: PaperCandidate[], target: number, maxQuestions: number): PaperCandidate[] | null {
  const sums = new Map<number, PaperCandidate[]>([[0, []]]);
  for (const question of pool) {
    const marks = question.marks!;
    if (marks > target) continue;
    // Snapshot before adding this question so it cannot be selected twice.
    for (const [sum, selected] of [...sums].sort((a, b) => b[0] - a[0])) {
      const next = sum + marks;
      const existing = sums.get(next);
      if (next <= target && selected.length < maxQuestions && (!existing || selected.length + 1 < existing.length)) {
        sums.set(next, [...selected, question]);
      }
    }
    if (sums.has(target)) return sums.get(target)!;
  }
  return null;
}

/** Select source-backed questions from the public metadata index; saving rechecks IDs and access server-side. */
export function generatePaper(questions: readonly PaperCandidate[], plan: PaperPlan): { questions: PaperCandidate[]; totalMarks: number } {
  const { mode, targets, seed, yearFrom, yearTo, topics = [], subtopics = [], bank, courseRoute = "all" } = plan;
  if (mode !== "questions" && mode !== "marks") throw new Error("Choose questions or marks");
  if (!Number.isInteger(seed) || !targets.length || targets.some(({ paper, amount }) => !Number.isInteger(paper) || paper < 1 || !Number.isInteger(amount) || amount < 1)) throw new Error("Choose a positive target for at least one paper");
  if (new Set(targets.map(({ paper }) => paper)).size !== targets.length) throw new Error("Duplicate paper targets are not allowed");
  if (courseRoute !== "all" && courseRoute !== "core" && courseRoute !== "extended") throw new Error("Choose a valid course route");
  if (courseRoute !== "all" && (!bank || !supportsCourseRoute(bank))) throw new Error("Core and Extended routes are not available for this bank");
  if (courseRoute !== "all" && targets.some(({ paper }) => !matchesCourseRoute(deriveCourseRoute(bank!, paper), courseRoute))) {
    throw new Error(`${courseRoute === "core" ? "Core" : "Extended"} students cannot select Paper ${targets.find(({ paper }) => !matchesCourseRoute(deriveCourseRoute(bank!, paper), courseRoute))!.paper}`);
  }
  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) throw new Error("The first year must not be after the last year");
  if (mode === "questions" && targets.reduce((sum, target) => sum + target.amount, 0) > 50) throw new Error("A worksheet can contain at most 50 questions");
  if (mode === "marks" && targets.some(({ amount }) => amount > 200)) throw new Error("Choose at most 200 marks per paper");

  const eligible = [...new Map(questions.filter((question) =>
    Number.isInteger(question.marks) && question.marks! > 0 &&
    (yearFrom === undefined || question.year >= yearFrom) &&
    (yearTo === undefined || question.year <= yearTo) &&
    (!topics.length || topics.some((topic) => bank && isCleanMathsBank(bank) ? mathsTopicMatches({ ...question, bankSlug: bank, subtopics: question.subtopics ?? [] }, topic) : question.primaryTopic === topic || question.secondaryTopics.includes(topic))) &&
    (!subtopics.length || subtopics.some((subtopic) => bank && isCleanMathsBank(bank) ? mathsSubtopicMatches({ ...question, bankSlug: bank, subtopics: question.subtopics ?? [] }, subtopic) : question.subtopics?.includes(subtopic))) &&
    (courseRoute === "all" || matchesCourseRoute(deriveCourseRoute(bank!, question.paper), courseRoute))
  ).map((question) => [question.id, question])).values()];
  const selected: PaperCandidate[] = [];
  for (const { paper, amount } of targets) {
    const pool = shuffled(eligible.filter((question) => question.paper === paper && !selected.some((chosen) => chosen.id === question.id)), seed ^ (paper * 2654435761));
    if (mode === "questions") {
      if (pool.length < amount) throw new Error(`Paper ${paper}: requested ${amount} questions, but only ${pool.length} available with these filters`);
      selected.push(...pool.slice(0, amount));
    } else {
      const match = exactMarks(pool, amount, 50 - selected.length);
      if (!match) throw new Error(`Paper ${paper}: could not make exactly ${amount} marks with these filters and the 50-question limit`);
      selected.push(...match);
    }
  }
  if (selected.length > 50) throw new Error("A worksheet can contain at most 50 questions");
  return { questions: selected, totalMarks: selected.reduce((sum, question) => sum + question.marks!, 0) };
}
