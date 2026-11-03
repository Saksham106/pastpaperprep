"""SymPy assertions for lesson 2.11 (Transformations of graphs). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Where a question describes f only by a few features (a turning point, intercepts, an asymptote), the truth is computed
from a concrete function that has exactly those features: the transformed function is built by substitution, and its
turning point or asymptote is found by calculus or by solving, not by applying the point-mapping rules the lesson teaches.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, denom, diff, exp, expand, log, simplify, solve, sqrt, symbols, together

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_equation, parse_answer, parse_point,
)

x, y = symbols("x y")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published} is not {truth}")


def turning_point(g):
    """The single stationary point of g, with its kind from the second derivative."""
    xs = [s for s in solve(diff(g, x), x) if s.is_real]
    if len(xs) != 1:
        raise AssertionError(f"expected one stationary point, found {xs}")
    x0 = xs[0]
    curvature = diff(g, x, 2).subs(x, x0)
    return (x0, simplify(g.subs(x, x0))), ("min" if curvature > 0 else "max")


def vertical_asymptotes(g):
    return solve(denom(together(g)), x)


# --- before --------------------------------------------------------------------------------------------------------

def y_intercept(tex):
    f = (x - 4) ** 2 - 7
    same_point(tex, (0, f.subs(x, 0)))


def composite(tex):
    f = lambda u: u**2  # noqa: E731
    g = x - 3
    same(tex, f(g))


# --- translations --------------------------------------------------------------------------------------------------

def translate_cubic(tex):
    """y = x^3 translated 2 left: replace x by x - (-2)."""
    a = -2
    check_same_equation(tex, y - (x**3).subs(x, x - a))


def translate_exp(tex):
    """e^x translated 2 right, 5 up; the y-intercept of the image."""
    g = exp(x).subs(x, x - 2) + 5
    same(tex, g.subs(x, 0))


def translate_point(tex):
    """(5, -2) on f. On y = f(x + 3) the same height -2 occurs where x + 3 = 5."""
    xs = solve(x + 3 - 5, x)
    same_point(tex, (xs[0], -2))


def translate_asymptote(tex):
    """1/x translated 3 left and 1 up: vertical asymptote where the new denominator vanishes."""
    g = (1 / x).subs(x, x + 3) + 1
    roots = vertical_asymptotes(g)
    if len(roots) != 1:
        raise AssertionError(f"expected one vertical asymptote, found {roots}")
    check_same_equation(tex, x - roots[0])


# --- reflections ---------------------------------------------------------------------------------------------------

def reflect_y_axis(tex):
    f = x**2 - 8 * x + 12
    same(tex, expand(f.subs(x, -x)))


def reflect_turning(tex):
    """A concrete f with a local maximum (3, 7) and y-intercept -2: f = 7 - (x - 3)^2. Reflect in the x-axis."""
    f = 7 - (x - 3) ** 2
    (point, kind_f) = turning_point(f)
    if point != (3, 7) or kind_f != "max" or f.subs(x, 0) != -2:
        raise AssertionError("model function does not match the question")
    image, kind = turning_point(-f)
    if kind != "min":
        raise AssertionError("the image should be a minimum")
    same_point(tex, image)


def reflect_exp(tex):
    check_same_equation(tex, y - (-exp(x)))


def reflect_poly(tex):
    f = 4 * x**3 + x**2 - 7
    same(tex, f.subs(x, -x))


# --- stretches -----------------------------------------------------------------------------------------------------

def stretch_vertical(tex):
    f = x**2 + 2 * x - 8
    g = Rational(1, 3) * f
    image, _ = turning_point(g)
    same_point(tex, image)


def stretch_horizontal(tex):
    """A concrete f with x-intercepts 3, 9 and minimum (6, -3): f = (x - 3)(x - 9)/3. Then y = f(3x)."""
    f = (x - 3) * (x - 9) / 3
    (point, kind_f) = turning_point(f)
    if point != (6, -3) or kind_f != "min" or sorted(solve(f, x)) != [3, 9]:
        raise AssertionError("model function does not match the question")
    image, kind = turning_point(f.subs(x, 3 * x))
    if kind != "min":
        raise AssertionError("the image should be a minimum")
    same_point(tex, image)


def stretch_describe(tex):
    """Word answer for y = f(x/4): the change is inside f, so horizontal; scale factor 1/q with q = d(inner)/dx."""
    inner = x / 4
    q = diff(inner, x)
    truth_direction, truth_factor = "horizontal", 1 / q
    words = re.sub(r"\$[^$]*\$", "", tex).strip().lower()
    maths = re.findall(r"\$([^$]+)\$", tex)
    match = re.fullmatch(r"(horizontal|vertical) stretch with scale factor", words)
    if not match or len(maths) != 1:
        raise ValueError(f"cannot read {tex!r}")
    factor = parse_answer(maths[0])
    if match.group(1) != truth_direction or simplify(factor - truth_factor) != 0:
        raise AssertionError(f"{tex!r} is not a {truth_direction} stretch with scale factor {truth_factor}")


def stretch_asymptote(value, tolerance):
    """A concrete f with vertical asymptote x = 12: f = 1/(x - 12). Then y = f(4x)."""
    roots = vertical_asymptotes((1 / (x - 12)).subs(x, 4 * x))
    if len(roots) != 1:
        raise AssertionError(f"expected one asymptote, found {roots}")
    check_numeric(value, roots[0], dp=0, tolerance=tolerance)


# --- combining -----------------------------------------------------------------------------------------------------

def combine_order(tex):
    """e^x reflected in the x-axis, then translated 4 up; x-intercept of the result."""
    reflected = -exp(x)
    g = reflected + 4
    roots = [r for r in solve(g, x) if r.is_real]
    if len(roots) != 1:
        raise AssertionError(f"expected one x-intercept, found {roots}")
    same(tex, roots[0])


def combine_describe(tex):
    """g(x) = 5 - 2 f(x + 4) with f(1) = 3: the image point has f's argument equal to 1."""
    x_image = solve(x + 4 - 1, x)[0]
    f_at_1 = 3
    y_image = 5 - 2 * f_at_1
    same_point(tex, (x_image, y_image))


