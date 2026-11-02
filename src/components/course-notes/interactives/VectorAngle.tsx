"use client";

import { useState, type SVGProps } from "react";
import { fmt, num } from "./format";
import { Clip, Grid, pointerToSvg, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { angleDegrees, cosAngle, dot, isPerpendicular, norm, type Vec } from "./vector-math";
import { numProp, type WidgetProps } from "./types";

const F: Frame = { xMin: -6, xMax: 6, yMin: -6, yMax: 6, left: 60, top: 10, width: 240, height: 240 };
const LIM = { lo: -5, hi: 5 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number) => clamp(Math.round(v * 2) / 2, LIM.lo, LIM.hi);

export type VectorState = { a: Vec; b: Vec };

type DragProps = SVGProps<SVGCircleElement>;

/** Angle marker between the vectors: a right-angle square when perpendicular, otherwise an arc through the smaller angle. */
function marker(a: Vec, b: Vec): string {
  const ua = { x: a.x / norm(a), y: a.y / norm(a) };
  const ub = { x: b.x / norm(b), y: b.y / norm(b) };
  const P = (v: Vec) => `${sx(F, v.x).toFixed(1)} ${sy(F, v.y).toFixed(1)}`;
  if (isPerpendicular(a, b)) {
    const s = 0.6;
    return `M${P({ x: ua.x * s, y: ua.y * s })}L${P({ x: (ua.x + ub.x) * s, y: (ua.y + ub.y) * s })}L${P({ x: ub.x * s, y: ub.y * s })}`;
  }
  const a0 = Math.atan2(ua.y, ua.x);
  let delta = Math.atan2(ub.y, ub.x) - a0;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  let d = "";
  for (let k = 0; k <= 24; k++) {
    const t = a0 + (delta * k) / 24;
    d += `${k === 0 ? "M" : "L"}${P({ x: 0.9 * Math.cos(t), y: 0.9 * Math.sin(t) })}`;
  }
  return d;
}

export function renderVectorSvg(alt: string, { a, b }: VectorState, dragA?: DragProps, dragB?: DragProps) {
  const both = norm(a) > 0 && norm(b) > 0;
  const tips = [
    { name: "a", v: a, color: "var(--t1-ink)", drag: dragA },
    { name: "b", v: b, color: "var(--t5-ink)", drag: dragB },
  ];
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} labelEvery={2} />
      <Clip f={F}>
        {both && <path d={marker(a, b)} fill="none" stroke="var(--ink)" strokeWidth="1.4" />}
        {tips.map((t) => (
          <line key={t.name} x1={sx(F, 0)} y1={sy(F, 0)} x2={sx(F, t.v.x)} y2={sy(F, t.v.y)} stroke={t.color} strokeWidth="2.8" />
        ))}
        {tips.map((t) => (
          <circle key={t.name} cx={sx(F, t.v.x)} cy={sy(F, t.v.y)} r="7" fill={t.color} stroke="var(--surface)" strokeWidth="2" style={{ cursor: "grab", touchAction: "none" }} {...t.drag} />
        ))}
      </Clip>
      <g fontSize="12" fontWeight="600">
        {tips.map((t) => (
          <text key={t.name} x={sx(F, t.v.x) + 10} y={sy(F, t.v.y) - 8} fill={t.color}>{t.name}</text>
        ))}
      </g>
      <g fontSize="11">
        <text x="8" y="26" fill="var(--t1-ink)">a (drag tip)</text>
        <text x="8" y="40" fill="var(--t5-ink)">b (drag tip)</text>
      </g>
    </svg>
  );
}

export default function VectorAngle({ alt, props }: WidgetProps) {
  const [a, setA] = useState<Vec>(() => ({ x: numProp(props, "a1", 3, LIM.lo, LIM.hi), y: numProp(props, "a2", 4, LIM.lo, LIM.hi) }));
  const [b, setB] = useState<Vec>(() => ({ x: numProp(props, "b1", 4, LIM.lo, LIM.hi), y: numProp(props, "b2", 1, LIM.lo, LIM.hi) }));

  const dragFor = (set: (fn: (v: Vec) => Vec) => void): DragProps => ({
    onPointerDown: (e) => e.currentTarget.setPointerCapture(e.pointerId),
    onPointerMove: (e) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const { x: px, y: py } = pointerToSvg(e, e.currentTarget);
      const x = F.xMin + ((px - F.left) / F.width) * (F.xMax - F.xMin);
      const y = F.yMax - ((py - F.top) / F.height) * (F.yMax - F.yMin);
      set(() => ({ x: snap(x), y: snap(y) }));
    },
  });

  const d = dot(a, b);
  const theta = angleDegrees(a, b);
  const cos = cosAngle(a, b);
  const perp = isPerpendicular(a, b);
  const dotText = `${num(a.x)} × ${num(b.x)} + ${num(a.y)} × ${num(b.y)} = ${fmt(d, 2)}`;
  const result = theta === null
    ? `a·b = ${fmt(d, 2)}; the angle is undefined because one vector is zero`
    : `a·b = ${fmt(d, 2)}, θ = ${fmt(theta, 1)}°${perp ? ", so the vectors are perpendicular" : ""}`;
  return (
    <WidgetFrame
      id="vector-angle"
      title="The angle between two vectors"
      hint="Drag the tips or use the sliders"
      caption="The scalar product a·b = a₁b₁ + a₂b₂ = |a||b| cos θ, so cos θ = a·b / (|a||b|). The vectors are perpendicular exactly when a·b = 0."
      svg={renderVectorSvg(alt, { a, b }, dragFor(setA), dragFor(setB))}
    >
      <Slider label="a₁" value={a.x} min={LIM.lo} max={LIM.hi} step={0.5} onChange={(x) => setA((v) => ({ ...v, x }))} format={(v) => num(v)} />
      <Slider label="a₂" value={a.y} min={LIM.lo} max={LIM.hi} step={0.5} onChange={(y) => setA((v) => ({ ...v, y }))} format={(v) => num(v)} />
      <Slider label="b₁" value={b.x} min={LIM.lo} max={LIM.hi} step={0.5} onChange={(x) => setB((v) => ({ ...v, x }))} format={(v) => num(v)} />
      <Slider label="b₂" value={b.y} min={LIM.lo} max={LIM.hi} step={0.5} onChange={(y) => setB((v) => ({ ...v, y }))} format={(v) => num(v)} />
      <p>a·b = {dotText}</p>
      <p>|a| = <output aria-live="off" data-testid="norm-a">{fmt(norm(a), 3)}</output>, |b| = <output aria-live="off" data-testid="norm-b">{fmt(norm(b), 3)}</output></p>
      <p>cos θ = <output aria-live="off" data-testid="cos">{cos === null ? "undefined" : fmt(cos, 4)}</output></p>
      <p><output aria-live="polite" data-testid="result">{result}</output></p>
    </WidgetFrame>
  );
}
