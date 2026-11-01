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
import RadianArc, { renderRadianArcSvg } from "./RadianArc";
import SecantToTangent, { renderSecantSvg } from "./SecantToTangent";
import DerivativeSign, { renderDerivativeSignSvg } from "./DerivativeSign";
import RiemannSums, { renderRiemannSvg } from "./RiemannSums";
import AreaBetweenCurves, { renderAreaBetweenSvg } from "./AreaBetweenCurves";
import RevolutionSlice, { renderRevolutionSvg } from "./RevolutionSlice";
import BinomialShaded, { renderBinomialSvg } from "./BinomialShaded";
import NormalShaded, { renderNormalSvg } from "./NormalShaded";
import ZStandardise, { renderZStandardiseSvg } from "./ZStandardise";
import RegressionTwoLines, { renderRegressionSvg } from "./RegressionTwoLines";
import { REV_SHAPES } from "./revolution-math";
import { binomMean, binomPmf, binomProb, binomVariance, choose } from "./binomial-math";
import { erf, inverseNormal, inverseNormalRaw, normalCdf, normalProb, phi } from "./normal-math";
import { DRAG_START, FIXED_POINTS, regression } from "./regression-math";
import { arcLength, radToDeg, sectorArea } from "./radian-arc-math";
import { SECANT_CURVES, secantGradient } from "./secant-math";
import { df, f as cubicF, STATIONARY, trendAt } from "./derivative-sign-math";
import { EXACT, riemannSum } from "./riemann-math";
import { areaTo } from "./area-between-math";
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
      renderRadianArcSvg("alt", { r: 2, theta: Math.PI / 3 }),
      renderSecantSvg("alt", { curve: "square", h: 0.5 }),
      renderDerivativeSignSvg("alt", { x: 0 }),
      renderRiemannSvg("alt", { n: 4, mode: "left" }),
      renderAreaBetweenSvg("alt", { pair: "x-x2", b: 1 }),
      renderRevolutionSvg("alt", { shape: "sqrt", b: 2, x0: 1 }),
      renderBinomialSvg("alt", { n: 10, p: 0.5, mode: "eq", k: 5 }),
      renderNormalSvg("alt", { mu: 100, sigma: 15, za: -1, zb: 1, mode: "between" }),
      renderZStandardiseSvg("alt", { mu: 100, sigma: 15, z: 2 }),
      renderRegressionSvg("alt", DRAG_START),
    ];
    for (const f of frames) {
      const html = renderToStaticMarkup(f);
      expect(html).toContain('role="img"');
      expect(html).toContain('aria-label="alt"');
      expect(html).toMatch(/<path|<rect/);
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

describe("radian-arc", () => {
  it("r = 2, θ = π/3 gives s = 2π/3 = 2.094 and A = ½·4·π/3 = 2π/3 = 2.094", () => {
    expect(arcLength(2, Math.PI / 3)).toBeCloseTo(2.0944, 4);
    expect(sectorArea(2, Math.PI / 3)).toBeCloseTo(2.0944, 4);
  });
  it("θ = π is 180°, and θ = 2π with r = 1 gives the circumference 2π and area π", () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 10);
    expect(arcLength(1, 2 * Math.PI)).toBeCloseTo(6.2832, 4);
    expect(sectorArea(1, 2 * Math.PI)).toBeCloseTo(Math.PI, 10);
  });
  it("starts at r = 2, θ = π/3 and follows the sliders", () => {
    render(<RadianArc alt="alt" />);
    expect(screen.getByTestId("arc").textContent).toBe("2.094");
    expect(screen.getByTestId("sector").textContent).toBe("2.094");
    expect(screen.getByTestId("degrees").textContent).toBe("60.0");
    setSlider(/^θ /, 3.14); // s = 2 × 3.14 = 6.28, A = ½ × 4 × 3.14 = 6.28
    expect(readout(/^θ /)).toBe("3.14 rad");
    expect(screen.getByTestId("arc").textContent).toBe("6.280");
    expect(screen.getByTestId("degrees").textContent).toBe("179.9");
    setSlider(/^r /, 3); // s = 3 × 3.14 = 9.42, A = ½ × 9 × 3.14 = 14.13
    expect(screen.getByTestId("arc").textContent).toBe("9.420");
    expect(screen.getByTestId("sector").textContent).toBe("14.130");
    setSlider(/^θ /, 6.28); // end stop is a full circle: s = 2π·3 = 18.850, A = ½ × 9 × 2π = 28.274
    expect(screen.getByTestId("arc").textContent).toBe("18.850");
    expect(screen.getByTestId("sector").textContent).toBe("28.274");
    expect(screen.getByTestId("degrees").textContent).toBe("360.0");
  });
});

