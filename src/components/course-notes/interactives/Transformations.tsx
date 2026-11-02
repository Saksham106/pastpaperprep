"use client";

import { useState } from "react";
import styles from "../course-notes.module.css";
import { fmt, num } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { BASES, formatEquation, imageOfPoint, transformed, type BaseId, type Params } from "./transformations-math";
import type { WidgetProps } from "./types";

const F: Frame = { xMin: -6, xMax: 6, yMin: -5, yMax: 5, left: 18, top: 10, width: 324, height: 270 };

export type TransformationsState = { base: BaseId } & Params;
export const TRANSFORMATIONS_DEFAULT: TransformationsState = { base: "square", a: 1, b: 1, c: 0, d: 0 };

export function renderTransformationsSvg(alt: string, s: TransformationsState) {
  const base = BASES[s.base];
  const key = imageOfPoint(base.keyX, base.f(base.keyX), s);
  return (
    <svg viewBox="0 0 360 290" role="img" aria-label={alt}>
      <Grid f={F} />
      <Clip f={F}>
        <path d={curvePath(F, base.f, F.xMin, F.xMax)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="6 5" />
        <path d={curvePath(F, (x) => transformed(s.base, s, x), F.xMin, F.xMax)} fill="none" stroke="var(--cobalt)" strokeWidth="2.6" />
        <circle cx={sx(F, base.keyX)} cy={sy(F, base.f(base.keyX))} r="4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.6" />
        {key ? <circle cx={sx(F, key.x)} cy={sy(F, key.y)} r="4.5" fill="var(--cobalt)" /> : null}
      </Clip>
      <text x="340" y="24" fontSize="11" textAnchor="end" fill="var(--muted)">dashed: y = {base.label}</text>
      <text x="340" y="38" fontSize="11" textAnchor="end" fill="var(--cobalt)">solid: image</text>
    </svg>
  );
}

export default function Transformations({ alt }: WidgetProps) {
  const [s, setS] = useState<TransformationsState>(TRANSFORMATIONS_DEFAULT);
  const set = (k: keyof Params) => (v: number) => setS((p) => ({ ...p, [k]: v }));
  // b = 0 would collapse the graph; step over it in whichever direction the slider was moving.
  const changeB = (v: number) => setS((p) => ({ ...p, b: v === 0 ? (p.b > 0 ? -0.25 : 0.25) : v }));
  const key = imageOfPoint(BASES[s.base].keyX, BASES[s.base].f(BASES[s.base].keyX), s);
  return (
    <WidgetFrame
      id="transformations"
      title="Transform a graph"
      hint="Drag the sliders"
      caption="Dashed is the base curve, solid is the image. The open dot on the base lands on the filled dot."
      svg={renderTransformationsSvg(alt, s)}
    >
      <p><output aria-live="polite" data-testid="equation">{formatEquation(s.base, s)}</output></p>
      <p>
        <label htmlFor="tf-base">Base f(x) </label>
        <select id="tf-base" value={s.base} onChange={(e) => setS((p) => ({ ...p, base: e.target.value as BaseId }))}>
          {(Object.keys(BASES) as BaseId[]).map((id) => (
            <option key={id} value={id}>{BASES[id].label}</option>
          ))}
        </select>
      </p>
      <Slider label="a (vertical stretch)" value={s.a} min={-3} max={3} step={0.25} onChange={set("a")} format={num} />
      <Slider label="b (horizontal scale 1/b)" value={s.b} min={-3} max={3} step={0.25} onChange={changeB} format={num} />
      <Slider label="c (shift right)" value={s.c} min={-4} max={4} step={0.5} onChange={set("c")} format={num} />
      <Slider label="d (shift up)" value={s.d} min={-4} max={4} step={0.5} onChange={set("d")} format={num} />
      <p className={styles.small}>{key ? `${BASES[s.base].keyLabel} maps to (${fmt(key.x)}, ${fmt(key.y)})` : ""}</p>
    </WidgetFrame>
  );
}
