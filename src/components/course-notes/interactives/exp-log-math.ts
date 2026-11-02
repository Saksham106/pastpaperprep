export const logBase = (a: number, x: number) => Math.log(x) / Math.log(a);

/** The point (x0, aˣ⁰) on y = aˣ. */
export const expPoint = (a: number, x0: number) => ({ x: x0, y: a ** x0 });

/** Reflection in y = x swaps the coordinates. */
export const reflect = (p: { x: number; y: number }) => ({ x: p.y, y: p.x });

export const WINDOW = { min: -3.5, max: 7.5 };

/** Range of x0 for which both the point and its reflection stay inside the plotted window. */
export function pointRange(a: number): [number, number] {
  const edge = logBase(a, WINDOW.max);
  return a > 1 ? [WINDOW.min, Math.min(WINDOW.max, edge)] : [Math.max(WINDOW.min, edge), WINDOW.max];
}