describe("secant-to-tangent", () => {
  it("y = x²: h = 0.5 gives (2.25 − 1)/0.5 = 2.5 and h = 0.1 gives (1.21 − 1)/0.1 = 2.1", () => {
    const { f } = SECANT_CURVES.square;
    expect(secantGradient(f, 0.5)).toBeCloseTo(2.5, 10);
    expect(secantGradient(f, 0.1)).toBeCloseTo(2.1, 10);
  });
  it("y = x³: h = 1 gives (8 − 1)/1 = 7 and the tangent gradient is 3", () => {
    expect(secantGradient(SECANT_CURVES.cube.f, 1)).toBeCloseTo(7, 10);
    expect(SECANT_CURVES.cube.df(1)).toBe(3);
  });
  it("reads the secant gradient from the slider and the tangent gradient 2", () => {
    render(<SecantToTangent alt="alt" />);
    expect(screen.getByTestId("tangent").textContent).toBe("2");
    setSlider(/^h /, 0.5);
    expect(screen.getByTestId("secant").textContent).toBe("2.500");
    setSlider(/^h /, 0.1);
    expect(screen.getByTestId("secant").textContent).toBe("2.100");
    fireEvent.change(screen.getByLabelText(/Curve/), { target: { value: "cube" } }); // (1.331 − 1)/0.1 = 3.31
    expect(screen.getByTestId("secant").textContent).toBe("3.310");
    expect(screen.getByTestId("tangent").textContent).toBe("3");
  });
});

describe("derivative-sign", () => {
  it("x = 0: f′ = 3·0 − 3 = −3, decreasing; x = 2: f′ = 12 − 3 = 9, increasing", () => {
    expect(df(0)).toBe(-3);
    expect(trendAt(0)).toBe("decreasing");
    expect(df(2)).toBe(9);
    expect(trendAt(2)).toBe("increasing");
  });
  it("x = ±1 are stationary points with f(1) = 1 − 3 = −2 and f(−1) = −1 + 3 = 2", () => {
    expect(df(1)).toBe(0);
    expect(df(-1)).toBe(0);
    expect(trendAt(1)).toBe("stationary");
    expect(STATIONARY).toEqual([{ x: -1, y: 2 }, { x: 1, y: -2 }]);
    expect(cubicF(2)).toBe(2); // 8 − 6
  });
  it("starts at x = 0 and follows the slider", () => {
    render(<DerivativeSign alt="alt" />);
    expect(screen.getByTestId("derivative").textContent).toBe("−3.00 (decreasing)");
    setSlider("x", 2); // 3·4 − 3 = 9
    expect(screen.getByTestId("derivative").textContent).toBe("9.00 (increasing)");
    setSlider("x", 1);
    expect(screen.getByTestId("derivative").textContent).toBe("0.00 (stationary)");
  });
});

describe("riemann-sums", () => {
  // n = 4 on [0, 2]: width 0.5, left x = 0, 0.5, 1, 1.5; right x = 0.5, 1, 1.5, 2; mid x = 0.25, 0.75, 1.25, 1.75.
  it("left, n = 4: 0.5·(0 + 0.25 + 1 + 2.25) = 1.75", () => {
    expect(riemannSum(4, "left")).toBeCloseTo(1.75, 10);
  });
  it("right, n = 4: 0.5·(0.25 + 1 + 2.25 + 4) = 3.75", () => {
    expect(riemannSum(4, "right")).toBeCloseTo(3.75, 10);
  });
  it("midpoint, n = 4: 0.5·(0.0625 + 0.5625 + 1.5625 + 3.0625) = 2.625", () => {
    expect(riemannSum(4, "mid")).toBeCloseTo(2.625, 10);
  });
  it("converges to 8/3 as n grows and n = 1 left is 0, right is 2·4 = 8", () => {
    expect(EXACT).toBeCloseTo(2.6667, 4);
    expect(riemannSum(1, "left")).toBe(0);
    expect(riemannSum(1, "right")).toBe(8);
    expect(Math.abs(riemannSum(50, "mid") - EXACT)).toBeLessThan(0.001);
  });
  it("reads the sum for the chosen rule and n", () => {
    render(<RiemannSums alt="alt" />);
    setSlider(/^n /, 4);
    expect(screen.getByTestId("sum").textContent).toBe("2.625");
    fireEvent.change(screen.getByLabelText(/Rectangle heights/), { target: { value: "left" } });
    expect(screen.getByTestId("sum").textContent).toBe("1.750");
    fireEvent.change(screen.getByLabelText(/Rectangle heights/), { target: { value: "right" } });
    expect(screen.getByTestId("sum").textContent).toBe("3.750");
    expect(screen.getByTestId("exact").textContent).toBe("2.667");
    expect(screen.getByTestId("error").textContent).toBe("1.083"); // 3.75 − 2.6667
  });
});

