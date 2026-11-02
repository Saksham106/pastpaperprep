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
import { discriminant, isZeroPolynomial, realRoots } from "./discriminant-math";
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
import ArgandMultiply, { renderArgandSvg } from "./ArgandMultiply";
import RootsOfUnity, { renderRootsSvg } from "./RootsOfUnity";
import VectorAngle, { renderVectorSvg } from "./VectorAngle";
import MaclaurinPartials, { renderMaclaurinSvg } from "./MaclaurinPartials";
import EulerStep, { renderEulerSvg } from "./EulerStep";
import { arg, modulus, multiplyPolar, nthRoots, sumComplex, wrapArg } from "./complex-math";
import { angleDegrees, cosAngle, dot, isPerpendicular, norm } from "./vector-math";
import { fnValue, maclaurinError, partialSum, partialSumLabel } from "./maclaurin-math";
import { eulerPoints, exactY } from "./euler-math";
import { fmt, fmtComplex, num } from "./format";
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
    const { container } = render(<Blocks blocks={blocks} glossary={[]} lessonHref={(item) => `/lesson/${item}`} />);
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
    render(<Blocks blocks={blocks} glossary={[]} lessonHref={(item) => `/lesson/${item}`} />);
    expect(screen.getByText("Mystery")).toBeTruthy();
  });
});

