export type EulerPoint = { x: number; y: number };

/** dy/dx = x + y with y(0) = 1. */
export const slope = (x: number, y: number) => x + y;
/** The exact solution y = 2eˣ − x − 1. */
export const exactY = (x: number) => 2 * Math.exp(x) - x - 1;
export const X_END = 1;

/** Step sizes that divide [0, 1] exactly, so the last Euler point lands on x = 1. */
export const STEP_SIZES = [0.05, 0.1, 0.125, 0.2, 0.25, 0.5];

/** Euler's method: yₙ₊₁ = yₙ + h·f(xₙ, yₙ), xₙ₊₁ = xₙ + h, from (0, 1) to x = 1. */
export function eulerPoints(h: number): EulerPoint[] {
  const steps = Math.round(X_END / h);
  const pts: EulerPoint[] = [{ x: 0, y: 1 }];
  for (let k = 0; k < steps; k++) {
    const p = pts[k];
    pts.push({ x: (k + 1) * h, y: p.y + h * slope(p.x, p.y) });
  }
  return pts;
}

export const eulerEstimate = (h: number) => eulerPoints(h).at(-1)!.y;
