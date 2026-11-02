export type MaclaurinFn = "exp" | "sin" | "cos" | "ln";

export const MACLAURIN_FNS: { id: MaclaurinFn; label: string; max: number }[] = [
  { id: "exp", label: "eˣ", max: 8 },
  { id: "sin", label: "sin x", max: 6 },
  { id: "cos", label: "cos x", max: 6 },
  { id: "ln", label: "ln(1 + x)", max: 10 },
];

export const fnValue = (id: MaclaurinFn, x: number): number =>
  id === "exp" ? Math.exp(x) : id === "sin" ? Math.sin(x) : id === "cos" ? Math.cos(x) : Math.log(1 + x);

const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));

/**
 * The k-th nonzero term (k = 0, 1, 2 …) of the Maclaurin series as a coefficient and a power:
 * eˣ: xᵏ/k!; sin x: (−1)ᵏ x²ᵏ⁺¹/(2k+1)!; cos x: (−1)ᵏ x²ᵏ/(2k)!; ln(1+x): (−1)ᵏ xᵏ⁺¹/(k+1).
 */
export function term(id: MaclaurinFn, k: number): { coef: number; power: number } {
  const s = k % 2 === 0 ? 1 : -1;
  if (id === "exp") return { coef: 1 / factorial(k), power: k };
  if (id === "sin") return { coef: s / factorial(2 * k + 1), power: 2 * k + 1 };
  if (id === "cos") return { coef: s / factorial(2 * k), power: 2 * k };
  return { coef: s / (k + 1), power: k + 1 };
}

/** Pₙ(x): the sum of the first n nonzero terms. */
export function partialSum(id: MaclaurinFn, n: number, x: number): number {
  let sum = 0;
  for (let k = 0; k < n; k++) {
    const t = term(id, k);
    sum += t.coef * x ** t.power;
  }
  return sum;
}

export const maclaurinError = (id: MaclaurinFn, n: number, x: number) => Math.abs(fnValue(id, x) - partialSum(id, n, x));

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (p: number) => String(p).split("").map((c) => SUP[Number(c)]).join("");

/** Pₙ(x) written out, for example "x − x³/6" for sin x with two terms. */
export function partialSumLabel(id: MaclaurinFn, n: number): string {
  let out = "";
  for (let k = 0; k < n; k++) {
    const { coef, power } = term(id, k);
    const body = power === 0 ? "1" : (power === 1 ? "x" : `x${sup(power)}`) + (id === "ln" ? (power === 1 ? "" : `/${power}`) : power <= 1 ? "" : `/${factorial(power)}`);
    out += k === 0 ? body : `${coef < 0 ? " − " : " + "}${body}`;
  }
  return out;
}

/** x-range of the interval of convergence, for display. */
export const CONVERGENCE: Record<MaclaurinFn, string> = {
  exp: "all real x",
  sin: "all real x",
  cos: "all real x",
  ln: "−1 < x ≤ 1",
};

export const converges = (id: MaclaurinFn, x: number) => (id === "ln" ? x > -1 && x <= 1 : true);
