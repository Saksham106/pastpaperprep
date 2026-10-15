import { examOrder, exactMarks, shuffled, type PaperCandidate } from "@/lib/paper-builder";

export { examOrder };
export const MAX_DRAFT_QUESTIONS = 50;
export type PaperDraftTarget = { paper: number; mode: "questions" | "marks"; amount: number };
export type DraftTarget =
  | { kind: "questions"; amount: number }
  | { kind: "marks"; amount: number }
  | { kind: "papers"; targets: PaperDraftTarget[] };
export type DraftResult = { ids: string[]; totalMarks: number; exact: boolean; shortBy: number };

const marksOf = (questions: readonly PaperCandidate[]) => questions.reduce((sum, question) => sum + (question.marks ?? 0), 0);
const paperSeed = (seed: number, paper: number) => (seed ^ Math.imul(paper, 2654435761)) >>> 0;

/** Fill one target from a pool, keeping what is already chosen. Returns the questions and the shortfall. */
function fill(kept: PaperCandidate[], pool: readonly PaperCandidate[], mode: "questions" | "marks", amount: number, seed: number, room: number) {
  const chosen = new Set(kept.map((question) => question.id));
  const rest = shuffled(pool.filter((question) => !chosen.has(question.id)), seed);
  if (mode === "questions") {
    const wanted = Math.min(amount, room);
    const result = kept.slice(0, wanted);
    for (const question of rest) { if (result.length >= wanted) break; result.push(question); }
    return { result, shortBy: amount - result.length };
  }
  const result = kept.slice(0, room);
  while (result.length && marksOf(result) > amount) result.pop();
  const need = amount - marksOf(result);
  const exact = need > 0 ? exactMarks(rest, need, room - result.length) : [];
  if (exact) result.push(...exact);
  else {
    // No exact total: take the biggest questions that still fit, so the paper lands as close as it can.
    for (const question of [...rest].sort((a, b) => (b.marks ?? 0) - (a.marks ?? 0))) {
      if (result.length >= room) break;
      if (marksOf(result) + (question.marks ?? 0) <= amount) result.push(question);
    }
  }
  return { result, shortBy: amount - marksOf(result) };
}

/** Keep the questions that still fit the choices, then trim or top up to the target. */
export function reconcileDraft(current: readonly string[], pool: readonly PaperCandidate[], target: DraftTarget, seed: number, manualOrder: boolean): DraftResult {
  const byId = new Map(pool.map((question) => [question.id, question]));
  const kept = current.map((id) => byId.get(id)).filter((question): question is PaperCandidate => Boolean(question));
  let chosen: PaperCandidate[] = [];
  let shortBy = 0;
  if (target.kind === "papers") {
    for (const { paper, mode, amount } of [...target.targets].sort((a, b) => a.paper - b.paper)) {
      const filled = fill(kept.filter((question) => question.paper === paper), pool.filter((question) => question.paper === paper),
        mode, amount, paperSeed(seed, paper), MAX_DRAFT_QUESTIONS - chosen.length);
      chosen.push(...filled.result);
      shortBy += filled.shortBy;
    }
  } else {
    const filled = fill(kept, pool, target.kind, target.amount, seed, MAX_DRAFT_QUESTIONS);
    chosen = filled.result;
    shortBy = filled.shortBy;
  }
  if (manualOrder) {
    const picked = new Set(chosen.map((question) => question.id));
    const keptIds = new Set(kept.map((question) => question.id));
    chosen = [...kept.filter((question) => picked.has(question.id)), ...chosen.filter((question) => !keptIds.has(question.id))];
  } else chosen = examOrder(chosen);
  return { ids: chosen.map((question) => question.id), totalMarks: marksOf(chosen), exact: shortBy === 0, shortBy };
}

/** Another matching question for this slot: same marks first for a marks target, then same topic, then same paper. */
export function swapCandidate(paperIds: readonly string[], id: string, pool: readonly PaperCandidate[], target: DraftTarget, seed: number): string | null {
  const outgoing = pool.find((question) => question.id === id);
  if (!outgoing) return null;
  const inPaper = new Set(paperIds);
  let candidates = pool.filter((question) => !inPaper.has(question.id));
  if (target.kind === "papers") candidates = candidates.filter((question) => question.paper === outgoing.paper);
  const tiers = [
    ...(target.kind === "marks" ? [(question: PaperCandidate) => question.marks === outgoing.marks] : []),
    (question: PaperCandidate) => question.primaryTopic === outgoing.primaryTopic,
    (question: PaperCandidate) => question.paper === outgoing.paper,
    () => true,
  ];
  for (const tier of tiers) {
    const options = candidates.filter(tier);
    if (options.length) return shuffled(options, seed)[0].id;
  }
  return null;
}

/** Removing a question shrinks the target, so the live paper does not simply refill the gap. */
export function lowerTarget(target: DraftTarget, removed: PaperCandidate): DraftTarget {
  const marks = removed.marks ?? 0;
  if (target.kind === "questions") return { kind: "questions", amount: Math.max(0, target.amount - 1) };
  if (target.kind === "marks") return { kind: "marks", amount: Math.max(0, target.amount - marks) };
  return {
    kind: "papers",
    targets: target.targets
      .map((item) => item.paper !== removed.paper ? item : { ...item, amount: Math.max(0, item.amount - (item.mode === "questions" ? 1 : marks)) })
      .filter((item) => item.amount > 0),
  };
}
