"use client";

import { useState } from "react";
import { fmt } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { areaTo, PAIRS, type CurvePair } from "./area-between-math";
import { numProp, type WidgetProps } from "./types";

const FRAMES: Record<CurvePair, Frame> = {
  "x-x2": { xMin: -0.3, xMax: 1.4, yMin: -0.3, yMax: 1.4, left: 28, top: 10, width: 322, height: 232 },
  "x+2-x2": { xMin: -2, xMax: 3, yMin: -1, yMax: 5, left: 28, top: 10, width: 322, height: 232 },
};

export type AreaBetweenState = { pair: CurvePair; b: number };

export function renderAreaBetweenSvg(alt: string, { pair, b }: AreaBetweenState) {
  const fr = FRAMES[pair];
  const p = PAIRS[pair];
  const steps = 80;
  let up = "";
  let low = "";
  for (let k = 0; k <= steps; k++) {
    const x = p.lo + ((b - p.lo) * k) / steps;
    up += `${k ? "L" : "M"}${sx(fr, x).toFixed(1)} ${sy(fr, p.upper(x)).toFixed(1)}`;
  }
  for (let k = steps; k >= 0; k--) {
    const x = p.lo + ((b - p.lo) * k) / steps;
    low += `L${sx(fr, x).toFixed(1)} ${sy(fr, p.lower(x)).toFixed(1)}`;
  }
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={fr} />
      <Clip f={fr}>
        {b > p.lo && <path d={`${up}${low}Z`} fill="var(--t1)" />}
        <path d={curvePath(fr, p.upper, fr.xMin, fr.xMax)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.5" />
        <path d={curvePath(fr, p.lower, fr.xMin, fr.xMax)} fill="none" stroke="var(--t5-ink)" strokeWidth="2.5" />
        <line x1={sx(fr, b)} y1={fr.top} x2={sx(fr, b)} y2={fr.top + fr.height} stroke="var(--ink-soft)" strokeDasharray="4 4" />
      </Clip>
      {[p.lo, p.hi].map((x) => (
        <circle key={x} cx={sx(fr, x)} cy={sy(fr, p.lower(x))} r="4.5" fill="var(--ink)" />
      ))}
      <g fontSize="11">
        <text x={fr.left + 8} y="26" fill="var(--t1-ink)">{p.label.split(" and ")[0]}</text>
        <text x={fr.left + 8} y="40" fill="var(--t5-ink)">{p.label.split(" and ")[1]}</text>
      </g>
    </svg>
  );
}

export default function AreaBetweenCurves({ alt, props }: WidgetProps) {
  const [pair, setPair] = useState<CurvePair>(props?.pair === "x+2-x2" ? "x+2-x2" : "x-x2");
  const p = PAIRS[pair];
  const [raw, setB] = useState(() => numProp(props, "b", p.hi, p.lo, p.hi));
  const b = Math.min(p.hi, Math.max(p.lo, raw));
  const changePair = (k: CurvePair) => {
    setPair(k);
    setB(PAIRS[k].hi);
  };
  return (
    <WidgetFrame
      id="area-between-curves"
      title="Area between two curves"
      caption="Between the intersections the area is ∫(upper − lower) dx. Slide b to the right-hand intersection to get the full enclosed area."
      svg={renderAreaBetweenSvg(alt, { pair, b })}
    >
      <p>
        <label>Curves{" "}
          <select value={pair} onChange={(e) => changePair(e.target.value as CurvePair)}>
            {(Object.keys(PAIRS) as CurvePair[]).map((k) => <option key={k} value={k}>{PAIRS[k].label}</option>)}
          </select>
        </label>
      </p>
      <p>They meet at x = {p.lo} and x = {p.hi}</p>
      <Slider label="b (upper bound)" value={b} min={p.lo} max={p.hi} step={0.01} onChange={setB} format={(v) => fmt(v)} />
      <p>Area from x = {p.lo} to x = b = <output data-testid="area" aria-live="polite">{fmt(areaTo(pair, b), 3)}</output></p>
    </WidgetFrame>
  );
}
