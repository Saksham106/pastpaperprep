"use client";

import { useState } from "react";
import styles from "../course-notes.module.css";
import { fmt, Slider, WidgetFrame } from "./shared";
import { partsAreas } from "./parts-area-math";
import { numProp, type WidgetProps } from "./types";

const X0 = 40;
const Y0 = 230;
const SX = 120;
const SY = 34;

export type PartsAreaState = { b: number };

/** Pure first frame: the same markup the client component draws. */
export function renderPartsAreaSvg(alt: string, { b }: PartsAreaState) {
  const pts: string[] = [];
  for (let k = 0; k <= 60; k++) {
    const u = (b * k) / 60;
    pts.push(`${k ? "L" : "M"}${(X0 + u * SX).toFixed(1)} ${(Y0 - u * u * SY).toFixed(1)}`);
  }
  const curve = pts.join(" ");
  const bx = X0 + b * SX;
  const by = Y0 - b * b * SY;
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <path d={`${curve} L${bx} ${Y0} L${X0} ${Y0} Z`} fill="var(--t1)" />
      <path d={`${curve} L${X0} ${by} Z`} fill="var(--t5)" />
      <rect x={X0} y={by} width={bx - X0} height={Y0 - by} fill="none" stroke="var(--ink-soft)" strokeDasharray="4 4" />
      <path d={curve} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <line x1={X0} y1={Y0} x2="350" y2={Y0} stroke="var(--muted)" />
      <line x1={X0} y1={Y0} x2={X0} y2="10" stroke="var(--muted)" />
      <g fontSize="12" fill="var(--ink)">
        <text x="345" y={Y0 + 18} fontSize="13" fill="var(--muted)" textAnchor="end" fontStyle="italic">u</text>
        <text x={X0 - 12} y="18" fontSize="13" fill="var(--muted)" fontStyle="italic">v</text>
        <text x={bx} y={Y0 + 18} textAnchor="middle">b</text>
        <text x={X0 - 8} y={by + 4} textAnchor="end">b²</text>
      </g>
    </svg>
  );
}

export default function PartsArea({ alt, props }: WidgetProps) {
  const [b, setB] = useState(() => numProp(props, "b", 2, 0.5, 2.4));
  const area = partsAreas(b);
  return (
    <WidgetFrame
      id="parts-area"
      title="See why it works"
      caption="The two coloured areas always fill the rectangle: uv = ∫v du + ∫u dv."
      svg={renderPartsAreaSvg(alt, { b })}
    >
      <p>For the curve v = u² from u = 0 to u = b:</p>
      <p><span className={`${styles.sw} ${styles.swA}`} />∫v du = <output data-testid="area-under">{fmt(area.underCurve)}</output></p>
      <p><span className={`${styles.sw} ${styles.swB}`} />∫u dv = <output data-testid="area-left">{fmt(area.leftOfCurve)}</output></p>
      <p>Together they fill the rectangle b × b² = <output data-testid="area-rect">{fmt(area.rectangle)}</output></p>
      <Slider label="b" value={b} min={0.5} max={2.4} step={0.01} onChange={setB} format={(v) => fmt(v)} />
    </WidgetFrame>
  );
}
