"use client";

import { useState, type SVGProps } from "react";
import styles from "../course-notes.module.css";
import { Clip, curvePath, fmt, Grid, num, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { expPoint, logBase, pointRange, reflect, WINDOW } from "./exp-log-math";
import { numProp, type WidgetProps } from "./types";

const F: Frame = { xMin: WINDOW.min, xMax: WINDOW.max, yMin: WINDOW.min, yMax: WINDOW.max, left: 18, top: 10, width: 324, height: 240 };

export type ExpLogState = { a: number; x0: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function renderExpLogSvg(alt: string, { a, x0 }: ExpLogState, pointProps?: SVGProps<SVGCircleElement>) {
  const p = expPoint(a, x0);
  const q = reflect(p);
  const swap = (x: number) => a ** x;
  // The log curve is the exp curve with coordinates swapped, so sample the exp curve and mirror each point.
  let logD = "";
  let pen = false;
  for (let k = 0; k <= 240; k++) {
    const x = F.xMin - 4 + ((F.xMax - F.xMin + 8) * k) / 240;
    const y = swap(x);
    if (!Number.isFinite(y) || y > 60) {
      pen = false;
      continue;
    }
    logD += `${pen ? "L" : "M"}${sx(F, y).toFixed(1)} ${sy(F, x).toFixed(1)}`;
    pen = true;
  }
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} />
      <Clip f={F}>
        <line x1={sx(F, F.xMin)} y1={sy(F, F.xMin)} x2={sx(F, F.xMax)} y2={sy(F, F.xMax)} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={curvePath(F, swap, F.xMin, F.xMax)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.6" />
        <path d={logD} fill="none" stroke="var(--t5-ink)" strokeWidth="2.6" />
        <line x1={sx(F, p.x)} y1={sy(F, p.y)} x2={sx(F, q.x)} y2={sy(F, q.y)} stroke="var(--ink-soft)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={sx(F, q.x)} cy={sy(F, q.y)} r="5" fill="var(--t5-ink)" />
        <circle cx={sx(F, p.x)} cy={sy(F, p.y)} r="7" fill="var(--t1-ink)" stroke="var(--surface)" strokeWidth="2" style={{ cursor: "grab", touchAction: "none" }} {...pointProps} />
      </Clip>
      <g fontSize="11">
        <text x="26" y="24" fill="var(--t1-ink)">y = aˣ</text>
        <text x="26" y="38" fill="var(--t5-ink)">y = logₐx</text>
        <text x="26" y="52" fill="var(--muted)">y = x (mirror)</text>
      </g>
    </svg>
  );
}

export default function ExpLogReflection({ alt, props }: WidgetProps) {
  const [a, setA] = useState(() => {
    const v = numProp(props, "a", 2, 0.2, 4);
    return v === 1 ? 2 : v;
  });
  const [rawX, setRawX] = useState(1);
  const [lo, hi] = pointRange(a);
  const x0 = clamp(rawX, lo, hi);
  const p = expPoint(a, x0);
  const q = reflect(p);

  // a = 1 is not allowed; step over it in whichever direction the slider was moving.
  const changeA = (v: number) => setA((prev) => (Math.abs(v - 1) < 1e-9 ? (prev < 1 ? 1.05 : 0.95) : v));

  const dragProps: SVGProps<SVGCircleElement> = {
    onPointerDown: (e) => e.currentTarget.setPointerCapture(e.pointerId),
    onPointerMove: (e) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 360;
      const x = F.xMin + ((px - F.left) / F.width) * (F.xMax - F.xMin);
      setRawX(clamp(Math.round(x * 10) / 10, lo, hi));
    },
  };

  return (
    <WidgetFrame
      id="exp-log-reflection"
      title="Inverse functions as a reflection"
      hint="Drag the point or the sliders"
      caption="Swapping x and y reflects the graph in the line y = x, so y = aˣ and y = logₐx are mirror images."
      svg={renderExpLogSvg(alt, { a, x0 }, dragProps)}
    >
      <Slider label="a (base)" value={a} min={0.2} max={4} step={0.05} onChange={changeA} format={(v) => fmt(v)} />
      <Slider label="x (point on y = aˣ)" value={x0} min={Math.ceil(lo * 10) / 10} max={Math.floor(hi * 10) / 10} step={0.1} onChange={setRawX} format={(v) => fmt(v, 1)} />
      <p>P = (<output aria-live="polite" data-testid="p">{fmt(p.x, 2)}, {fmt(p.y, 2)}</output>) on y = aˣ</p>
      <p>Q = (<output aria-live="polite" data-testid="q">{fmt(q.x, 2)}, {fmt(q.y, 2)}</output>) on y = logₐx</p>
      <p>logₐ({fmt(p.y, 2)}) = <output aria-live="polite" data-testid="log">{fmt(logBase(a, p.y), 2)}</output></p>
      <p className={styles.small}>a must be positive and not 1 (now {num(a)}).</p>
    </WidgetFrame>
  );
}
