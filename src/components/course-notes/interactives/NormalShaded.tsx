"use client";

import { useState } from "react";
import { fmt, num } from "./format";
import { areaUnder, BaseAxis } from "./axis";
import { curvePath, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { normalPdf, normalProb, type NormalMode } from "./normal-math";
import { numProp, type WidgetProps } from "./types";

const MODES: [NormalMode, string][] = [["between", "a < X < b"], ["below", "X < b"], ["above", "X > a"]];
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Which bounds the event uses, as a string such as "P(85 < X < 115)". */
export function normalEventLabel(mode: NormalMode, a: number, b: number): string {
  if (mode === "below") return `P(X < ${num(b)})`;
  if (mode === "above") return `P(X > ${num(a)})`;
  return `P(${num(a)} < X < ${num(b)})`;
}

export type NormalState = { mu: number; sigma: number; za: number; zb: number; mode: NormalMode };

export function renderNormalSvg(alt: string, { mu, sigma, za, zb, mode }: NormalState) {
  const fr: Frame = { xMin: mu - 4 * sigma, xMax: mu + 4 * sigma, yMin: 0, yMax: normalPdf(mu, mu, sigma) * 1.18, left: 14, top: 10, width: 332, height: 214 };
  const pdf = (x: number) => normalPdf(x, mu, sigma);
  const a = mu + za * sigma;
  const b = mu + zb * sigma;
  const lo = mode === "below" ? fr.xMin : a;
  const hi = mode === "above" ? fr.xMax : b;
  const ticks = [-3, -2, -1, 0, 1, 2, 3].map((k) => ({ x: mu + k * sigma, label: num(mu + k * sigma) }));
  const bounds = mode === "between" ? [a, b] : mode === "below" ? [b] : [a];
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <BaseAxis f={fr} ticks={ticks} />
      <path d={areaUnder(fr, pdf, lo, hi)} fill="var(--t1)" fillOpacity="0.7" />
      <path d={curvePath(fr, pdf, fr.xMin, fr.xMax)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.6" />
      {bounds.map((x, i) => (
        <line key={i} x1={sx(fr, x)} y1={sy(fr, 0)} x2={sx(fr, x)} y2={sy(fr, pdf(x))} stroke="var(--ink-soft)" strokeWidth="1.4" strokeDasharray="4 3" />
      ))}
      <text x="22" y="24" fontSize="11" fill="var(--ink)">X ~ N({num(mu)}, {num(sigma)}²)</text>
    </svg>
  );
}

export default function NormalShaded({ alt, props }: WidgetProps) {
  const [mu, setMu] = useState(() => numProp(props, "mu", 100, -20, 150));
  const [sigma, setSigma] = useState(() => numProp(props, "sigma", 15, 0.5, 30));
  const [mode, setMode] = useState<NormalMode>(props?.mode === "below" || props?.mode === "above" ? props.mode : "between");
  // a and b are stored as z-scores so the shaded region keeps its shape when μ or σ move.
  const [za, setZa] = useState(-1);
  const [zb, setZb] = useState(1);
  const a = r3(mu + za * sigma);
  const b = r3(mu + zb * sigma);
  const lo = r3(mu - 4 * sigma);
  const hi = r3(mu + 4 * sigma);
  const step = sigma < 3 ? 0.01 : sigma < 15 ? 0.1 : 0.5;
  const prob = normalProb(mode, a, b, mu, sigma);
  const changeMode = (m: NormalMode) => {
    setMode(m);
    if (m === "between" && za > zb) {
      setZa(zb);
      setZb(za);
    }
  };
  const showA = mode !== "below";
  const showB = mode !== "above";
  return (
    <WidgetFrame
      id="normal-shaded"
      title="Normal probabilities"
      hint="Drag the sliders"
      caption="The area under the bell curve between two values is a probability. The whole area is 1, and about 68% lies within one standard deviation of the mean."
      svg={renderNormalSvg(alt, { mu, sigma, za, zb, mode })}
    >
      <Slider label="μ (mean)" value={mu} min={-20} max={150} step={1} onChange={setMu} format={(v) => num(v)} />
      <Slider label="σ (standard deviation)" value={sigma} min={0.5} max={30} step={0.5} onChange={setSigma} format={(v) => num(v)} />
      <p>
        <label>Event{" "}
          <select value={mode} onChange={(e) => changeMode(e.target.value as NormalMode)}>
            {MODES.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
          </select>
        </label>
      </p>
      {showA && <Slider label="a (lower bound)" value={a} min={lo} max={mode === "between" ? b : hi} step={step} onChange={(v) => setZa((v - mu) / sigma)} format={(v) => num(v)} />}
      {showB && <Slider label="b (upper bound)" value={b} min={mode === "between" ? a : lo} max={hi} step={step} onChange={(v) => setZb((v - mu) / sigma)} format={(v) => num(v)} />}
      <p>Probability = <output data-testid="prob" aria-live="polite">{fmt(prob, 4)} ({normalEventLabel(mode, a, b)})</output></p>
      <p>z-scores: {showA && <>a → <output aria-live="off" data-testid="za">{fmt(za, 2)}</output> </>}{showB && <>b → <output aria-live="off" data-testid="zb">{fmt(zb, 2)}</output></>}</p>
    </WidgetFrame>
  );
}
