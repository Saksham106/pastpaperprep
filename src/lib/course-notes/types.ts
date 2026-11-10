// Client-safe: lesson schema shared by the validator, the loaders and the lesson pages. No katex here.

/**
 * A syllabus level as the course stores it: AA uses "SL" / "AHL", IGCSE 0580 "Core" / "Extended".
 * The validator checks it against the course's `levels` config.
 */
export type Level = string;

/** The two views of the level switch: the base course, or base plus extension (AA: SL / HL). */
export type ViewLevel = "base" | "extension";

/** One number or link per view. */
export type PerView<T> = Record<ViewLevel, T>;

/**
 * A course's levels, from its course.json. `base` / `extension` are the stored lesson and item levels;
 * `labels` are what students see (the level switch, badges, "HL only").
 */
export type CourseLevels = {
  base: Level;
  extension: Level;
  labels: { base: string; extension: string; extensionOnly: string };
};
/** "P1", "P2", ...: the exam papers a lesson is assessed on. */
export type Paper = `P${number}`;
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

/**
 * Declarative answer check, read by scripts/notes/check-math.py (scripts/notes/verify_kinds.py implements each kind).
 * `truth` is a SymPy expression built from the question's own data, e.g. "sqrt(5**2 + 12**2)". Options per kind are
 * listed in VERIFY_KINDS (validate.ts). A sidecar entry for the same id, when there is one, is used instead.
 * Chemistry kinds: `chem-equation` (truth: the skeleton equation), `formula` (truth: a formula helper) and
 * `explanation` (truth: a one-line summary; `requires` / `forbids` are lists of phrases, a `requires` entry may be a
 * list of alternatives).
 * Number kinds take `unit` (kJ mol-1, m s-2, kΩ, MeV, ...) and `signed`. In a chemistry course truths can use the
 * chemistry data booklet constants (R, NA, F, ...); in a physics course (course.json gate.physics or an "ib-physics"
 * edition) the physics ones (g, G, c, h, e, me, ...) and degree trigonometry (sind, cosd, tand, asind, acosd, atand).
 * scripts/notes/verify_kinds.py documents every name and unit.
 */
export type VerifyPhrases = (string | string[])[];
export type Verify = { kind: string; truth: string } & Record<string, string | number | boolean | VerifyPhrases | Record<string, string[]>>;

/** Strings marked "inline" accept `$tex$`, `[[term-id|label]]` and `{{lesson:5.15}}`. */
export type CheckBlock = {
  type: "check";
  id: string;
  /** Extension-level content inside a base lesson (0580: Extended inside a Core section): hidden in the base view. */
  level?: Level;
  prompt: string;
  /** Required: a nudge that does not give the answer away. */
  hint: string;
  /** Multiple choice: exactly the options a student sees; `correct` marks the right one. */
  options?: { text: string; correct: boolean }[];
  /** Numeric answer accepted within `tolerance`. */
  answer?: { value: number; tolerance: number };
  explain: string;
  verify?: Verify;
};

/** Keystrokes per calculator model, keyed by the course's calculator ids (course.json `calculators`). */
export type CalculatorSteps = Record<string, string[]>;

/**
 * Either the keystrokes written out per model, or a vetted snippet from the course's calculator.json whose `{name}`
 * placeholders are filled from `values`.
 */
export type CalculatorBlock =
  | { type: "calculator"; steps: CalculatorSteps; level?: Level }
  | { type: "calculator"; snippet: string; values?: Record<string, string | number>; level?: Level };

/** src/content/notes/<course>/calculator.json */
export type CalculatorSnippets = Record<string, { title: string; steps: CalculatorSteps }>;

/**
 * `level` (optional on text, formula, example, check, figure, calculator and fact) marks extension-level content in a
 * base lesson: it is hidden in the base view. It defaults to the section's level, then the lesson's.
 */
export type Block =
  | { type: "text"; text: string; level?: Level }
  | { type: "definition"; term: string; statement: string; plain: string }
  | { type: "formula"; tex: string; tag: FormulaTag; bookletId?: string; cheatSheet?: boolean; level?: Level }
  | { type: "result"; statement: string; why: string }
  | { type: "example"; id: string; question: string; steps: string[]; answer: string; check?: CheckBlock; video: null; verify?: Verify; level?: Level }
  | CheckBlock
  | { type: "figure"; id: string; alt: string; caption?: string; level?: Level }
  | { type: "interactive"; widget: InteractiveId; props: Record<string, unknown>; alt: string }
  | CalculatorBlock
  | { type: "hlNote"; text: string; lesson: string }
  | { type: "examTip"; text: string }
  | { type: "mistake"; text: string }
  | { type: "fact"; text: string; tag: FormulaTag; cheatSheet: true; level?: Level };

/** `level: <extension>` makes the whole section extension content (hidden in the base view, badged in the other). */
export type Section = { id: string; heading: string; blocks: Block[]; level?: Level };

export type Lesson = {
  schemaVersion: 1;
  /** The syllabus edition, e.g. "aa-2021"; must match the course's items file. */
  edition: string;
  item: string;
  slug: string;
  title: string;
  level: Level;
  topic: number;
  summary: string;
  /** A goal covering extension-level bullets of a base item carries `level: <extension>` (hidden in the base view). */
  goals: { text: string; bullets: string[]; level?: Level }[];
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
  edition: string;
  items: {
    item: string;
    topic: number;
    level: Level;
    name: string;
    /** A bullet's own level when it differs from the item's (0580: Extended-only bullets of a Core section). */
    bullets: { id: string; text: string; level?: Level }[];
    booklet: { id: string; label: string }[];
    /** The bank subtopic label the item practises (a `bank-subtopics` course; several items may share one). */
    practice?: string;
    /** Other bank subtopic labels the lesson teaches (IB Maths AI: "The t-test" on the chi-squared lesson), so every label links to a lesson. */
    alsoPractises?: string[];
  }[];
};

/** Sheet-only lines ("which method when") that no lesson block carries. `text` is inline text. */
export type CheatSheetLine = { text: string; tag: FormulaTag; level: Level };
export type CheatSheetFile = { lines: CheatSheetLine[] };

export type CommandTerm = { id: string; term: string; definition: string };
