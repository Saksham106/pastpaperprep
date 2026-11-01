export const discriminant = (a: number, b: number, c: number) => b * b - 4 * a * c;

/** Real roots in increasing order; one entry means a repeated root. */
export function realRoots(a: number, b: number, c: number): number[] {
  if (a === 0) return b === 0 ? [] : [-c / b];
  const d = discriminant(a, b, c);
  if (Math.abs(d) < 1e-9) return [-b / (2 * a)];
  if (d < 0) return [];
  const s = Math.sqrt(d);
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort((p, q) => p - q);
}
