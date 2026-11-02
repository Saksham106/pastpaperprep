"use client";

import { useState } from "react";
import { fmt, fmtComplex, num } from "./format";
import { Clip, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { DEG, nthRoots, sumComplex } from "./complex-math";
import { numProp, type WidgetProps } from "./types";

const F: Frame = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, left: 60, top: 10, width: 240, height: 240 };

export type RootsMode = "unity" | "general";
export type RootsState = { n: number; mode: RootsMode; r: number; deg: number };

const circle = (radius: number) => {
  const rx = (radius / (F.xMax - F.xMin)) * F.width;
  return { cx: sx(F, 0), cy: sy(F, 0), rx };
};

export function renderRootsSvg(alt: string, { n, mode, r, deg }: RootsState) {
  const roots = nthRoots(n, mode === "unity" ? 1 : r, mode === "unity" ? 0 : deg * DEG);
  const rad = roots[0].modulus;
  const poly = roots.map((q, i) => `${i === 0 ? "M" : "L"}${sx(F, q.z.re).toFixed(1)} ${sy(F, q.z.im).toFixed(1)}`).join("") + "Z";
  const unit = circle(1);
  const big = circle(rad);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} />
      <Clip f={F}>
        <circle cx={unit.cx} cy={unit.cy} r={unit.rx} fill="none" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="4 3" />
        {mode === "general" && <circle cx={big.cx} cy={big.cy} r={big.rx} fill="none" stroke="var(--t5-ink)" strokeWidth="1.4" />}
        <path d={poly} fill="var(--t1)" fillOpacity="0.55" stroke="var(--t1-ink)" strokeWidth="2.2" strokeLinejoin="round" />
        {roots.map((q) => (
          <circle key={q.k} cx={sx(F, q.z.re)} cy={sy(F, q.z.im)} r={q.k === 0 ? 6 : 4.5} fill={q.k === 0 ? "var(--t5-ink)" : "var(--t1-ink)"} stroke="var(--surface)" strokeWidth="1.6" />
        ))}
      </Clip>
      <g fontSize="11">
        <text x="8" y="26" fill="var(--t1-ink)">{n} roots</text>
        <text x="8" y="40" fill="var(--t5-ink)">k = 0 (large dot)</text>
        <text x="8" y="54" fill="var(--muted)">dashed: |z| = 1</text>
      </g>
    </svg>
  );
}

export default function RootsOfUnity({ alt, props }: WidgetProps) {
  const [n, setN] = useState(() => Math.round(numProp(props, "n", 4, 2, 12)));
  const [mode, setMode] = useState<RootsMode>(props?.mode === "general" ? "general" : "unity");
  const [r, setR] = useState(() => numProp(props, "r", 2, 0.5, 3));
  const [deg, setDeg] = useState(() => numProp(props, "theta", 90, -180, 180));
  const general = mode === "general";
  const roots = nthRoots(n, general ? r : 1, general ? deg * DEG : 0);
  const sum = sumComplex(roots.map((q) => q.z));
  const equation = general ? `z${sup(n)} = ${fmt(r, 1)} cis ${num(deg)}°` : `z${sup(n)} = 1`;
  return (
    <WidgetFrame
      id="roots-of-unity"
      title="Roots of unity"
      hint="Drag the sliders"
      caption="The n solutions of zⁿ = 1 are cis(2πk/n) for k = 0, 1, … n − 1. They sit evenly round the unit circle and are the vertices of a regular polygon. For zⁿ = r cis θ the roots have modulus r^(1/n) and arguments (θ + 2πk)/n."
      svg={renderRootsSvg(alt, { n, mode, r, deg })}
    >
      <p>
        <label>Equation{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as RootsMode)}>
            <option value="unity">zⁿ = 1</option>
            <option value="general">zⁿ = r cis θ</option>
          </select>
        </label>
      </p>
      <Slider label="n" value={n} min={2} max={12} step={1} onChange={setN} format={(v) => String(v)} />
      {general && <Slider label="r (modulus)" value={r} min={0.5} max={3} step={0.1} onChange={setR} format={(v) => fmt(v, 1)} />}
      {general && <Slider label="θ (degrees)" value={deg} min={-180} max={180} step={5} onChange={setDeg} format={(v) => `${num(v)}°`} />}
      <p>
        {general
          ? <>Modulus r<sup>1/n</sup> = <output aria-live="off" data-testid="modulus">{fmt(roots[0].modulus, 3)}</output>, arguments (θ + 360°k)/n</>
          : <>Arguments 360°k/n = k × <output aria-live="off" data-testid="step">{num(360 / n)}</output>°</>}
      </p>
      <p>Sum of the roots = <output aria-live="off" data-testid="sum">{fmtComplex(sum.re, sum.im)}</output> (always 0 for n ≥ 2)</p>
      <p>
        Solutions of {equation}: <output aria-live="polite" data-testid="result">{roots.map((q) => fmtComplex(q.z.re, q.z.im)).join("; ")}</output>
      </p>
    </WidgetFrame>
  );
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (p: number) => String(p).split("").map((c) => SUP[Number(c)]).join("");
