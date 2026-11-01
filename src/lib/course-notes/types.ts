// Client-safe: lesson schema shared by the validator, the loaders and the lesson pages. No katex here.
export type Level = "SL" | "AHL";
export type Paper = "P1" | "P2" | "P3";
export type FormulaTag = "booklet" | "learn";

export const INTERACTIVE_IDS = [
  "parts-area", "transformations", "discriminant-roots", "exp-log-reflection", "unit-circle-graphs", "radian-arc",
  "secant-to-tangent", "derivative-sign", "riemann-sums", "area-between-curves", "revolution-slice", "binomial-shaded",
  "normal-shaded", "normal-approx-binomial", "regression-residuals", "argand-multiply", "roots-of-unity", "vector-angle",
  "maclaurin-partials", "euler-step",
] as const;
export type InteractiveId = (typeof INTERACTIVE_IDS)[number];

/** Strings marked "inline" accept `$tex$`, `[[term-id|label]]` and `{{lesson:5.15}}`. */
export type CheckBlock = {
  type: "check";
  id: string;
  prompt: string;
  hint?: string;
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
