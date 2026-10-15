import type { CourseRouteSelection } from "@/lib/course-route";
import { MAX_DRAFT_QUESTIONS, type DraftTarget, type PaperDraftTarget } from "@/lib/paper-draft";

/**
 * Everything needed to rebuild the paper on screen from a link: the choices, the seed for future
 * top-ups, and the paper itself (its questions in order, plus the ones the student removed).
 */
export type BuilderState = {
  bank?: string; route: CourseRouteSelection; from?: number; to?: number; selection: string[]; target: DraftTarget; seed?: number;
  ids: string[]; removed: string[]; reordered: boolean;
};
const QUESTION_ID = /^[A-Za-z0-9._:-]{1,120}$/;
const MAX_REMOVED = 200;

const MAX_MARKS = 200;
const DEFAULT_TARGET: DraftTarget = { kind: "questions", amount: 10 };
const clamp = (mode: "questions" | "marks", amount: number) => Math.min(amount, mode === "questions" ? MAX_DRAFT_QUESTIONS : MAX_MARKS);
const year = (value: string | null) => value && /^\d{4}$/.test(value) ? Number(value) : undefined;

function parseSize(value: string | null): DraftTarget | null {
  const match = value?.match(/^([qm])(\d{1,4})$/);
  if (!match || Number(match[2]) < 1) return null;
  const mode = match[1] === "q" ? "questions" : "marks";
  return { kind: mode, amount: clamp(mode, Number(match[2])) };
}

function parsePapers(value: string | null): PaperDraftTarget[] {
  const targets = new Map<number, PaperDraftTarget>();
  for (const part of value?.split(",") ?? []) {
    const match = part.match(/^(\d{1,2})([qm])(\d{1,4})$/);
    if (!match || Number(match[1]) < 1 || Number(match[3]) < 1) continue;
    const mode = match[2] === "q" ? "questions" : "marks";
    targets.set(Number(match[1]), { paper: Number(match[1]), mode, amount: clamp(mode, Number(match[3])) });
  }
  return [...targets.values()].sort((a, b) => a.paper - b.paper);
}

export function parseBuilderState(params: URLSearchParams): BuilderState {
  const bank = params.get("bank");
  const route = params.get("route");
  const seed = params.get("seed");
  const papers = parsePapers(params.get("papers"));
  const state: BuilderState = {
    route: route === "core" || route === "extended" ? route : "all",
    selection: params.getAll("t").filter(Boolean),
    target: papers.length ? { kind: "papers", targets: papers } : parseSize(params.get("size")) ?? DEFAULT_TARGET,
    ids: [...new Set(params.getAll("q").filter((id) => QUESTION_ID.test(id)))].slice(0, MAX_DRAFT_QUESTIONS),
    removed: [...new Set(params.getAll("x").filter((id) => QUESTION_ID.test(id)))].slice(0, MAX_REMOVED),
    reordered: params.get("o") === "1",
  };
  if (bank && /^[a-z0-9-]{1,40}$/.test(bank)) state.bank = bank;
  const from = year(params.get("from")), to = year(params.get("to"));
  if (from) state.from = from;
  if (to) state.to = to;
  if (seed && /^\d{1,10}$/.test(seed) && Number(seed) <= 0xffffffff) state.seed = Number(seed);
  return state;
}

export function serializeBuilderState(state: BuilderState): string {
  const params = new URLSearchParams();
  if (state.bank) params.set("bank", state.bank);
  if (state.route !== "all") params.set("route", state.route);
  if (state.from) params.set("from", String(state.from));
  if (state.to) params.set("to", String(state.to));
  for (const key of state.selection) params.append("t", key);
  if (state.target.kind === "papers") params.set("papers", state.target.targets.map((item) => `${item.paper}${item.mode[0]}${item.amount}`).join(","));
  else params.set("size", `${state.target.kind[0]}${state.target.amount}`);
  if (state.seed !== undefined) params.set("seed", String(state.seed));
  for (const id of state.ids) params.append("q", id);
  for (const id of state.removed.slice(0, MAX_REMOVED)) params.append("x", id);
  if (state.reordered) params.set("o", "1");
  return params.toString();
}
