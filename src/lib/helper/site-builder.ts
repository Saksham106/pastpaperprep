import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BankSlug } from "@/lib/banks";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { buildTopicIndex, selectionMatcher, type BuilderQuestion, type TopicNode } from "@/lib/builder-topics";
import { serializeBuilderState } from "@/lib/builder-url";
import { deriveCourseRoute, matchesCourseRoute, routeConfigFor, supportsCourseRoute } from "@/lib/course-route";
import { MAX_DRAFT_QUESTIONS, reconcileDraft, type DraftTarget } from "@/lib/paper-draft";
import type { PublicBankIndex } from "@/lib/question-index";

// Pepper's practice sets are built with the paper builder's own code (src/components/PaperBuilder.tsx), on the same
// public bank index the builder loads, so the set Pepper describes is exactly the one the builder shows from the link:
// same pool, same topic index, same seeded draft. Saving stays in the builder, with its own checks.

export const MAX_SET_MARKS = 200;

type Reader = (file: string) => Promise<string>;
const readBankIndex: Reader = (file) => readFile(join(process.cwd(), "public", "bank-index", file), "utf8");
const cache = new Map<string, Promise<BuilderQuestion[]>>();

/** The questions the builder can use for a bank: as it loads them (images and positive marks only). */
export function loadBuilderQuestions(bank: BankSlug, read: Reader = readBankIndex): Promise<BuilderQuestion[] | null> {
  const file = (PUBLIC_BANK_INDEX_FILES as Partial<Record<string, string>>)[bank];
  if (!file) return Promise.resolve(null);
  const load = async () => {
    const index = JSON.parse(await read(file)) as PublicBankIndex;
    if (index.version !== 1 || index.bank !== bank || !Array.isArray(index.questions)) throw new Error("Bank index unavailable");
    return index.questions
      .filter((question) => question.questionImageCount > 0 && Number.isInteger(question.marks) && question.marks! > 0)
      .map((question) => ({ ...question, bankSlug: bank }));
  };
  if (read !== readBankIndex) return load();
  let entry = cache.get(file);
  if (!entry) {
    entry = load();
    cache.set(file, entry);
    void entry.catch(() => { if (cache.get(file) === entry) cache.delete(file); });
  }
  return entry;
}

export type PracticeSetInput = {
  bank: BankSlug;
  topics: string[];
  subtopics: string[];
  yearFrom?: number;
  yearTo?: number;
  route: "all" | "core" | "extended";
  /** A mock of one paper: the target applies to that paper only. */
  paper?: number;
  size: { kind: "questions" | "marks"; amount: number };
  seed: number;
};

export type PracticeSet =
  | { ok: true; path: string; label: string; questions: number; marks: number; years: [number, number]; papers: number[] }
  | { ok: false; error: string };

const norm = (value: string) => value.trim().toLowerCase();

/** Picks the builder's topic-tree keys for the given labels; unknown labels are reported, never dropped. */
function resolveSelection(tree: readonly TopicNode[], topics: readonly string[], subtopics: readonly string[]) {
  const keys: string[] = [];
  const labels: string[] = [];
  const unknown: string[] = [];
  const raw = (key: string) => key.slice(2).split("␟").pop() ?? "";
  for (const wanted of topics) {
    const node = tree.find((item) => norm(item.label) === norm(wanted) || norm(raw(item.key)) === norm(wanted));
    if (node) { keys.push(node.key); labels.push(node.label); } else unknown.push(wanted);
  }
  for (const wanted of subtopics) {
    const node = tree.flatMap((item) => item.subtopics).find((item) => norm(item.label) === norm(wanted) || norm(raw(item.key)) === norm(wanted));
    if (node) { keys.push(node.key); labels.push(node.label); } else unknown.push(wanted);
  }
  // As in the builder, a topic and its own subtopics never combine: the subtopics are the more specific ask, and keeping
  // the whole topic too would let every question in it match ("indices like this" must not pull in all of Number).
  const narrowed = new Set(keys.filter((key) => key.startsWith("s:")).map((key) => key.slice(2).split("␟")[0]));
  const kept = [...new Set(keys)].filter((key) => !(key.startsWith("t:") && narrowed.has(key.slice(2))));
  const keptLabels = tree.flatMap((node) => [node, ...node.subtopics]).filter((node) => kept.includes(node.key)).map((node) => node.label);
  return { keys: kept, labels: keptLabels, unknown };
}

/**
 * Plans a practice set exactly as the builder would build it from the link, or explains why it can't be made.
 * An impossible target is refused (with what is available), never quietly underfilled.
 */
