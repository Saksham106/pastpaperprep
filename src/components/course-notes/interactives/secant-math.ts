export type SecantCurve = "square" | "cube";

export const SECANT_CURVES: Record<SecantCurve, { label: string; f: (x: number) => number; df: (x: number) => number }> = {
  square: { label: "y = x²", f: (x) => x * x, df: (x) => 2 * x },
  cube: { label: "y = x³", f: (x) => x * x * x, df: (x) => 3 * x * x },
};

/** The fixed point P sits at x = 1. */
export const P_X = 1;

/** Gradient of the chord from P (x = 1) to Q (x = 1 + h): (f(1 + h) − f(1)) / h. */
export function secantGradient(f: (x: number) => number, h: number): number {
  return (f(P_X + h) - f(P_X)) / h;
}
