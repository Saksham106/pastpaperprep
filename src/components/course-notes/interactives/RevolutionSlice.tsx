"use client";

import { useState } from "react";
import { fmt, num } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { discArea, discRadius, REV_SHAPES, type RevShape } from "./revolution-math";
import { numProp, type WidgetProps } from "./types";

const FRAMES: Record<RevShape, Frame> = {
  sqrt: { xMin: -0.5, xMax: 4.5, yMin: -2.6, yMax: 2.6, left: 24, top: 10, width: 326, height: 236 },
  line: { xMin: -0.5, xMax: 4.5, yMin: -4.6, yMax: 4.6, left: 24, top: 10, width: 326, height: 236 },
};

export type RevolutionState = { shape: RevShape; b: number; x0: number };

export function renderRevolutionSvg(alt: string, { shape, b, x0 }: RevolutionState) {
  const fr = FRAMES[shape];
  const f = REV_SHAPES[shape].f;
  const xc = Math.min(x0, b);
  const r = discRadius(shape, xc);
  const steps = 80;
  let up = "";
  let low = "";
  for (let k = 0; k <= steps; k++) {
    const x = (b * k) / steps;
    up += `${k ? "L" : "M"}${sx(fr, x).toFixed(1)} ${sy(fr, f(x)).toFixed(1)}`;
  }
  for (let k = steps; k >= 0; k--) {
    const x = (b * k) / steps;
    low += `L${sx(fr, x).toFixed(1)} ${sy(fr, -f(x)).toFixed(1)}`;
  }
  const ry = sy(fr, 0) - sy(fr, r);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={fr} labelEvery={shape === "line" ? 2 : 1} />
      <Clip f={fr}>
        <path d={`${up}${low}Z`} fill="var(--t1)" fillOpacity="0.45" />
        <path d={curvePath(fr, f, 0, b)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.6" />
        <path d={curvePath(fr, (x) => -f(x), 0, b)} fill="none" stroke="var(--t1-ink)" strokeWidth="2" strokeDasharray="5 4" />
        <ellipse cx={sx(fr, xc)} cy={sy(fr, 0)} rx="6" ry={Math.max(ry, 0.5)} fill="var(--t5)" fillOpacity="0.85" stroke="var(--t5-ink)" strokeWidth="1.8" />
        <line x1={sx(fr, xc)} y1={sy(fr, 0)} x2={sx(fr, xc)} y2={sy(fr, r)} stroke="var(--t5-ink)" strokeWidth="1.4" />
      </Clip>
      <g fontSize="11">
        <text x={sx(fr, 0) + 8} y="26" fill="var(--t1-ink)">{REV_SHAPES[shape].label} (solid), its mirror (dashed)</text>
        <text x={sx(fr, 0) + 8} y="40" fill="var(--t5-ink)">disc at x = {num(xc)}, radius {fmt(r, 2)}</text>
      </g>
    </svg>
  );
}

export default function RevolutionSlice({ alt, props }: WidgetProps) {
  const [shape, setShape] = useState<RevShape>(props?.shape === "line" ? "line" : "sqrt");
  const [b, setB] = useState(() => numProp(props, "b", 2, 0.5, 4));
  const [rawX, setRawX] = useState(() => numProp(props, "x0", 1, 0, 4));
  const x0 = Math.min(rawX, b);
  const s = REV_SHAPES[shape];
  const V = s.volume(b);
  return (
    <WidgetFrame
      id="revolution-slice"
      title="Volume of revolution, disc by disc"
      caption="Rotating y = f(x) about the x-axis sweeps out a solid made of thin discs. A disc at x has radius f(x) and area πf(x)², and V = π∫f(x)² dx adds them all up."
      svg={renderRevolutionSvg(alt, { shape, b, x0 })}
    >
      <p>
        <label>Curve{" "}
          <select value={shape} onChange={(e) => setShape(e.target.value as RevShape)}>
            {(Object.keys(REV_SHAPES) as RevShape[]).map((k) => <option key={k} value={k}>{REV_SHAPES[k].label}</option>)}
          </select>
        </label>
      </p>
      <Slider label="b (right end of the rotated region)" value={b} min={0.5} max={4} step={0.1} onChange={setB} format={(v) => fmt(v, 1)} />
      <Slider label="x₀ (position of the disc)" value={x0} min={0} max={b} step={0.05} onChange={setRawX} format={(v) => fmt(v, 2)} />
      <p>Disc radius f(x₀) = <output aria-live="off" data-testid="radius">{fmt(discRadius(shape, x0), 3)}</output>, area = <output aria-live="off" data-testid="disc-area">{fmt(discArea(shape, x0), 3)}</output></p>
      <p>{s.formula}</p>
      <p>V = <output data-testid="volume" aria-live="polite">{fmt(V, 3)} (volume of {s.label} rotated about the x-axis, 0 ≤ x ≤ {num(b)})</output></p>
    </WidgetFrame>
  );
}
