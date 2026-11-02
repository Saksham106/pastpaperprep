/** Binomial helpers. React-free. */

/** C(n, k) by the multiplicative formula, so nothing like 30! is ever formed. Exact for n ≤ 30 in doubles. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const m = Math.min(k, n - k);
  let c = 1;
  for (let i = 1; i <= m; i++) c = (c * (n - m + i)) / i;
  return Math.round(c);
}

/** P(X = k) for X ~ B(n, p). */
export function binomPmf(n: number, p: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return choose(n, k) * p ** k * (1 - p) ** (n - k);
}

export type BinomMode = "eq" | "le" | "ge";

export function inEvent(mode: BinomMode, k: number, i: number): boolean {
  return mode === "eq" ? i === k : mode === "le" ? i <= k : i >= k;
}

/** P(X = k), P(X ≤ k) or P(X ≥ k). */
export function binomProb(n: number, p: number, mode: BinomMode, k: number): number {
  let s = 0;
  for (let i = 0; i <= n; i++) if (inEvent(mode, k, i)) s += binomPmf(n, p, i);
  return s;
}

export const eventLabel = (mode: BinomMode, k: number) => `P(X ${mode === "eq" ? "=" : mode === "le" ? "≤" : "≥"} ${k})`;
export const binomMean = (n: number, p: number) => n * p;
export const binomVariance = (n: number, p: number) => n * p * (1 - p);
