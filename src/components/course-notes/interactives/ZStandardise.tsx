"use client";

import { useState } from "react";
import { fmt, num } from "./format";
import { areaUnder, BaseAxis } from "./axis";
import { curvePath, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { inverseNormal, normalPdf, phi } from "./normal-math";
import { numProp, type WidgetProps } from "./types";

type InputMode = "x" | "p";
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** z and probability for either direction: from x (as a z-score within the window) or from a probability. */
export function standardise(mode: InputMode, mu: number, sigma: number, zx: number, p: number) {
  const z = mode === "x" ? zx : inverseNormal(p);
  return { z, x: mu + z * sigma, prob: mode === "x" ? phi(z) : p };
}

export type ZState = { mu: number; sigma: number; z: number };

export function renderZStandardiseSvg(alt: string, { mu, sigma, z }: ZState) {
  const top = (t: number): Frame => ({ xMin: -4, xMax: 4, yMin: 0, yMax: normalPdf(0, 0, 1) * 1.2, left: 14, top: t, width: 332, height: 86 });
  const fx = { ...top(16), xMin: mu - 4 * sigma, xMax: mu + 4 * sigma, yMax: normalPdf(mu, mu, sigma) * 1.2 };
  const fz = top(146);
  const x = mu + z * sigma;
  const pdfX = (v: number) => normalPdf(v, mu, sigma);
  const pdfZ = (v: number) => normalPdf(v, 0, 1);
  const panel = (f: Frame, pdf: (v: number) => number, at: number, ticks: { x: number; label: string }[]) => (
    <g>
      <BaseAxis f={f} ticks={ticks} />
      <path d={areaUnder(f, pdf, f.xMin, at)} fill="var(--t1)" fillOpacity="0.7" />
      <path d={curvePath(f, pdf, f.xMin, f.xMax)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.4" />
      <line x1={sx(f, at)} y1={sy(f, 0)} x2={sx(f, at)} y2={sy(f, pdf(at))} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 3" />
    </g>
  );
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      {panel(fx, pdfX, x, [-3, -2, -1, 0, 1, 2, 3].map((k) => ({ x: mu + k * sigma, label: num(mu + k * sigma) })))}
      {panel(fz, pdfZ, z, [-3, -2, -1, 0, 1, 2, 3].map((k) => ({ x: k, label: fmt(k, 0) })))}
      <text x="22" y="24" fontSize="11" fill="var(--ink)">X ~ N({num(mu)}, {num(sigma)}²)</text>
      <text x="22" y="154" fontSize="11" fill="var(--ink)">Z ~ N(0, 1)</text>
    </svg>
  );
}

export default function ZStandardise({ alt, props }: WidgetProps) {
  const [mu, setMu] = useState(() => numProp(props, "mu", 100, 50, 150));
  const [sigma, setSigma] = useState(() => numProp(props, "sigma", 15, 5, 30));
  const [mode, setMode] = useState<InputMode>(props?.mode === "p" ? "p" : "x");
  // x is stored as a z-score so it keeps its place in the picture when μ or σ move.
  const [zx, setZx] = useState(() => numProp(props, "z", 2, -4, 4));
  const [p, setP] = useState(() => numProp(props, "p", 0.9, 0.01, 0.99));
  const { z, x, prob } = standardise(mode, mu, sigma, zx, p);
  const xs = r3(mu + zx * sigma);
  return (
    <WidgetFrame
      id="z-standardise"
      title="Standardising a normal value"
      caption="Subtracting the mean and dividing by σ turns any normal X into the standard normal Z, so P(X < x) = P(Z < z). The two shaded areas are equal."
      svg={renderZStandardiseSvg(alt, { mu, sigma, z })}
    >
      <Slider label="μ (mean)" value={mu} min={50} max={150} step={1} onChange={setMu} format={(v) => num(v)} />
      <Slider label="σ (standard deviation)" value={sigma} min={5} max={30} step={1} onChange={setSigma} format={(v) => num(v)} />
      <p>
        <label>Start from{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as InputMode)}>
            <option value="x">a value x</option>
            <option value="p">a probability p</option>
          </select>
        </label>
      </p>
      {mode === "x" ? (
        <Slider label="x" value={clamp(xs, r3(mu - 4 * sigma), r3(mu + 4 * sigma))} min={r3(mu - 4 * sigma)} max={r3(mu + 4 * sigma)} step={0.5} onChange={(v) => setZx((v - mu) / sigma)} format={(v) => num(v)} />
      ) : (
        <Slider label="p (probability)" value={p} min={0.01} max={0.99} step={0.01} onChange={(v) => setP(Math.round(v * 100) / 100)} format={(v) => fmt(v, 2)} />
      )}
      <p data-testid="working">
        {mode === "x" ? <>z = (x − μ)/σ = ({num(x)} − {num(mu)})/{num(sigma)}</> : <>z from the inverse normal, then x = μ + zσ = {num(mu)} + {fmt(z, 4)} × {num(sigma)}</>}
      </p>
      <p>
        <output data-testid="result" aria-live="polite">z = {fmt(z, 4)}, probability = {fmt(prob, 5)} (P(X &lt; {fmt(x, 2)}) = P(Z &lt; {fmt(z, 4)}), x = {fmt(x, 2)})</output>
      </p>
    </WidgetFrame>
  );
}
