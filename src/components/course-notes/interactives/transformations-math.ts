import { num } from "./format";

export type BaseId = "square" | "abs" | "sin" | "exp";
export type Params = { a: number; b: number; c: number; d: number };

export const BASES: Record<BaseId, { label: string; f: (x: number) => number; keyX: number; keyLabel: string }> = {
  square: { label: "x²", f: (x) => x * x, keyX: 1, keyLabel: "(1, 1)" },
  abs: { label: "|x|", f: (x) => Math.abs(x), keyX: 1, keyLabel: "(1, 1)" },
  sin: { label: "sin x", f: (x) => Math.sin(x), keyX: Math.PI / 2, keyLabel: "(π/2, 1)" },
  exp: { label: "eˣ", f: (x) => Math.exp(x), keyX: 0, keyLabel: "(0, 1)" },
};

/** y = a·f(b(x − c)) + d */
export function transformed(base: BaseId, p: Params, x: number): number {
  return p.a * BASES[base].f(p.b * (x - p.c)) + p.d;
}

/** Where the base point (x0, y0) lands: x is divided by b then shifted by c; y is scaled by a then shifted by d. */
export function imageOfPoint(x0: number, y0: number, p: Params): { x: number; y: number } | null {
  if (p.b === 0) return null;
  return { x: x0 / p.b + p.c, y: p.a * y0 + p.d };
}

export function formatEquation(base: BaseId, p: Params): string {
  const { a, b, c, d } = p;
  const shift = c < 0 ? `x + ${num(-c)}` : `x − ${num(c)}`;
  const bStr = b === 1 ? "" : b === -1 ? "−" : num(b);
  const core = c === 0 ? `${bStr}x` : b === 1 ? shift : `${bStr}(${shift})`;
  const plain = core === "x";
  const fn =
    base === "square" ? (plain ? "x²" : `(${core})²`)
    : base === "abs" ? `|${core}|`
    : base === "sin" ? `sin(${core})`
    : plain ? "eˣ" : `e^(${core})`;
  const dStr = d === 0 ? "" : d < 0 ? ` − ${num(-d)}` : ` + ${num(d)}`;
  if (a === 0) return `y = ${num(d)}`;
  const aStr = a === 1 ? "" : a === -1 ? "−" : num(a);
  const space = aStr !== "" && aStr !== "−" && base === "sin" ? " " : "";
  return `y = ${aStr}${space}${fn}${dStr}`;
}
