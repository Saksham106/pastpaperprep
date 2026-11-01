import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { InteractiveId } from "@/lib/course-notes/types";
import type { WidgetProps } from "./types";

/**
 * Every interactive id maps to a lazily loaded client component, or null while its widget is not built yet.
 * Blocks keeps the alt-text placeholder for null (and for any id this map has never heard of).
 * next/dynamic still server-renders each widget, so the first frame is static SVG even with JS off.
 */
export const INTERACTIVES: Record<InteractiveId, ComponentType<WidgetProps> | null> = {
  "parts-area": dynamic(() => import("./PartsArea")),
  transformations: dynamic(() => import("./Transformations")),
  "discriminant-roots": dynamic(() => import("./DiscriminantRoots")),
  "exp-log-reflection": dynamic(() => import("./ExpLogReflection")),
  "unit-circle-graphs": dynamic(() => import("./UnitCircleGraphs")),
  "radian-arc": null,
  "secant-to-tangent": null,
  "derivative-sign": null,
  "riemann-sums": null,
  "area-between-curves": null,
  "revolution-slice": null,
  "binomial-shaded": null,
  "normal-shaded": null,
  "normal-approx-binomial": null,
  "regression-residuals": null,
  "argand-multiply": null,
  "roots-of-unity": null,
  "vector-angle": null,
  "maclaurin-partials": null,
  "euler-step": null,
};
