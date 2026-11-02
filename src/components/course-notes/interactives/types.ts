export type WidgetProps = {
  /** The block's alt text, used as the accessible name of the graph. */
  alt: string;
  /** Optional starting values from the lesson JSON. Unknown or out-of-range values are ignored. */
  props?: Record<string, unknown>;
};

/** Read a numeric starting value from lesson props, falling back when absent or out of range. */
export function numProp(props: Record<string, unknown> | undefined, key: string, fallback: number, min: number, max: number): number {
  const v = props?.[key];
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}