describe("first frame is plain server-rendered SVG", () => {
  it.each(INTERACTIVE_IDS.filter((id) => INTERACTIVES[id]))("Blocks server output for %s has the svg synchronously", (id) => {
    const html = renderToString(<Blocks blocks={[{ type: "interactive", widget: id, props: {}, alt: "Static alt" }]} glossary={[]} lessonHref={(item) => `/lesson/${item}`} />);
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
      renderArgandSvg("alt", { r1: 1.5, d1: 60, r2: 2, d2: 30 }),
      renderRootsSvg("alt", { n: 4, mode: "unity", r: 2, deg: 90 }),
      renderVectorSvg("alt", { a: { x: 3, y: 4 }, b: { x: 4, y: 1 } }),
      renderMaclaurinSvg("alt", { fn: "exp", n: 3, x0: 1 }),
      renderEulerSvg("alt", { h: 0.25 }),
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
    expect(container.querySelectorAll('output[aria-live="polite"]')).toHaveLength(1);
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
  it("a = b = c = 0 has every real number as a root, a = b = 0 with c != 0 has none", () => {
    expect(isZeroPolynomial(0, 0, 0)).toBe(true);
    expect(isZeroPolynomial(0, 0, 1)).toBe(false);
    expect(isZeroPolynomial(0, 1, 0)).toBe(false);
    render(<DiscriminantRoots alt="alt" props={{ a: 0, b: 0, c: 0 }} />);
    expect(screen.getByTestId("roots").textContent).toBe("every real number");
    expect(screen.getByTestId("root-count").textContent).toMatch(/every x satisfies 0 = 0/);
    setSlider("c", 2);
    expect(screen.getByTestId("roots").textContent).toBe("none");
    expect(screen.getByTestId("root-count").textContent).toMatch(/never 0/);
    setSlider("b", 1);
    expect(screen.getByTestId("roots").textContent).toBe("−2.00");
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

describe("exactly one live region per widget", () => {
  it.each(INTERACTIVE_IDS)("%s has one polite result and no output without an explicit aria-live", async (id) => {
    const blocks: Block[] = [{ type: "interactive", widget: id, props: {}, alt: `Alt ${id}` }];
    const { container } = render(<Blocks blocks={blocks} glossary={[]} lessonHref={(item) => `/lesson/${item}`} />);
    await screen.findByRole("img", { name: `Alt ${id}` });
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(container.querySelectorAll("[aria-live]:not(output)")).toHaveLength(0);
    const outputs = [...container.querySelectorAll("output")];
    expect(outputs.length).toBeGreaterThan(1);
    for (const o of outputs) expect(["polite", "off"]).toContain(o.getAttribute("aria-live"));
  });

  it("the Slider readout is aria-live off unless live is set", () => {
    render(<PartsArea alt="a" />);
    expect(slider("b").parentElement!.querySelector("output")!.getAttribute("aria-live")).toBe("off");
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

describe("argand-multiply", () => {
  // z = 1 + i, w = 1 − i: zw = 1 − i + i − i² = 1 + 1 = 2. |z||w| = √2·√2 = 2 and arg z + arg w = π/4 − π/4 = 0.
  it("(1 + i)(1 − i) = 2", () => {
    const m = multiplyPolar(Math.SQRT2, Math.PI / 4, Math.SQRT2, -Math.PI / 4);
    expect(m.z.re).toBeCloseTo(1, 12);
    expect(m.z.im).toBeCloseTo(1, 12);
    expect(m.w.im).toBeCloseTo(-1, 12);
    expect(m.zw.re).toBeCloseTo(2, 12);
    expect(m.zw.im).toBeCloseTo(0, 12);
    expect(m.modulus).toBeCloseTo(2, 12);
    expect(m.arg).toBeCloseTo(0, 12);
  });
  // z = 2cis(π/3), w = 3cis(π/6): zw = 6cis(π/2) = 6(0 + 1i) = 6i.
  it("2cis(π/3) × 3cis(π/6) = 6cis(π/2) = 6i", () => {
    const m = multiplyPolar(2, Math.PI / 3, 3, Math.PI / 6);
    expect(m.modulus).toBe(6);
    expect(m.arg).toBeCloseTo(Math.PI / 2, 12);
    expect(m.zw.re).toBeCloseTo(0, 12);
    expect(m.zw.im).toBeCloseTo(6, 12);
    expect(modulus(m.zw)).toBeCloseTo(6, 12);
    expect(arg(m.zw)).toBeCloseTo(Math.PI / 2, 12);
  });
  // 120° + 90° = 210°, which is −150° once reduced to (−180°, 180°]. 90° + 90° = 180° stays +180° (π, not −π).
  it("reduces the sum of arguments to (−π, π]", () => {
    expect(wrapArg((2 * Math.PI) / 3 + Math.PI / 2)).toBeCloseTo((-5 * Math.PI) / 6, 12);
    expect(wrapArg(Math.PI / 2 + Math.PI / 2)).toBe(Math.PI);
    expect(wrapArg(-Math.PI)).toBe(Math.PI);
    expect(wrapArg(-Math.PI / 2 - Math.PI)).toBeCloseTo(Math.PI / 2, 12);
  });
  it("formats with a real minus and no negative zero", () => {
    expect(fmtComplex(0, 6)).toBe("0.00 + 6.00i");
    expect(fmtComplex(-0.0001, -0.5)).toBe("0.00 − 0.50i");
  });
  // Sliders: z = 1.5cis 60°, w = 2cis 30°: zw = 3cis 90° = 0 + 3i.
  it("shows both forms in the one live result and follows the sliders", () => {
    render(<ArgandMultiply alt="alt" />);
    expect(screen.getByTestId("result").textContent).toBe("3.00 cis 90° = 0.00 + 3.00i");
    expect(screen.getByTestId("z").textContent).toBe("0.75 + 1.30i"); // 1.5(½, √3/2)
    expect(screen.getByTestId("w").textContent).toBe("1.73 + 1.00i"); // 2(√3/2, ½)
    setSlider(/^arg w/, 120); // 60° + 120° = 180°
    expect(readout(/^arg w/)).toBe("120°");
    expect(screen.getByTestId("arg").textContent).toBe("180°");
    expect(screen.getByTestId("result").textContent).toBe("3.00 cis 180° = −3.00 + 0.00i");
    setSlider(/^arg w/, 150); // 210° reduces to −150°
    expect(screen.getByTestId("arg").textContent).toBe("−150°");
    setSlider(/^\|z\|/, 2);
    expect(screen.getByTestId("modulus").textContent).toBe("4.00");
  });
  it("dragging z sets its modulus and argument from the pointer on the outer svg's scale", () => {
    const { container } = render(<ArgandMultiply alt="alt" />);
    const outer = container.querySelector('svg[role="img"]') as unknown as SVGSVGElement;
    outer.getScreenCTM = () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;
    const dot = container.querySelector("circle[style*='grab']") as SVGCircleElement;
    dot.setPointerCapture = vi.fn();
    dot.hasPointerCapture = () => true;
    // Scale is 240/13 user units per unit; centre at (180, 130). The point 1.2 + 1.2i is at user (180 + 1.2s, 130 − 1.2s):
    // modulus 1.2√2 = 1.70, argument 45°.
    const s = 240 / 13;
    act(() => {
      dot.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 180 + 1.2 * s, clientY: 130 - 1.2 * s }));
    });
    expect(readout(/^\|z\|/)).toBe("1.7");
    expect(readout(/^arg z/)).toBe("45°");
  });
});

describe("roots-of-unity", () => {
  it("n = 4 gives 1, i, −1, −i", () => {
    const r = nthRoots(4);
    const want = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    r.forEach((q, k) => {
      expect(q.z.re).toBeCloseTo(want[k][0], 12);
      expect(q.z.im).toBeCloseTo(want[k][1], 12);
    });
  });
  // n = 3: cis(0) = 1, cis(2π/3) = −½ + (√3/2)i, cis(4π/3) = −½ − (√3/2)i. Sum = 1 − ½ − ½ = 0.
  it("n = 3 gives 1 and −½ ± (√3/2)i, and the roots sum to 0", () => {
    const r = nthRoots(3);
    expect(r[1].z.re).toBeCloseTo(-0.5, 12);
    expect(r[1].z.im).toBeCloseTo(Math.sqrt(3) / 2, 12);
    expect(r[2].z.re).toBeCloseTo(-0.5, 12);
    expect(r[2].z.im).toBeCloseTo(-Math.sqrt(3) / 2, 12);
    const sum = sumComplex(r.map((q) => q.z));
    expect(sum.re).toBeCloseTo(0, 12);
    expect(sum.im).toBeCloseTo(0, 12);
    for (let n = 2; n <= 12; n++) expect(modulus(sumComplex(nthRoots(n).map((q) => q.z)))).toBeLessThan(1e-12);
  });
  // z² = 4cis(π): modulus 4^(1/2) = 2, arguments (π + 2πk)/2 = π/2 and 3π/2 ≡ −π/2, so z = ±2i.
  it("z² = 4 cis π has roots 2i and −2i", () => {
    const r = nthRoots(2, 4, Math.PI);
    expect(r[0].modulus).toBeCloseTo(2, 12);
    expect(r[0].z.re).toBeCloseTo(0, 12);
    expect(r[0].z.im).toBeCloseTo(2, 12);
    expect(r[1].z.im).toBeCloseTo(-2, 12);
    expect(r[1].arg).toBeCloseTo(-Math.PI / 2, 12);
  });
  it("lists the roots in the one live result and the n slider updates it", () => {
    render(<RootsOfUnity alt="alt" />);
    expect(screen.getByTestId("result").textContent).toBe("1.00 + 0.00i; 0.00 + 1.00i; −1.00 + 0.00i; 0.00 − 1.00i");
    expect(screen.getByTestId("sum").textContent).toBe("0.00 + 0.00i");
    setSlider("n", 3);
    expect(readout("n")).toBe("3");
    expect(screen.getByTestId("result").textContent).toBe("1.00 + 0.00i; −0.50 + 0.87i; −0.50 − 0.87i");
    expect(screen.getByTestId("step").textContent).toBe("120");
  });
  it("the second mode solves zⁿ = r cis θ", () => {
    render(<RootsOfUnity alt="alt" props={{ mode: "general", n: 2, r: 2.25, theta: 180 }} />);
    expect(screen.getByTestId("result").textContent).toBe("0.00 + 1.50i; 0.00 − 1.50i"); // modulus √2.25 = 1.5
    expect(screen.getByTestId("modulus").textContent).toBe("1.500");
  });
  it("the polygon has one vertex per root", () => {
    const html = renderToStaticMarkup(renderRootsSvg("alt", { n: 5, mode: "unity", r: 2, deg: 90 }));
    expect(html.match(/<circle/g)!.length).toBe(1 + 5); // dashed unit circle and five roots
  });
});

describe("vector-angle", () => {
  // a = (3, 4), b = (4, −3): a·b = 12 − 12 = 0, so θ = 90°.
  it("(3, 4) and (4, −3) are perpendicular", () => {
    const a = { x: 3, y: 4 };
    const b = { x: 4, y: -3 };
    expect(dot(a, b)).toBe(0);
    expect(norm(a)).toBe(5);
    expect(isPerpendicular(a, b)).toBe(true);
    expect(angleDegrees(a, b)).toBeCloseTo(90, 12);
  });
  // a = (1, 0), b = (1, 1): a·b = 1, |a| = 1, |b| = √2, cos θ = 1/√2, θ = 45°.
  it("(1, 0) and (1, 1) meet at 45°", () => {
    const a = { x: 1, y: 0 };
    const b = { x: 1, y: 1 };
    expect(dot(a, b)).toBe(1);
    expect(cosAngle(a, b)).toBeCloseTo(Math.SQRT1_2, 12);
    expect(angleDegrees(a, b)).toBeCloseTo(45, 12);
    expect(isPerpendicular(a, b)).toBe(false);
  });
  it("opposite vectors give 180° and a zero vector gives no angle", () => {
    expect(angleDegrees({ x: 1, y: 2 }, { x: -2, y: -4 })).toBeCloseTo(180, 4);
    expect(angleDegrees({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });
  it("shows a·b and θ in the one live result, and marks perpendicular", () => {
    render(<VectorAngle alt="alt" props={{ a1: 3, a2: 4, b1: 4, b2: -3 }} />);
    expect(screen.getByTestId("result").textContent).toBe("a·b = 0.00, θ = 90.0°, so the vectors are perpendicular");
    setSlider("b₂", 1); // b = (4, 1): a·b = 16, |a||b| = 5√17, cos θ = 0.7761, θ = 39.1°
    expect(readout("b₂")).toBe("1");
    expect(screen.getByTestId("result").textContent).toBe("a·b = 16.00, θ = 39.1°");
    expect(screen.getByTestId("norm-b").textContent).toBe("4.123");
  });
  it("dragging a tip snaps to half units on the outer svg's scale", () => {
    const { container } = render(<VectorAngle alt="alt" />);
    const outer = container.querySelector('svg[role="img"]') as unknown as SVGSVGElement;
    outer.getScreenCTM = () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;
    const dot0 = container.querySelector("circle[style*='grab']") as SVGCircleElement; // a's tip
    dot0.setPointerCapture = vi.fn();
    dot0.hasPointerCapture = () => true;
    const s = 20; // 240 user units over 12 units
    act(() => {
      dot0.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 180 + 2.1 * s, clientY: 130 - 1.4 * s }));
    });
    expect(readout("a₁")).toBe("2");
    expect(readout("a₂")).toBe("1.5");
  });
});

describe("maclaurin-partials", () => {
  // e^x with 3 terms: 1 + x + x²/2 at x = 1 is 2.5. e − 2.5 = 0.2182818…
  it("eˣ with three terms at x = 1 is 2.5, error 0.21828", () => {
    expect(partialSum("exp", 3, 1)).toBe(2.5);
    expect(maclaurinError("exp", 3, 1)).toBeCloseTo(Math.E - 2.5, 12);
    expect(maclaurinError("exp", 3, 1)).toBeCloseTo(0.21828, 5);
  });
  // sin x with 2 terms: x − x³/6 at x = 1 is 5/6 = 0.833333. sin 1 = 0.841471, error 0.008138.
  it("sin x with two terms at x = 1 is 0.83333, error 0.00813", () => {
    expect(partialSum("sin", 2, 1)).toBeCloseTo(5 / 6, 12);
    expect(maclaurinError("sin", 2, 1)).toBeCloseTo(Math.sin(1) - 5 / 6, 12);
    expect(maclaurinError("sin", 2, 1)).toBeCloseTo(0.00814, 5);
  });
  // cos x with 3 terms: 1 − x²/2 + x⁴/24 at x = 1 is 1 − 0.5 + 0.0416667 = 0.5416667.
  it("cos x with three terms at x = 1 is 0.54167", () => {
    expect(partialSum("cos", 3, 1)).toBeCloseTo(13 / 24, 12);
  });
  // ln(1 + x) with 3 terms: x − x²/2 + x³/3 at x = 0.5 is 0.5 − 0.125 + 0.0416667 = 0.4166667; ln 1.5 = 0.405465.
  it("ln(1 + x) with three terms at x = 0.5 is 0.41667", () => {
    expect(partialSum("ln", 3, 0.5)).toBeCloseTo(5 / 12, 12);
    expect(fnValue("ln", 0.5)).toBeCloseTo(Math.log(1.5), 12);
  });
  it("writes the partial sums out", () => {
    expect(partialSumLabel("exp", 3)).toBe("1 + x + x²/2");
    expect(partialSumLabel("sin", 2)).toBe("x − x³/6");
    expect(partialSumLabel("cos", 3)).toBe("1 − x²/2 + x⁴/24");
    expect(partialSumLabel("ln", 3)).toBe("x − x²/2 + x³/3");
  });
  it("shows Pₙ(x₀), f(x₀) and the error in the one live result", () => {
    render(<MaclaurinPartials alt="alt" />);
    expect(screen.getByTestId("result").textContent).toBe("P₃(1) = 2.50000, f(1) = 2.71828, error |f − P₃| = 0.21828");
    setSlider(/^n /, 4); // adds x³/6: 2.66667, error 0.05162
    expect(readout(/^n /)).toBe("4");
    expect(screen.getByTestId("result").textContent).toBe("P₄(1) = 2.66667, f(1) = 2.71828, error |f − P₄| = 0.05162");
    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "sin" } });
    setSlider(/^n /, 2);
    expect(screen.getByTestId("result").textContent).toBe("P₂(1) = 0.83333, f(1) = 0.84147, error |f − P₂| = 0.00814");
  });
  it("ln(1 + x) shows (−1, 1] and warns when x₀ is outside it", () => {
    render(<MaclaurinPartials alt="alt" props={{ fn: "ln", n: 3, x0: 1 }} />);
    expect(screen.getByTestId("convergence").textContent).toBe("−1 < x ≤ 1");
    expect(screen.getByTestId("result").textContent).toBe("P₃(1) = 0.83333, f(1) = 0.69315, error |f − P₃| = 0.14019");
    setSlider("x₀", 2);
    expect(screen.getByText(/x₀ is outside it/)).toBeTruthy();
  });
  it("clamps n and x₀ when the function changes", () => {
    render(<MaclaurinPartials alt="alt" props={{ n: 8, x0: 5 }} />);
    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "ln" } });
    expect(readout("x₀")).toBe("2.0");
    fireEvent.change(screen.getByLabelText("Function"), { target: { value: "sin" } });
    expect(readout(/^n /)).toBe("6");
  });
});

describe("euler-step", () => {
  // h = 0.5: y1 = 1 + 0.5(0 + 1) = 1.5, y2 = 1.5 + 0.5(0.5 + 1.5) = 2.5. Exact y(1) = 2e − 2 = 3.43656.
  it("h = 0.5 gives 1.5 then 2.5", () => {
    const p = eulerPoints(0.5);
    expect(p.map((q) => q.y)).toEqual([1, 1.5, 2.5]);
    expect(p.map((q) => q.x)).toEqual([0, 0.5, 1]);
    expect(exactY(1)).toBeCloseTo(3.43656, 5);
  });
  // h = 0.25: y1 = 1 + 0.25(0 + 1) = 1.25; y2 = 1.25 + 0.25(0.25 + 1.25) = 1.625;
  // y3 = 1.625 + 0.25(0.5 + 1.625) = 2.15625; y4 = 2.15625 + 0.25(0.75 + 2.15625) = 2.8828125.
  it("h = 0.25 gives 1.25, 1.625, 2.15625, 2.8828125", () => {
    expect(eulerPoints(0.25).map((q) => q.y)).toEqual([1, 1.25, 1.625, 2.15625, 2.8828125]);
  });
  it("the exact curve solves the equation and the estimate improves as h shrinks", () => {
    expect(exactY(0)).toBe(1);
    const h = 1e-6;
    expect((exactY(0.5 + h) - exactY(0.5 - h)) / (2 * h)).toBeCloseTo(0.5 + exactY(0.5), 6); // y′ = x + y
    const err = (step: number) => exactY(1) - eulerPoints(step).at(-1)!.y;
    expect(err(0.05)).toBeLessThan(err(0.1));
    expect(err(0.1)).toBeLessThan(err(0.25));
    expect(eulerPoints(0.05)).toHaveLength(21);
  });
  it("shows the estimate against the exact value, and the slider changes h", () => {
    render(<EulerStep alt="alt" />);
    expect(screen.getByTestId("result").textContent).toBe("Euler estimate of y(1) = 2.8828 with h = 0.25, exact y(1) = 2e − 2 = 3.4366, error 0.5538");
    expect(screen.getByTestId("steps").textContent).toBe("4");
    setSlider(/^h /, 5); // the largest step, h = 0.5
    expect(readout(/^h /)).toBe("0.5");
    expect(screen.getByTestId("result").textContent).toBe("Euler estimate of y(1) = 2.5000 with h = 0.5, exact y(1) = 2e − 2 = 3.4366, error 0.9366");
    setSlider(/^h /, 0);
    expect(readout(/^h /)).toBe("0.05");
    expect(screen.getByTestId("steps").textContent).toBe("20");
  });
});