export function planPracticeSet(questions: readonly BuilderQuestion[], input: PracticeSetInput, subjectName: string): PracticeSet {
  const { bank, size } = input;
  if (!questions.length) return { ok: false, error: `${subjectName} has no questions the paper builder can use.` };
  if (!Number.isInteger(size.amount) || size.amount < 1) return { ok: false, error: "Ask for at least 1 question or mark." };
  if (size.kind === "questions" && size.amount > MAX_DRAFT_QUESTIONS) return { ok: false, error: `A practice set holds at most ${MAX_DRAFT_QUESTIONS} questions.` };
  if (size.kind === "marks" && size.amount > MAX_SET_MARKS) return { ok: false, error: `A practice set holds at most ${MAX_SET_MARKS} marks.` };
  if (input.yearFrom && input.yearTo && input.yearFrom > input.yearTo) return { ok: false, error: "The first year is after the last year." };

  const topicIndex = buildTopicIndex(questions, bank);
  const selection = resolveSelection(topicIndex.tree, input.topics, input.subtopics);
  if (selection.unknown.length) {
    return { ok: false, error: `These aren't topics in the ${subjectName} paper builder: ${selection.unknown.join(", ")}. Topics there: ${topicIndex.tree.map((node) => node.label).join("; ")}.` };
  }

  // The builder's own pool: route (Core/Extended only), years, then topics (main topic only).
  const routed = supportsCourseRoute(bank) && !routeConfigFor(bank)?.hidesPaperFilter;
  const route = routed ? input.route : "all";
  const inRoute = (paper: number) => route === "all" || matchesCourseRoute(deriveCourseRoute(bank, paper), route);
  const basePool = questions.filter((question) => inRoute(question.paper) && (!input.yearFrom || question.year >= input.yearFrom) && (!input.yearTo || question.year <= input.yearTo));
  const match = selectionMatcher(topicIndex, new Set(selection.keys), "main");
  const pool = basePool.filter((question) => match(question.id));
  if (input.paper !== undefined && !questions.some((question) => question.paper === input.paper && inRoute(question.paper))) {
    return { ok: false, error: `${subjectName} has no Paper ${input.paper}${route !== "all" ? ` in the ${route} route` : ""}.` };
  }
  const paperPool = input.paper !== undefined ? pool.filter((question) => question.paper === input.paper) : pool;
  if (!paperPool.length) return { ok: false, error: "No questions match those choices. Widen the years or topics." };

  const target: DraftTarget = input.paper !== undefined
    ? { kind: "papers", targets: [{ paper: input.paper, mode: size.kind, amount: size.amount }] }
    : { kind: size.kind, amount: size.amount };
  const draft = reconcileDraft([], pool, target, input.seed, false);
  if (!draft.exact || !draft.ids.length) {
    const available = paperPool.length;
    const marks = paperPool.reduce((sum, question) => sum + (question.marks ?? 0), 0);
    return { ok: false, error: `Only ${available} matching questions (${marks} marks) exist, so ${size.amount} ${size.kind} can't be met exactly. Offer a smaller set or wider choices.` };
  }

  const byId = new Map(questions.map((question) => [question.id, question]));
  const chosen = draft.ids.map((id) => byId.get(id)!).filter(Boolean);
  const years = chosen.map((question) => question.year);
  const query = serializeBuilderState({
    bank, route, ...(input.yearFrom ? { from: input.yearFrom } : {}), ...(input.yearTo ? { to: input.yearTo } : {}),
    // The chosen questions go in the link too: the builder keeps listed questions as they are, so it shows exactly
    // this set (its first draft runs before the link's topics apply, so the seed alone could pick differently).
    selection: selection.keys, target, seed: input.seed, ids: draft.ids, removed: [], reordered: false, partial: false,
  });
  const first = input.yearFrom ?? Math.min(...years), last = input.yearTo ?? Math.max(...years);
  const span = input.yearFrom || input.yearTo ? (first === last ? String(first) : `${first}–${last}`) : "";
  const label = [
    `${chosen.length} ${chosen.length === 1 ? "question" : "questions"}`,
    selection.labels.length ? selection.labels.slice(0, 2).join(", ") + (selection.labels.length > 2 ? "…" : "") : subjectName,
    input.paper !== undefined ? `Paper ${input.paper}` : "",
    span,
    `${draft.totalMarks} marks`,
  ].filter(Boolean).join(" · ");
  return {
    ok: true,
    path: `/worksheets/build?${query}`,
    label,
    questions: chosen.length,
    marks: draft.totalMarks,
    years: [Math.min(...years), Math.max(...years)],
    papers: [...new Set(chosen.map((question) => question.paper))].sort((a, b) => a - b),
  };
}