describe("area-between-curves", () => {
  it("y = x and y = x² on [0, 1]: [x²/2 − x³/3] = 1/2 − 1/3 = 1/6 ≈ 0.167", () => {
    expect(areaTo("x-x2", 1)).toBeCloseTo(1 / 6, 10);
  });
  it("up to b = 0.5: 1/8 − 1/24 = 1/12 ≈ 0.083", () => {
    expect(areaTo("x-x2", 0.5)).toBeCloseTo(1 / 12, 10);
  });
  it("y = x + 2 and y = x² on [−1, 2]: (2 + 4 − 8/3) − (1/2 − 2 + 1/3) = 10/3 + 7/6 = 9/2", () => {
    expect(areaTo("x+2-x2", 2)).toBeCloseTo(4.5, 10);
    expect(areaTo("x+2-x2", -1)).toBe(0);
  });
  it("prints a real minus sign for the lower intersection", () => {
    render(<AreaBetweenCurves alt="alt" />);
    fireEvent.change(screen.getByLabelText(/Curves/), { target: { value: "x+2-x2" } });
    expect(screen.getByText(/They meet at x = −1 and x = 2/)).toBeTruthy();
  });
  it("reads the area, starting from the full enclosed region", () => {
    render(<AreaBetweenCurves alt="alt" />);
    expect(screen.getByTestId("area").textContent).toBe("0.167");
    setSlider(/^b /, 0.5);
    expect(screen.getByTestId("area").textContent).toBe("0.083");
    fireEvent.change(screen.getByLabelText(/Curves/), { target: { value: "x+2-x2" } });
    expect(screen.getByTestId("area").textContent).toBe("4.500");
  });
});

describe("revolution-slice", () => {
  // y = √x: V = π∫₀ᵇ x dx = πb²/2, so b = 4 gives 8π ≈ 25.133 and b = 2 gives 2π ≈ 6.283.
  it("√x: b = 4 gives 8π and b = 2 gives 2π", () => {
    expect(REV_SHAPES.sqrt.volume(4)).toBeCloseTo(8 * Math.PI, 10);
    expect(REV_SHAPES.sqrt.volume(2)).toBeCloseTo(2 * Math.PI, 10);
  });
  // y = x: V = π∫₀ᵇ x² dx = πb³/3, so b = 2 gives 8π/3 ≈ 8.378.
  it("y = x: b = 2 gives 8π/3", () => {
    expect(REV_SHAPES.line.volume(2)).toBeCloseTo(8.3776, 4);
  });
  it("reads the volume, disc radius and area, and follows the controls", () => {
    render(<RevolutionSlice alt="alt" />);
    expect(screen.getByTestId("volume").textContent).toBe("6.283 (volume of y = √x rotated about the x-axis, 0 ≤ x ≤ 2)");
    expect(screen.getByTestId("radius").textContent).toBe("1.000"); // √1
    expect(screen.getByTestId("disc-area").textContent).toBe("3.142"); // π·1
    setSlider(/^b /, 4);
    expect(screen.getByTestId("volume").textContent).toBe("25.133 (volume of y = √x rotated about the x-axis, 0 ≤ x ≤ 4)");
    setSlider(/^x₀/, 4); // √4 = 2, area 4π
    expect(screen.getByTestId("radius").textContent).toBe("2.000");
    expect(screen.getByTestId("disc-area").textContent).toBe("12.566");
    fireEvent.change(screen.getByLabelText(/Curve/), { target: { value: "line" } });
    setSlider(/^b /, 2);
    expect(screen.getByTestId("volume").textContent).toBe("8.378 (volume of y = x rotated about the x-axis, 0 ≤ x ≤ 2)");
    expect(screen.getByTestId("radius").textContent).toBe("2.000"); // x₀ clamped to b = 2
  });
  it("draws the curve, a dashed mirror and one disc", () => {
    const html = renderToStaticMarkup(renderRevolutionSvg("alt", { shape: "sqrt", b: 2, x0: 1 }));
    expect(html).toContain("stroke-dasharray");
    expect(html.match(/<ellipse/g)).toHaveLength(1);
  });
});

