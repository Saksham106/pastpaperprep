/** Normal distribution helpers. React-free so the tests can check them against hand-known values. */

const SQRT_PI = Math.sqrt(Math.PI);

/**
 * erf(x) for 0 ≤ x < 3 by the all-positive series of Abramowitz & Stegun 7.1.6:
 * erf x = (2/√π) e^(−x²) Σ 2ⁿ x^(2n+1) / (1·3·5···(2n+1)). No cancellation, accurate to about 1e-15.
 */
function erfSeries(x: number): number {
  let term = x;
  let sum = x;
  for (let n = 1; n < 200; n++) {
    term *= (2 * x * x) / (2 * n + 1);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return (2 / SQRT_PI) * Math.exp(-x * x) * sum;
}

/**
 * erfc(x) for x ≥ 3 by the continued fraction of Abramowitz & Stegun 7.1.14:
 * erfc x = (e^(−x²)/√π) · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + 2/(x + …))))). Evaluated bottom-up with 80 terms.
 */
function erfcFraction(x: number): number {
  let t = x;
  for (let k = 80; k >= 1; k--) t = x + k / 2 / t;
  return Math.exp(-x * x) / (SQRT_PI * t);
}

/** Complementary error function, absolute error below 1e-14 for every x. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 3) return 1 - erfSeries(x);
  return x > 27 ? 0 : erfcFraction(x);
}

export const erf = (x: number): number => 1 - erfc(x);

/** Standard normal CDF Φ(z) = ½ erfc(−z/√2). */
export function phi(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** P(X < x) for X ~ N(μ, σ²). */
export function normalCdf(x: number, mu: number, sigma: number): number {
  return phi((x - mu) / sigma);
}

/** Density of N(μ, σ²). */
export function normalPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

export type NormalMode = "between" | "below" | "above";

/** P(a < X < b), P(X < b) or P(X > a) for X ~ N(μ, σ²). */
export function normalProb(mode: NormalMode, a: number, b: number, mu: number, sigma: number): number {
  if (mode === "below") return normalCdf(b, mu, sigma);
  if (mode === "above") return 1 - normalCdf(a, mu, sigma);
  return normalCdf(b, mu, sigma) - normalCdf(a, mu, sigma);
}

// Peter Acklam's rational approximation to the inverse normal CDF, relative error about 1.15e-9
// (https://web.archive.org/web/20151030215612/http://home.online.no/~pjacklam/notes/invnorm/).
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
const P_LOW = 0.02425;

/** Acklam's algorithm without the refinement step. */
export function inverseNormalRaw(p: number): number {
  if (!(p > 0)) return p === 0 ? -Infinity : NaN;
  if (!(p < 1)) return p === 1 ? Infinity : NaN;
  const tail = (q: number) => (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  if (p < P_LOW) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - P_LOW) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5;
  const r = q * q;
  return ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}

/** Inverse normal: Acklam's algorithm plus one Halley step (his recommended refinement) against the accurate Φ above. */
export function inverseNormal(p: number): number {
  const x = inverseNormalRaw(p);
  if (!Number.isFinite(x)) return x;
  const e = phi(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
