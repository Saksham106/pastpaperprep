/** f(x) = x³ − 3x. */
export const f = (x: number) => x * x * x - 3 * x;

/** f′(x) = 3x² − 3. */
export const df = (x: number) => 3 * x * x - 3;

export type Trend = "increasing" | "decreasing" | "stationary";

/** The trend of f at x, read from the sign of f′(x). */
export function trendAt(x: number): Trend {
  const d = df(x);
  if (Math.abs(d) < 1e-9) return "stationary";
  return d > 0 ? "increasing" : "decreasing";
}

/** Stationary points where f′(x) = 0, at x = −1 and x = 1. */
export const STATIONARY = [-1, 1].map((x) => ({ x, y: f(x) }));
