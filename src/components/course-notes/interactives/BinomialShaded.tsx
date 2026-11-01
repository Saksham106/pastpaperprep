"use client";

import { useState } from "react";
import { fmt, num } from "./format";
import { BaseAxis } from "./axis";
import { Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { binomMean, binomPmf, binomProb, binomVariance, eventLabel, inEvent, type BinomMode } from "./binomial-math";
import { numProp, type WidgetProps } from "./types";

const MODES: [BinomMode, string][] = [["eq", "X = k"], ["le", "X ≤ k"], ["ge", "X ≥ k"]];

export type BinomialState = { n: number; p: number; mode: BinomMode; k: number };

export function renderBinomialSvg(alt: string, { n, p, mode, k }: BinomialState) {
  let top = 0;
  for (let i = 0; i <= n; i++) top = Math.max(top, binomPmf(n, p, i));
  const tick = top > 0.4 ? 0.2 : top > 0.2 ? 0.1 : 0.05;
  const yMax = Math.ceil((top * 1.05) / tick) * tick;
  const fr: Frame = { xMin: -0.5, xMax: n + 0.5, yMin: 0, yMax, left: 34, top: 10, width: 318, height: 214 };
  const step = n <= 12 ? 1 : n <= 20 ? 2 : 5;
  const ticks = [];
  for (let i = 0; i <= n; i += step) ticks.push({ x: i, label: String(i) });
  const gridY = [];
  for (let t = 0; t <= yMax + 1e-9; t += tick) gridY.push({ y: t, label: fmt(t, 2) });
  const bw = fr.width / (n + 1);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <BaseAxis f={fr} ticks={ticks} gridY={gridY} />
      {Array.from({ length: n + 1 }, (_, i) => {
        const h = sy(fr, 0) - sy(fr, binomPmf(n, p, i));
        const on = inEvent(mode, k, i);
        return (
          <rect key={i} x={sx(fr, i) - bw / 2 + 0.75} y={sy(fr, 0) - h} width={Math.max(bw - 1.5, 1)} height={h}
            fill={on ? "var(--t1)" : "var(--line-strong)"} stroke={on ? "var(--t1-ink)" : "none"} strokeWidth="1" />
        );
      })}
      <text x={fr.left + 8} y="24" fontSize="11" fill="var(--ink)">X ~ B({n}, {num(p)})</text>
      <text x={fr.left + 8} y="38" fontSize="11" fill="var(--t1-ink)">shaded: {eventLabel(mode, k)}</text>
    </svg>
  );
}

export default function BinomialShaded({ alt, props }: WidgetProps) {
  const [n, setN] = useState(() => Math.round(numProp(props, "n", 10, 1, 30)));
  const [p, setP] = useState(() => numProp(props, "p", 0.5, 0.05, 0.95));
  const [mode, setMode] = useState<BinomMode>(props?.mode === "le" || props?.mode === "ge" ? props.mode : "eq");
  const [rawK, setK] = useState(() => Math.round(numProp(props, "k", 5, 0, 30)));
  const k = Math.min(rawK, n);
  const prob = binomProb(n, p, mode, k);
  return (
    <WidgetFrame
      id="binomial-shaded"
      title="Binomial probabilities"
      caption="Each bar is P(X = k) = C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ. The shaded bars make up the event, and adding their heights gives its probability."
      svg={renderBinomialSvg(alt, { n, p, mode, k })}
    >
      <Slider label="n (trials)" value={n} min={1} max={30} step={1} onChange={setN} format={(v) => String(v)} />
      <Slider label="p (success probability)" value={p} min={0.05} max={0.95} step={0.05} onChange={(v) => setP(Math.round(v * 100) / 100)} format={(v) => fmt(v, 2)} />
      <p>
        <label>Event{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as BinomMode)}>
            {MODES.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
          </select>
        </label>
      </p>
      <Slider label="k" value={k} min={0} max={n} step={1} onChange={setK} format={(v) => String(v)} />
      <p>Probability = <output data-testid="prob" aria-live="polite">{fmt(prob, 4)} ({eventLabel(mode, k)})</output></p>
      <p>Mean np = <output aria-live="off" data-testid="mean">{fmt(binomMean(n, p), 2)}</output>, variance np(1 − p) = <output aria-live="off" data-testid="variance">{fmt(binomVariance(n, p), 2)}</output></p>
    </WidgetFrame>
  );
}
