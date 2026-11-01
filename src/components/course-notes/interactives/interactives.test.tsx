import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { INTERACTIVE_IDS, type Block } from "@/lib/course-notes/types";
import { Blocks } from "../Blocks";
import { INTERACTIVES } from "./registry";
import PartsArea, { renderPartsAreaSvg } from "./PartsArea";
import Transformations, { renderTransformationsSvg, TRANSFORMATIONS_DEFAULT } from "./Transformations";
import DiscriminantRoots, { renderDiscriminantSvg } from "./DiscriminantRoots";
import ExpLogReflection, { renderExpLogSvg } from "./ExpLogReflection";
import UnitCircleGraphs, { renderUnitCircleSvg } from "./UnitCircleGraphs";
import { partsAreas } from "./parts-area-math";
import { BASES, formatEquation, imageOfPoint, transformed } from "./transformations-math";
import { discriminant, realRoots } from "./discriminant-math";
import { expPoint, logBase, pointRange, reflect } from "./exp-log-math";
import { fmt, num } from "./format";
import { pointerToSvg } from "./shared";
import { toDegrees, unitCirclePoint } from "./unit-circle-math";

afterEach(cleanup);

const slider = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const readout = (label: string | RegExp) => slider(label).parentElement!.querySelector("output")!.textContent;
const setSlider = (label: string | RegExp, value: number) => fireEvent.change(slider(label), { target: { value: String(value) } });

describe("registry", () => {
  it.each(INTERACTIVE_IDS)("%s renders a static SVG with its alt, or the placeholder", async (id) => {
    const alt = `Alt text for ${id}`;
    const blocks: Block[] = [{ type: "interactive", widget: id, props: {}, alt }];
    const { container } = render(<Blocks blocks={blocks} glossary={[]} level="SL" />);
    if (INTERACTIVES[id]) {
      const img = await screen.findByRole("img", { name: alt });
      expect(img.tagName.toLowerCase()).toBe("svg");
      expect(container.querySelector("figcaption")?.textContent).toBeTruthy();
    } else {
      expect(screen.getByText(alt)).toBeTruthy();
      expect(container.querySelector(`[data-widget="${id}"]`)).not.toBeNull();
      expect(screen.queryByRole("img")).toBeNull();
    }
  });

  it("keeps the placeholder for an id it has never heard of", () => {
    const blocks = [{ type: "interactive", widget: "not-a-widget", props: {}, alt: "Mystery" }] as unknown as Block[];
    render(<Blocks blocks={blocks} glossary={[]} level="SL" />);
    expect(screen.getByText("Mystery")).toBeTruthy();
  });
});

