/** Least-squares lines for a small data set. React-free. */
export type Pt = { x: number; y: number };

export const FIXED_POINTS: Pt[] = [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 4, y: 4 }];
export const DRAG_START: Pt = { x: 5, y: 6 };

export function regression(pts: Pt[]) {
  const n = pts.length;
  const xbar = pts.reduce((s, p) => s + p.x, 0) / n;
  const ybar = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - xbar) ** 2;
    syy += (p.y - ybar) ** 2;
    sxy += (p.x - xbar) * (p.y - ybar);
  }
  const r = sxy / Math.sqrt(sxx * syy);
  // y on x: y = m x + c, minimising vertical distances.
  const m = sxy / sxx;
  const c = ybar - m * xbar;
  // x on y: x = c2 + d y, minimising horizontal distances.
  const d = sxy / syy;
  const c2 = xbar - d * ybar;
  return { xbar, ybar, sxx, syy, sxy, r, m, c, d, c2 };
}
