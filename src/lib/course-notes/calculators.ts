// Client-safe: calculator blocks. A block either writes its keystrokes per model or names a vetted snippet from the
// course's calculator.json ({ "snippets": { "<id>": { "title", "steps": { "<calculatorId>": string[] } } } }).
import type { CalculatorBlock, CalculatorSnippets, CalculatorSteps } from "./types";

/** The models AA's calculator blocks were written for, used when a validation context names none. */
export const AA_CALCULATOR_IDS = ["ti84", "nspire", "casio"] as const;

/**
 * `{name}` in a snippet step is filled from the block's `values`. A brace group straight after a TeX command, `^`, `_`
 * or `}` is TeX, not a placeholder (`\text{EXE}`, `x^{a}`, `\frac{1}{b}`).
 */
const PLACEHOLDER = /(?<![\\A-Za-z0-9^_}])\{([a-z][A-Za-z0-9]*)\}/g;

export const placeholders = (text: string): string[] => [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(PLACEHOLDER, (whole, name: string) => (name in values ? String(values[name]) : whole));

/** The keystrokes a block shows, per calculator id; null for an unknown snippet. */
export function calculatorSteps(block: CalculatorBlock, snippets: CalculatorSnippets = {}): CalculatorSteps | null {
  if ("steps" in block) return block.steps;
  const snippet = snippets[block.snippet];
  if (!snippet) return null;
  const values = block.values ?? {};
  return Object.fromEntries(Object.entries(snippet.steps).map(([id, steps]) => [id, steps.map((step) => fill(step, values))]));
}

const sameIds = (keys: string[], ids: readonly string[]) => keys.length === ids.length && ids.every((id) => keys.includes(id));

/** Problems with a calculator block: model ids that are not exactly the course's, an unknown snippet, unfilled or unused values. */
export function calculatorErrors(block: CalculatorBlock, ids: readonly string[], snippets: CalculatorSnippets = {}): string[] {
  const errors: string[] = [];
  const raw = block as Record<string, unknown>;
  if (!ids.length) return ["this course names no calculators (course.json calculators), so it has no calculator blocks"];
  if ("steps" in raw && "snippet" in raw) return ["calculator block has both steps and a snippet; use one"];
  if ("steps" in block) {
    const keys = Object.keys(block.steps ?? {});
    if (!sameIds(keys, ids)) errors.push(`calculator steps must be given for exactly ${ids.join(", ")} (got ${keys.join(", ") || "none"})`);
    for (const [id, steps] of Object.entries(block.steps ?? {})) if (!Array.isArray(steps) || !steps.length || steps.some((step) => typeof step !== "string" || !step.trim())) errors.push(`calculator steps for ${id} must be a non-empty list of text`);
    return errors;
  }
  const snippet = snippets[block.snippet];
  if (!snippet) return [`unknown calculator snippet ${block.snippet} (not in calculator.json)`];
  const needed = new Set(Object.values(snippet.steps).flat().flatMap(placeholders));
  const given = Object.keys(block.values ?? {});
  for (const name of needed) if (!given.includes(name)) errors.push(`calculator snippet ${block.snippet} needs a value for {${name}}`);
  for (const name of given) if (!needed.has(name)) errors.push(`calculator snippet ${block.snippet} has no placeholder {${name}}`);
  return errors;
}

/** Problems with a calculator.json: every snippet titled, with steps for exactly the course's calculators. */
export function snippetFileErrors(snippets: CalculatorSnippets, ids: readonly string[]): string[] {
  // Outside $…$, `^{name}` looks like a placeholder but is read as TeX, so the student would see "^{name}" verbatim.
  const texLookalike = (step: string) => step.replace(/\$(?:[^$\\]|\\.)*\$/g, "").match(/[\^_}]\{[a-z][A-Za-z0-9]*\}/)?.[0];
  return Object.entries(snippets).flatMap(([id, snippet]) => [
    ...(snippet.title?.trim() ? [] : [`snippet ${id} needs a title`]),
    ...Object.entries(snippet.steps ?? {}).flatMap(([model, steps]) => (Array.isArray(steps) ? steps : []).flatMap((step) => {
      const hit = typeof step === "string" ? texLookalike(step) : undefined;
      return hit ? [`snippet ${id} (${model}): "${hit}" is not filled in (TeX after ^, _ or }); write "^ {name}" or put it in $…$`] : [];
    })),
    ...calculatorErrors({ type: "calculator", steps: snippet.steps }, ids).map((error) => `snippet ${id}: ${error}`),
  ]);
}
