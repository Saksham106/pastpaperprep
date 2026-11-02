// Client-safe: lesson schema shared by the validator, the loaders and the lesson pages. No katex here.
export type Level = "SL" | "AHL";
export type Paper = "P1" | "P2" | "P3";
export type FormulaTag = "booklet" | "learn";

export const INTERACTIVE_IDS = [
  "parts-area", "transformations", "discriminant-roots", "exp-log-reflection", "unit-circle-graphs", "radian-arc",
  "secant-to-tangent", "derivative-sign", "riemann-sums", "area-between-curves", "revolution-slice", "binomial-shaded",
  "normal-shaded", "z-standardise", "regression-two-lines", "argand-multiply", "roots-of-unity", "vector-angle",
  "maclaurin-partials", "euler-step",
] as const;
export type InteractiveId = (typeof INTERACTIVE_IDS)[number];

/** Props each widget reads: a numeric [min, max] range or the allowed string values. Out-of-range values fall back to the default. */
export type InteractivePropSpec = Record<string, readonly [number, number] | readonly string[]>;
export const INTERACTIVE_PROPS: Record<InteractiveId, InteractivePropSpec> = {
  "parts-area": { b: [0.5, 2.4] },
  transformations: {},
  "discriminant-roots": { a: [-3, 3], b: [-6, 6], c: [-6, 6] },
  "exp-log-reflection": { a: [0.2, 4] },
  "unit-circle-graphs": { theta: [0, 6.28] },
  "radian-arc": { theta: [0, 2 * Math.PI], r: [0.5, 3] },
  "secant-to-tangent": { h: [0.01, 1.5], curve: ["square", "cube"] },
  "derivative-sign": { x: [-2.2, 2.2] },
  "riemann-sums": { n: [1, 50], mode: ["left", "right", "mid"] },
  "area-between-curves": { pair: ["x-x2", "x+2-x2"], b: [-1, 2] },
  "revolution-slice": { shape: ["sqrt", "line"], b: [0.5, 4], x0: [0, 4] },
  "binomial-shaded": { n: [1, 30], p: [0.05, 0.95], k: [0, 30], mode: ["eq", "le", "ge"] },
  "normal-shaded": { mu: [-20, 150], sigma: [0.5, 30], mode: ["between", "below", "above"] },
  "z-standardise": { mu: [50, 150], sigma: [5, 30], z: [-4, 4], p: [0.01, 0.99], mode: ["x", "p"] },
  "regression-two-lines": { x: [0.5, 6.5], y: [0.5, 6.5] },
  "argand-multiply": { r1: [0.5, 2.5], d1: [-180, 180], r2: [0.5, 2.5], d2: [-180, 180] },
  "roots-of-unity": { n: [2, 12], mode: ["unity", "general"], r: [0.5, 3], theta: [-180, 180] },
  "vector-angle": { a1: [-5, 5], a2: [-5, 5], b1: [-5, 5], b2: [-5, 5] },
  "maclaurin-partials": { fn: ["exp", "sin", "cos", "ln"], n: [1, 8], x0: [-6, 6] },
  "euler-step": { h: [0.05, 0.5] },
};

/** Strings marked "inline" accept `$tex$`, `[[term-id|label]]` and `{{lesson:5.15}}`. */
export type CheckBlock = {
  type: "check";
  id: string;
  prompt: string;
  /** Required: a nudge that does not give the answer away. */
  hint: string;
  /** Multiple choice: exactly the options a student sees; `correct` marks the right one. */
  options?: { text: string; correct: boolean }[];
  /** Numeric answer accepted within `tolerance`. */
  answer?: { value: number; tolerance: number };
  explain: string;
};

export type Block =
  | { type: "text"; text: string }
  | { type: "definition"; term: string; statement: string; plain: string }
  | { type: "formula"; tex: string; tag: FormulaTag; bookletId?: string; cheatSheet?: boolean }
  | { type: "result"; statement: string; why: string }
  | { type: "example"; id: string; question: string; steps: string[]; answer: string; check?: CheckBlock; video: null }
  | CheckBlock
  | { type: "figure"; id: string; alt: string; caption?: string }
  | { type: "interactive"; widget: InteractiveId; props: Record<string, unknown>; alt: string }
  | { type: "calculator"; steps: { ti84: string[]; nspire: string[]; casio: string[] } }
  | { type: "hlNote"; text: string; lesson: string }
  | { type: "examTip"; text: string }
  | { type: "mistake"; text: string }
  | { type: "fact"; text: string; tag: FormulaTag; cheatSheet: true };

export type Section = { id: string; heading: string; blocks: Block[] };

export type Lesson = {
  schemaVersion: 1;
  edition: "aa-2021";
  item: string;
  slug: string;
  title: string;
  level: Level;
  topic: 1 | 2 | 3 | 4 | 5;
  summary: string;
  goals: { text: string; bullets: string[] }[];
  prerequisites: string[];
  papers: Paper[];
  synonyms: string[];
  before: CheckBlock[];
  sections: Section[];
  mistakes: string[];
  examTips: string[];
  readingMinutes: number;
};

export type GlossaryTerm = { id: string; term: string; definition: string; lesson: string };

export type ItemsFile = {
  schemaVersion: 1;
  edition: "aa-2021";
  items: {
    item: string;
    topic: 1 | 2 | 3 | 4 | 5;
    level: Level;
    name: string;
    bullets: { id: string; text: string }[];
    booklet: { id: string; label: string }[];
  }[];
};

/** Sheet-only lines ("which method when") that no lesson block carries. `text` is inline text. */
export type CheatSheetLine = { text: string; tag: FormulaTag; level: Level };
export type CheatSheetFile = { lines: CheatSheetLine[] };