def combine_gdc(tex):
    """g(x) = 2 f(x + 3) - 5 with f(x) = x^3 - 5x^2 + 4x + 6: the local maximum of g, found directly from g."""
    f = x**3 - 5 * x**2 + 4 * x + 6
    g = 2 * f.subs(x, x + 3) - 5
    maxima = [s for s in solve(diff(g, x), x) if s.is_real and diff(g, x, 2).subs(x, s) < 0]
    if len(maxima) != 1:
        raise AssertionError(f"expected one local maximum, found {maxima}")
    x0 = maxima[0]
    pieces = [p.strip() for p in re.split(r",\s*\\;", tex.strip().strip("$"))]
    if len(pieces) != 2:
        raise ValueError(f"cannot read {tex!r}")
    names = [re.match(r"([xy])\s*\\approx", p) for p in pieces]
    if not all(names) or [n.group(1) for n in names] != ["x", "y"]:
        raise ValueError(f"expected x \\approx ..., y \\approx ... in {tex!r}")
    check_rounded(f"${pieces[0]}$", x0, sf=3)
    check_rounded(f"${pieces[1]}$", g.subs(x, x0), sf=3)


def combine_reorder(tex):
    """sqrt(x) translated 3 down, then stretched vertically by 2."""
    check_same_equation(tex, y - 2 * (sqrt(x) - 3))


def combine_point(value, tolerance):
    """A concrete f with minimum (-2, 5): f = (x + 2)^2 + 5. The turning point of 3 - 2 f(x - 1)."""
    f = (x + 2) ** 2 + 5
    (point, kind_f) = turning_point(f)
    if point != (-2, 5) or kind_f != "min":
        raise AssertionError("model function does not match the question")
    image, _ = turning_point(3 - 2 * f.subs(x, x - 1))
    check_numeric(value, image[1], dp=0, tolerance=tolerance)


CHECKS = {
    "before-y-intercept": y_intercept,
    "before-composite": composite,
    "ex-translate-cubic": translate_cubic,
    "ex-translate-exp": translate_exp,
    "check-translate-point": translate_point,
    "check-translate-asymptote": translate_asymptote,
    "ex-reflect-y-axis": reflect_y_axis,
    "ex-reflect-turning": reflect_turning,
    "check-reflect-exp": reflect_exp,
    "check-reflect-poly": reflect_poly,
    "ex-stretch-vertical": stretch_vertical,
    "ex-stretch-horizontal": stretch_horizontal,
    "check-stretch-describe": stretch_describe,
    "check-stretch-asymptote": stretch_asymptote,
    "ex-combine-order": combine_order,
    "ex-combine-describe": combine_describe,
    "ex-combine-gdc": combine_gdc,
    "check-combine-order": combine_reorder,
    "check-combine-point": combine_point,
}

# Both numeric checks are exact integers (an asymptote position and a y-coordinate), so tolerance must be 0.
NUMERIC = {
    "check-stretch-asymptote": {"dp": 0},
    "check-combine-point": {"dp": 0},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