describe("first frame is plain server-rendered SVG", () => {
  it.each(INTERACTIVE_IDS.filter((id) => INTERACTIVES[id]))("Blocks server output for %s has the svg synchronously", (id) => {
    const html = renderToString(<Blocks blocks={[{ type: "interactive", widget: id, props: {}, alt: "Static alt" }]} glossary={[]} level="SL" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Static alt"');
    expect(html).toContain("<svg");
    expect(html).toContain("<input");
  });

  it("every built widget's pure render produces role=img markup with its alt", () => {
    const frames = [
      renderPartsAreaSvg("alt", { b: 2 }),
      renderTransformationsSvg("alt", TRANSFORMATIONS_DEFAULT),
      renderDiscriminantSvg("alt", { a: 1, b: -3, c: 2 }),
      renderExpLogSvg("alt", { a: 2, x0: 1 }),
      renderUnitCircleSvg("alt", { theta: Math.PI / 6 }),
    ];
    for (const f of frames) {
      const html = renderToStaticMarkup(f);
      expect(html).toContain('role="img"');
      expect(html).toContain('aria-label="alt"');
      expect(html).toContain("<path");
    }
  });
});

describe("parts-area", () => {
  it("at b = 2 the areas are 2.67, 5.33 and 8.00", () => {
    const a = partsAreas(2);
    expect(a.underCurve).toBeCloseTo(8 / 3, 10);
    expect(a.leftOfCurve).toBeCloseTo(16 / 3, 10);
    expect(a.rectangle).toBe(8);
    expect(a.underCurve + a.leftOfCurve).toBeCloseTo(a.rectangle, 10);
    render(<PartsArea alt="alt" />);
    expect(screen.getByTestId("area-under").textContent).toBe("2.67");
    expect(screen.getByTestId("area-left").textContent).toBe("5.33");
    expect(screen.getByTestId("area-rect").textContent).toBe("8.00");
  });

  it("at b = 1.5 the areas are 1.125, 2.25 and 3.375 and the readouts follow the slider", () => {
    render(<PartsArea alt="alt" />);
    setSlider("b", 1.5);
    expect(readout("b")).toBe("1.50");
    expect(screen.getByTestId("area-under").textContent).toBe("1.13");
    expect(screen.getByTestId("area-left").textContent).toBe("2.25");
    expect(screen.getByTestId("area-rect").textContent).toBe("3.38");
  });

  it("has an accessible slider with a visible label and one live result", () => {
    const { container } = render(<PartsArea alt="alt" />);
    expect(slider("b").type).toBe("range");
    expect(slider("b").parentElement!.querySelector("output")).not.toBeNull();
    expect(container.querySelectorAll("output[aria-live]")).toHaveLength(1);
  });
});

describe("transformations", () => {
  const p = { a: 2, b: 1, c: 1, d: -3 };
  it("y = 2(x − 1)² − 3 sends the base point (2, 4) to (3, 5)", () => {
    expect(transformed("square", p, 3)).toBe(5);
    expect(imageOfPoint(2, 4, p)).toEqual({ x: 3, y: 5 });
    expect(transformed("square", p, 1)).toBe(-3); // vertex (1, -3)
  });

  it("sin: a = 3, b = 2, d = 1 sends (π/2, 1) to (π/4, 4)", () => {
    const q = { a: 3, b: 2, c: 0, d: 1 };
    expect(transformed("sin", q, Math.PI / 4)).toBeCloseTo(4, 10);
    const img = imageOfPoint(Math.PI / 2, 1, q)!;
    expect(img.x).toBeCloseTo(Math.PI / 4, 10);
    expect(img.y).toBe(4);
  });

  it("|x| reflected and lifted: y = 3 − |x| at x = −4 is −1; eˣ shifted right 2 passes (2, 1)", () => {
    expect(transformed("abs", { a: -1, b: 1, c: 0, d: 3 }, -4)).toBe(-1);
    expect(transformed("exp", { a: 1, b: 1, c: 2, d: 0 }, 2)).toBe(1);
    expect(BASES.exp.f(BASES.exp.keyX)).toBe(1);
  });

  it("writes the equation", () => {
    expect(formatEquation("square", p)).toBe("y = 2(x − 1)² − 3");
    expect(formatEquation("square", { a: 1, b: 1, c: 0, d: 0 })).toBe("y = x²");
    expect(formatEquation("sin", { a: 3, b: 2, c: 0, d: 1 })).toBe("y = 3 sin(2x) + 1");
    expect(formatEquation("abs", { a: -1, b: 1, c: -2, d: 0 })).toBe("y = −|x + 2|");
    expect(formatEquation("exp", { a: 1, b: -1, c: 0, d: 0 })).toBe("y = e^(−x)");
  });

  it("sliders update the readout and the equation", () => {
    render(<Transformations alt="alt" />);
    expect(screen.getByTestId("equation").textContent).toBe("y = x²");
    setSlider(/^a /, 2);
    setSlider(/^c /, 1);
    setSlider(/^d /, -3);
    expect(readout(/^a /)).toBe("2");
    expect(readout(/^d /)).toBe("−3");
    expect(screen.getByTestId("equation").textContent).toBe("y = 2(x − 1)² − 3");
    expect(screen.getByText(/maps to \(2\.00, −1\.00\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Base f/), { target: { value: "abs" } });
    expect(screen.getByTestId("equation").textContent).toBe("y = 2|x − 1| − 3");
  });
});

describe("discriminant-roots", () => {
  it("a = 1, b = −3, c = 2 gives Δ = 1 and roots 1 and 2", () => {
    expect(discriminant(1, -3, 2)).toBe(1);
    expect(realRoots(1, -3, 2)).toEqual([1, 2]);
  });
  it("covers repeated, none and a < 0", () => {
    expect(realRoots(1, 2, 1)).toEqual([-1]);
    expect(discriminant(1, 0, 1)).toBe(-4);
    expect(realRoots(1, 0, 1)).toEqual([]);
    expect(discriminant(2, -1, -3)).toBe(25);
    expect(realRoots(2, -1, -3)).toEqual([-1, 1.5]);
    expect(realRoots(-1, 0, 4)).toEqual([-2, 2]);
  });
  it("shows the starting values then follows the sliders", () => {
    render(<DiscriminantRoots alt="alt" />);
    expect(screen.getByTestId("delta").textContent).toBe("1.00");
    expect(screen.getByTestId("root-count").textContent).toBe("2 distinct real roots");
    expect(screen.getByTestId("roots").textContent).toBe("1.00, 2.00");
    setSlider("b", 2);
    setSlider("c", 1);
    expect(readout("b")).toBe("2");
    expect(screen.getByTestId("delta").textContent).toBe("0.00");
    expect(screen.getByTestId("root-count").textContent).toBe("1 repeated real root");
    expect(screen.getByTestId("roots").textContent).toBe("−1.00");
    setSlider("c", 3);
    expect(screen.getByTestId("delta").textContent).toBe("−8.00");
    expect(screen.getByTestId("root-count").textContent).toBe("no real roots");
    expect(screen.getByTestId("roots").textContent).toBe("none");
  });
  it("marks the roots on the graph only when real", () => {
    expect(renderToStaticMarkup(renderDiscriminantSvg("alt", { a: 1, b: -3, c: 2 })).match(/<circle/g)).toHaveLength(2);
    expect(renderToStaticMarkup(renderDiscriminantSvg("alt", { a: 1, b: 0, c: 1 })).match(/<circle/g)).toBeNull();
  });
});

describe("exp-log-reflection", () => {
  it("log₂ 8 = 3 and the reflection of (3, 8) is (8, 3)", () => {
    expect(logBase(2, 8)).toBeCloseTo(3, 10);
    expect(logBase(0.5, 8)).toBeCloseTo(-3, 10);
    expect(expPoint(2, 3)).toEqual({ x: 3, y: 8 });
    expect(reflect({ x: 3, y: 8 })).toEqual({ x: 8, y: 3 });
  });
  it("keeps the point and its reflection inside the window", () => {
    const [lo, hi] = pointRange(2);
    expect(lo).toBe(-3.5);
    expect(hi).toBeCloseTo(Math.log2(7.5), 10);
    const [lo2, hi2] = pointRange(0.5);
    expect(lo2).toBeCloseTo(-Math.log2(7.5), 10);
    expect(hi2).toBe(7.5);
  });
  it("reads P, Q and the logarithm, and the sliders move them", () => {
    render(<ExpLogReflection alt="alt" />);
    expect(screen.getByTestId("p").textContent).toBe("1.00, 2.00");
    expect(screen.getByTestId("q").textContent).toBe("2.00, 1.00");
    setSlider(/^x /, 2.9);
    expect(readout(/^x /)).toBe("2.9");
    expect(screen.getByTestId("p").textContent).toBe("2.90, 7.46");
    setSlider(/^a /, 3);
    expect(readout(/^a /)).toBe("3.00");
    expect(screen.getByTestId("p").textContent).toBe("1.83, 7.50"); // x clamped so 3^x stays on the plot
    setSlider(/^x /, 1);
    expect(screen.getByTestId("p").textContent).toBe("1.00, 3.00");
    expect(screen.getByTestId("q").textContent).toBe("3.00, 1.00");
    expect(screen.getByTestId("log").textContent).toBe("1.00");
  });
  it("a = 1 is skipped", () => {
    render(<ExpLogReflection alt="alt" />);
    setSlider(/^a /, 1);
    expect(Number(slider(/^a /).value)).not.toBe(1);
  });
});

describe("unit-circle-graphs", () => {
  it("θ = π/6 is (0.866, 0.5)", () => {
    const p = unitCirclePoint(Math.PI / 6);
    expect(p.cos).toBeCloseTo(0.866, 3);
    expect(p.sin).toBeCloseTo(0.5, 10);
    expect(toDegrees(Math.PI / 6)).toBeCloseTo(30, 10);
  });
  it("θ = 7π/6 is (−0.866, −0.5) and θ = π is (−1, 0)", () => {
    const p = unitCirclePoint((7 * Math.PI) / 6);
    expect(p.cos).toBeCloseTo(-0.866, 3);
    expect(p.sin).toBeCloseTo(-0.5, 10);
    expect(unitCirclePoint(Math.PI).cos).toBe(-1);
    expect(unitCirclePoint(Math.PI).sin).toBeCloseTo(0, 10);
  });
  it("starts at π/6 and follows the slider", () => {
    render(<UnitCircleGraphs alt="alt" />);
    expect(screen.getByTestId("cos").textContent).toBe("0.866");
    expect(screen.getByTestId("sin").textContent).toBe("0.500");
    act(() => setSlider(/^θ /, 3.14));
    expect(readout(/^θ /)).toBe("3.14 rad");
    expect(screen.getByTestId("cos").textContent).toBe("−1.000");
    expect(screen.getByTestId("sin").textContent).toBe("0.002");
  });
});

describe("format", () => {
  it("uses a real minus sign and never prints negative zero", () => {
    expect(fmt(-3)).toBe("−3.00");
    expect(fmt(-0.001)).toBe("0.00");
    expect(num(-0.5)).toBe("−0.5");
    expect(num(2)).toBe("2");
  });
});

describe("only one live region per widget", () => {
  it.each([
    ["transformations", <Transformations key="t" alt="a" />],
    ["discriminant-roots", <DiscriminantRoots key="d" alt="a" />],
    ["exp-log-reflection", <ExpLogReflection key="e" alt="a" />],
    ["unit-circle-graphs", <UnitCircleGraphs key="u" alt="a" />],
    ["parts-area", <PartsArea key="p" alt="a" />],
  ])("%s", (_id, el) => {
    const { container } = render(el);
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(1);
  });
});

describe("transformations b slider", () => {
  it("is labelled with the 1/b scale and steps over b = 0", () => {
    render(<Transformations alt="alt" />);
    expect(slider("b (horizontal scale 1/b)")).toBeTruthy();
    setSlider(/^b /, 0.25);
    setSlider(/^b /, 0);
    expect(readout(/^b /)).toBe("−0.25");
    setSlider(/^b /, 0);
    expect(readout(/^b /)).toBe("0.25");
  });
});

describe("pointerToSvg", () => {
  it("maps through the outer svg's screen CTM, not the nested clip svg", () => {
    document.body.innerHTML = '<svg role="img" viewBox="0 0 360 260"><svg id="inner"><circle id="c"/></svg></svg>';
    const outer = document.querySelector('svg[role="img"]') as unknown as SVGSVGElement;
    // 2 CSS px per user unit, the svg's top-left sits at (10, 20) on screen.
    outer.getScreenCTM = () => ({ inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -5, f: -10 }) }) as unknown as DOMMatrix;
    const circle = document.getElementById("c")!;
    expect(pointerToSvg({ clientX: 370, clientY: 120 }, circle)).toEqual({ x: 180, y: 50 });
  });

  it("falls back to the bounding box and viewBox when there is no CTM", () => {
    document.body.innerHTML = '<svg role="img" viewBox="0 0 360 260"><circle id="c"/></svg>';
    const outer = document.querySelector("svg") as unknown as SVGSVGElement;
    outer.getScreenCTM = () => null;
    outer.getBoundingClientRect = () => ({ left: 10, top: 20, width: 720, height: 520 }) as DOMRect;
    expect(pointerToSvg({ clientX: 370, clientY: 120 }, document.getElementById("c")!)).toEqual({ x: 180, y: 50 });
  });
});

describe("exp-log drag", () => {
  it("puts the point under the cursor on the outer svg's scale", () => {
    const { container } = render(<ExpLogReflection alt="alt" />);
    const outer = container.querySelector('svg[role="img"]') as unknown as SVGSVGElement;
    outer.getScreenCTM = () => ({ inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -5, f: -10 }) }) as unknown as DOMMatrix;
    const dot = container.querySelector("circle[style*='grab']") as SVGCircleElement;
    dot.setPointerCapture = vi.fn();
    dot.hasPointerCapture = () => true;
    // x = 2 sits at user x = 18 + (2 + 3.5) / 11 * 324 = 180, i.e. client x = 2 * 180 + 10 = 370.
    // jsdom has no PointerEvent, so send a MouseEvent under the pointer event name (React reads clientX from it).
    act(() => {
      dot.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 370, clientY: 100 }));
    });
    expect(readout(/^x /)).toBe("2.0");
    expect(screen.getByTestId("p").textContent).toBe("2.00, 4.00");
    expect(screen.getByTestId("q").textContent).toBe("4.00, 2.00");
  });
});
