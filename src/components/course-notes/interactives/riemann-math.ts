export type RiemannMode = "left" | "right" | "mid";

export const F = (x: number) => x * x;
export const A = 0;
export const B = 2;
/** Exact ∫₀² x² dx = 8/3. */
export const EXACT = 8 / 3;

/** x-position where the rectangle on [x_i, x_i+1] takes its height. */
export function sampleX(i: number, n: number, mode: RiemannMode): number {
  const w = (B - A) / n;
  const x0 = A + i * w;
  return mode === "left" ? x0 : mode === "right" ? x0 + w : x0 + w / 2;
}

/** The Riemann sum of x² on [0, 2] with n equal rectangles. */
export function riemannSum(n: number, mode: RiemannMode): number {
  const w = (B - A) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += F(sampleX(i, n, mode)) * w;
  return s;
}