describe("binomial-shaded", () => {
  // B(10, 0.5): P(X = 5) = C(10,5)/2¹⁰ = 252/1024 = 0.24609; P(X ≤ 3) = (1 + 10 + 45 + 120)/1024 = 176/1024 = 0.17188.
  it("B(10, 0.5): P(X = 5) = 252/1024 and P(X ≤ 3) = 176/1024", () => {
    expect(choose(10, 5)).toBe(252);
    expect(binomPmf(10, 0.5, 5)).toBeCloseTo(252 / 1024, 12);
    expect(binomProb(10, 0.5, "le", 3)).toBeCloseTo(176 / 1024, 12);
    expect(binomProb(10, 0.5, "ge", 3)).toBeCloseTo(1 - 56 / 1024, 12); // P(X ≥ 3) = 1 − (1 + 10 + 45)/1024
  });
  it("means and variances: B(10, 0.5) → 5, 2.5; B(20, 0.3) → 6, 4.2", () => {
    expect(binomMean(10, 0.5)).toBe(5);
    expect(binomVariance(10, 0.5)).toBe(2.5);
    expect(binomMean(20, 0.3)).toBeCloseTo(6, 12);
    expect(binomVariance(20, 0.3)).toBeCloseTo(4.2, 12);
  });
  it("coefficients stay exact up to n = 30 and the pmf sums to 1", () => {
    expect(choose(30, 15)).toBe(155117520);
    expect(choose(30, 0)).toBe(1);
    expect(binomProb(30, 0.95, "ge", 0)).toBeCloseTo(1, 12);
  });
  it("reads the event probability, mean and variance", () => {
    render(<BinomialShaded alt="alt" />);
    expect(screen.getByTestId("prob").textContent).toBe("0.2461 (P(X = 5))");
    expect(screen.getByTestId("mean").textContent).toBe("5.00");
    expect(screen.getByTestId("variance").textContent).toBe("2.50");
    fireEvent.change(screen.getByLabelText(/Event/), { target: { value: "le" } });
    setSlider("k", 3);
    expect(screen.getByTestId("prob").textContent).toBe("0.1719 (P(X ≤ 3))");
    setSlider(/^n /, 20);
    setSlider(/^p /, 0.3);
    expect(screen.getByTestId("mean").textContent).toBe("6.00");
    expect(screen.getByTestId("variance").textContent).toBe("4.20");
  });
  it("k follows n downwards", () => {
    render(<BinomialShaded alt="alt" />);
    setSlider(/^n /, 3);
    expect(readout("k")).toBe("3");
    expect(screen.getByTestId("prob").textContent).toBe("0.1250 (P(X = 3))");
  });
  it("shades only the event's bars", () => {
    const html = renderToStaticMarkup(renderBinomialSvg("alt", { n: 10, p: 0.5, mode: "le", k: 3 }));
    expect(html.match(/fill="var\(--t1\)"/g)).toHaveLength(4);
  });
});

