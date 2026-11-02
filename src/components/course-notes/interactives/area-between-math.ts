export type CurvePair = "x-x2" | "x+2-x2";

/** Upper curve minus lower curve, its antiderivative, and the two intersections (lo < hi). */
export const PAIRS: Record<CurvePair, {
  label: string;
  upper: (x: number) => number;
  lower: (x: number) => number;
  anti: (x: number) => number;
  lo: number;
  hi: number;
}> = {
  // x = x² at x = 0 and 1; x − x² ≥ 0 between them.
  "x-x2": {
    label: "y = x and y = x²",
    upper: (x) => x,
    lower: (x) => x * x,
    anti: (x) => x ** 2 / 2 - x ** 3 / 3,
    lo: 0,
    hi: 1,
  },
  // x² = x + 2 at x = −1 and 2; x + 2 − x² ≥ 0 between them.
  "x+2-x2": {
    label: "y = x + 2 and y = x²",
    upper: (x) => x + 2,
    lower: (x) => x * x,
    anti: (x) => x ** 2 / 2 + 2 * x - x ** 3 / 3,
    lo: -1,
    hi: 2,
  },
};

/** Area between the curves from the lower intersection to x = b. */
export function areaTo(pair: CurvePair, b: number): number {
  const p = PAIRS[pair];
  return p.anti(b) - p.anti(p.lo);
}
