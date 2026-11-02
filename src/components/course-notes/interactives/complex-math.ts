export type Complex = { re: number; im: number };

export const DEG = Math.PI / 180;

export const fromPolar = (r: number, theta: number): Complex => ({ re: r * Math.cos(theta), im: r * Math.sin(theta) });
export const modulus = (z: Complex) => Math.hypot(z.re, z.im);

/** Reduce an angle to the principal range (−π, π]. */
export function wrapArg(theta: number): number {
  const t = ((((theta + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI; // [−π, π)
  return t < -Math.PI + 1e-9 ? Math.PI : t;
}

/** Principal argument in (−π, π]. */
export const arg = (z: Complex) => wrapArg(Math.atan2(z.im, z.re));

export const multiply = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });

/** z = r cis θ1 and w = s cis θ2 give zw = rs cis(θ1 + θ2), with the argument reduced to (−π, π]. */
export function multiplyPolar(r1: number, t1: number, r2: number, t2: number) {
  const z = fromPolar(r1, t1);
  const w = fromPolar(r2, t2);
  return { z, w, zw: multiply(z, w), modulus: r1 * r2, arg: wrapArg(t1 + t2) };
}

/** The n solutions of zⁿ = r cis θ: modulus r^(1/n), arguments (θ + 2πk)/n for k = 0 … n − 1. */
export function nthRoots(n: number, r = 1, theta = 0): { k: number; modulus: number; arg: number; z: Complex }[] {
  const m = r ** (1 / n);
  return Array.from({ length: n }, (_, k) => {
    const a = (theta + 2 * Math.PI * k) / n;
    return { k, modulus: m, arg: wrapArg(a), z: fromPolar(m, a) };
  });
}

export const sumComplex = (zs: Complex[]): Complex => zs.reduce((s, z) => ({ re: s.re + z.re, im: s.im + z.im }), { re: 0, im: 0 });