describe("normal-shaded", () => {
  // Reference values: Φ(1) = 0.841344746, Φ(2) = 0.977249868, Φ(1.96) = 0.975002105, Φ(−1) = 0.158655254.
  it("erf and Φ agree with known values to 1e-9", () => {
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(phi(1)).toBeCloseTo(0.8413447460685429, 12);
    expect(phi(-1)).toBeCloseTo(0.15865525393145707, 12);
    expect(phi(2)).toBeCloseTo(0.9772498680518208, 12);
    expect(phi(0)).toBe(0.5);
    expect(phi(3.5)).toBeCloseTo(0.9997673709209645, 12);
    expect(phi(-5)).toBeCloseTo(2.866515718791939e-7, 15);
  });
  it("N(0, 1): P(Z < 1) = 0.84134, P(−1 < Z < 1) = 0.68269, P(−1.96 < Z < 1.96) = 0.95000", () => {
    expect(normalCdf(1, 0, 1)).toBeCloseTo(0.84134, 5);
    expect(normalProb("between", -1, 1, 0, 1)).toBeCloseTo(0.68269, 5);
    expect(normalProb("between", -1.96, 1.96, 0, 1)).toBeCloseTo(0.95, 4);
  });
  it("N(100, 15²): P(X < 130) = Φ(2) = 0.97725, P(X > 85) = Φ(1) = 0.84134", () => {
    expect(normalProb("below", 0, 130, 100, 15)).toBeCloseTo(0.97725, 5);
    expect(normalProb("above", 85, 0, 100, 15)).toBeCloseTo(0.84134, 5);
  });
  it("starts at the 68% region and the modes change the readout", () => {
    render(<NormalShaded alt="alt" />);
    expect(screen.getByTestId("prob").textContent).toBe("0.6827 (P(85 < X < 115))");
    fireEvent.change(screen.getByLabelText(/Event/), { target: { value: "below" } });
    setSlider(/^b /, 130);
    expect(screen.getByTestId("prob").textContent).toBe("0.9772 (P(X < 130))");
    fireEvent.change(screen.getByLabelText(/Event/), { target: { value: "above" } });
    expect(screen.getByTestId("prob").textContent).toBe("0.8413 (P(X > 85))");
  });
  it("N(0, 1) with a = −1.96 and b = 1.96 reads 0.9500", () => {
    render(<NormalShaded alt="alt" />);
    setSlider(/^μ /, 0);
    setSlider(/^σ /, 1);
    setSlider(/^a /, -1.96);
    setSlider(/^b /, 1.96);
    expect(screen.getByTestId("prob").textContent).toBe("0.9500 (P(−1.96 < X < 1.96))");
  });
});

describe("z-standardise", () => {
  // μ = 100, σ = 15, x = 130: z = (130 − 100)/15 = 2 and Φ(2) = 0.97725.
  it("x = 130 gives z = 2 and P = 0.97725", () => {
    expect(((130 - 100) / 15)).toBe(2);
    expect(phi(2)).toBeCloseTo(0.97725, 5);
  });
  // Φ⁻¹(0.9) = 1.28155, so x = 100 + 1.28155 × 15 = 119.22.
  it("inverse normal: p = 0.9 gives z = 1.2816 and x = 119.22", () => {
    expect(inverseNormal(0.9)).toBeCloseTo(1.2815515655446004, 10);
    expect(100 + inverseNormal(0.9) * 15).toBeCloseTo(119.2233, 3);
    expect(inverseNormal(0.975)).toBeCloseTo(1.959963984540054, 10);
    expect(inverseNormal(0.5)).toBe(0);
    expect(inverseNormal(0.001)).toBeCloseTo(-3.090232306167813, 9);
  });
  it("Acklam's raw algorithm is within 2e-9 relative error and the round trip is exact", () => {
    for (const [p, z] of [[0.01, -2.3263478740408408], [0.9, 1.2815515655446004], [0.999, 3.090232306167813], [0.975, 1.959963984540054]]) {
      expect(Math.abs((inverseNormalRaw(p) - z) / z)).toBeLessThan(2e-9);
    }
    for (const p of [0.03, 0.2, 0.3, 0.45, 0.7, 0.98]) {
      const z = inverseNormal(p);
      expect(Math.abs((inverseNormalRaw(p) - z) / z)).toBeLessThan(2e-8);
    }
    for (const p of [1e-6, 0.01, 0.1, 0.5, 0.9, 0.99, 1 - 1e-6]) expect(phi(inverseNormal(p))).toBeCloseTo(p, 12);
    expect(inverseNormal(0)).toBe(-Infinity);
  });
  it("reads z and the probability, then the inverse direction", () => {
    render(<ZStandardise alt="alt" />);
    setSlider("x", 130);
    expect(screen.getByTestId("result").textContent).toBe("z = 2.0000, probability = 0.97725 (P(X < 130.00) = P(Z < 2.0000), x = 130.00)");
    fireEvent.change(screen.getByLabelText(/Start from/), { target: { value: "p" } });
    expect(screen.getByTestId("result").textContent).toBe("z = 1.2816, probability = 0.90000 (P(X < 119.22) = P(Z < 1.2816), x = 119.22)");
  });
});

