"use client";

import { useState } from "react";
import { fmt, num } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { CONVERGENCE, converges, fnValue, MACLAURIN_FNS, maclaurinError, partialSum, partialSumLabel, type MaclaurinFn } from "./maclaurin-math";
import { numProp, type WidgetProps } from "./types";

const FRAMES: Record<MaclaurinFn, Frame> = {
  exp: { xMin: -3, xMax: 3, yMin: -2, yMax: 8, left: 28, top: 10, width: 322, height: 232 },
  sin: { xMin: -6.5, xMax: 6.5, yMin: -3, yMax: 3, left: 28, top: 10, width: 322, height: 232 },
  cos: { xMin: -6.5, xMax: 6.5, yMin: -3, yMax: 3, left: 28, top: 10, width: 322, height: 232 },
  ln: { xMin: -1.5, xMax: 3, yMin: -4, yMax: 3, left: 28, top: 10, width: 322, height: 232 },
};
/** Range of the x₀ slider: inside the frame, and for ln(1 + x) inside the domain x > −1. */
const X0_RANGE: Record<MaclaurinFn, [number, number]> = { exp: [-3, 3], sin: [-6, 6], cos: [-6, 6], ln: [-0.9, 2] };
/** Where Pₙ is drawn. For ln(1 + x) it stops at x = 2: far past x = 1 the sums only blow up. */
const P_RANGE: Record<MaclaurinFn, [number, number]> = {
  exp: [-3, 3],
  sin: [-6.5, 6.5],
  cos: [-6.5, 6.5],
  ln: [-0.999, 2],
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const maxTerms = (id: MaclaurinFn) => MACLAURIN_FNS.find((f) => f.id === id)!.max;
const fnLabel = (id: MaclaurinFn) => MACLAURIN_FNS.find((f) => f.id === id)!.label;

export type MaclaurinState = { fn: MaclaurinFn; n: number; x0: number };

export function renderMaclaurinSvg(alt: string, { fn, n, x0 }: MaclaurinState) {
  const F = FRAMES[fn];
  const f = (x: number) => fnValue(fn, x);
  const P = (x: number) => partialSum(fn, n, x);
  const [p0, p1] = P_RANGE[fn];
  const fx = f(x0);
  const px = P(x0);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} labelEvery={fn === "sin" || fn === "cos" ? 2 : 1} />
      <Clip f={F}>
        {fn === "ln" && (
          <>
            <rect x={sx(F, -1)} y={F.top} width={sx(F, 1) - sx(F, -1)} height={F.height} fill="var(--t3)" fillOpacity="0.5" />
            <line x1={sx(F, -1)} y1={F.top} x2={sx(F, -1)} y2={F.top + F.height} stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="4 3" />
          </>
        )}
        <path d={curvePath(F, f, fn === "ln" ? -0.999 : F.xMin, F.xMax, 300)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.8" />
        <path d={curvePath(F, P, p0, p1, 300)} fill="none" stroke="var(--t5-ink)" strokeWidth="2.4" strokeDasharray="6 3" />
        <line x1={sx(F, x0)} y1={F.top} x2={sx(F, x0)} y2={F.top + F.height} stroke="var(--ink-soft)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={sx(F, x0)} cy={sy(F, fx)} r="5" fill="var(--t1-ink)" stroke="var(--surface)" strokeWidth="1.6" />
        <circle cx={sx(F, x0)} cy={sy(F, px)} r="4" fill="var(--t5-ink)" stroke="var(--surface)" strokeWidth="1.6" />
      </Clip>
      <g fontSize="11">
        <text x={F.left + 8} y="26" fill="var(--t1-ink)">f(x) = {fnLabel(fn)} (solid)</text>
        <text x={F.left + 8} y="40" fill="var(--t5-ink)">P{n} (dashed)</text>
        {fn === "ln" && <text x={F.left + 8} y="54" fill="var(--t3-ink)">green band: converges</text>}
      </g>
    </svg>
  );
}

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const sub = (k: number) => String(k).split("").map((c) => SUBS[Number(c)]).join("");

export default function MaclaurinPartials({ alt, props }: WidgetProps) {
  const initial = MACLAURIN_FNS.find((f) => f.id === props?.fn)?.id ?? "exp";
  const [fn, setFn] = useState<MaclaurinFn>(initial);
  const [rawN, setRawN] = useState(() => Math.round(numProp(props, "n", 3, 1, 8)));
  const [rawX, setRawX] = useState(() => numProp(props, "x0", 1, -6, 6));
  const n = Math.min(rawN, maxTerms(fn));
  const [lo, hi] = X0_RANGE[fn];
  const x0 = clamp(rawX, lo, hi);
  const fx = fnValue(fn, x0);
  const px = partialSum(fn, n, x0);
  const err = maclaurinError(fn, n, x0);
  const inside = converges(fn, x0);
  const nm = `P${sub(n)}`;
  return (
    <WidgetFrame
      id="maclaurin-partials"
      title="Maclaurin partial sums"
      hint="Pick a function and drag the sliders"
      caption="The Maclaurin series adds more terms of f(0), f′(0)x, f″(0)x²/2!, … Each extra term hugs f more tightly near x = 0, and the error grows as x moves away from 0."
      svg={renderMaclaurinSvg(alt, { fn, n, x0 })}
    >
      <p>
        <label>Function{" "}
          <select value={fn} onChange={(e) => setFn(e.target.value as MaclaurinFn)}>
            {MACLAURIN_FNS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
      </p>
      <Slider label="n (number of terms)" value={n} min={1} max={maxTerms(fn)} step={1} onChange={setRawN} format={(v) => String(v)} />
      <Slider label="x₀" value={x0} min={lo} max={hi} step={0.1} onChange={setRawX} format={(v) => fmt(v, 1)} />
      <p>{nm}(x) = <output aria-live="off" data-testid="poly">{partialSumLabel(fn, n)}</output></p>
      <p>Converges for <output aria-live="off" data-testid="convergence">{CONVERGENCE[fn]}</output>{!inside && ", and x₀ is outside it, so Pₙ does not settle on f there"}</p>
      <p>
        <output aria-live="polite" data-testid="result">{nm}({num(x0)}) = {fmt(px, 5)}, f({num(x0)}) = {fmt(fx, 5)}, error |f − {nm}| = {fmt(err, 5)}</output>
      </p>
    </WidgetFrame>
  );
}