describe("regression-two-lines", () => {
  // x̄ = 15/5 = 3, ȳ = 20/5 = 4, Sxx = 4 + 1 + 0 + 1 + 4 = 10, Syy = 4 + 1 + 1 + 0 + 4 = 10,
  // Sxy = (−2)(−2) + (−1)(−1) + 0·1 + 1·0 + 2·2 = 9. So m = 0.9, c = 4 − 2.7 = 1.3, d = 0.9, c₂ = 3 − 3.6 = −0.6, r = 0.9.
  it("the fixed data give x̄ = 3, ȳ = 4, Sxx = Syy = 10, Sxy = 9", () => {
    const s = regression([...FIXED_POINTS, DRAG_START]);
    expect([s.xbar, s.ybar, s.sxx, s.syy, s.sxy]).toEqual([3, 4, 10, 10, 9]);
    expect(s.m).toBeCloseTo(0.9, 12);
    expect(s.c).toBeCloseTo(1.3, 12);
    expect(s.d).toBeCloseTo(0.9, 12);
    expect(s.c2).toBeCloseTo(-0.6, 12);
    expect(s.r).toBeCloseTo(0.9, 12);
  });
  // Moving the fifth point to (5, 5): ȳ = 19/5 = 3.8, Sxx = 10, Syy = 3.24 + 0.64 + 1.44 + 0.04 + 1.44 = 6.8,
  // Sxy = (−2)(−1.8) + (−1)(−0.8) + 0 + 1(0.2) + 2(1.2) = 3.6 + 0.8 + 0.2 + 2.4 = 7. Lines meet at (3, 3.8).
  it("moving the point to (5, 5) gives m = 0.7 and d = 7/6.8", () => {
    const s = regression([...FIXED_POINTS, { x: 5, y: 5 }]);
    expect(s.sxy).toBeCloseTo(7, 12);
    expect(s.syy).toBeCloseTo(6.8, 12);
    expect(s.m).toBeCloseTo(0.7, 12);
    expect(s.m * s.xbar + s.c).toBeCloseTo(s.ybar, 12);
    expect(s.c2 + s.d * s.ybar).toBeCloseTo(s.xbar, 12);
    expect(s.r * s.r).toBeCloseTo(s.m * s.d, 12); // r² = m·d
  });
  it("shows r and both equations, and the sliders move the point", () => {
    render(<RegressionTwoLines alt="alt" />);
    expect(screen.getByTestId("result").textContent).toBe("0.900 (y on x: y = 0.9x + 1.3; x on y: x = 0.9y − 0.6)");
    expect(screen.getByTestId("mean").textContent).toBe("3.00, 4.00");
    setSlider(/^y of/, 5);
    expect(screen.getByTestId("yx").textContent).toBe("y = 0.7x + 1.7"); // c = 3.8 − 2.1
    expect(screen.getByTestId("mean").textContent).toBe("3.00, 3.80");
  });
  it("dragging the ringed point sets it from the pointer on the outer svg's scale", () => {
    const { container } = render(<RegressionTwoLines alt="alt" />);
    const outer = container.querySelector('svg[role="img"]') as unknown as SVGSVGElement;
    outer.getScreenCTM = () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;
    const dot = container.querySelector("circle[style*='grab']") as SVGCircleElement;
    dot.setPointerCapture = vi.fn();
    dot.hasPointerCapture = () => true;
    // x = 3 is at user x = 28 + 3/7 · 322 = 166; y = 2 is at user y = 10 + (7 − 2)/7 · 232 = 175.7.
    act(() => {
      dot.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 166, clientY: 175.7 }));
    });
    expect(readout(/^x of/)).toBe("3.0");
    expect(readout(/^y of/)).toBe("2.0");
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
    ["radian-arc", <RadianArc key="r" alt="a" />],
    ["secant-to-tangent", <SecantToTangent key="s" alt="a" />],
    ["derivative-sign", <DerivativeSign key="ds" alt="a" />],
    ["riemann-sums", <RiemannSums key="rs" alt="a" />],
    ["area-between-curves", <AreaBetweenCurves key="ab" alt="a" />],
    ["revolution-slice", <RevolutionSlice key="rv" alt="a" />],
    ["binomial-shaded", <BinomialShaded key="bs" alt="a" />],
    ["normal-shaded", <NormalShaded key="ns" alt="a" />],
    ["z-standardise", <ZStandardise key="zs" alt="a" />],
    ["regression-two-lines", <RegressionTwoLines key="rl" alt="a" />],
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
