"""SymPy assertions for lesson 3.7 (Circular functions, graphs and transformations). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed from each question's own data, not from the rules the lesson teaches: periods come from SymPy's
periodicity(), maxima and minima from minimum()/maximum() over a whole period, asymptotes and special points from
solveset() on the stated domain, and transformed graphs by substituting into sin x step by step.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Interval, Rational, cos, nsimplify, pi, simplify, sin, solve, solveset, symbols,
)
from sympy.calculus.util import maximum, minimum, periodicity

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded_list, check_same_equation, check_same_set, parse_answer,
    parse_degrees, parse_equation, parse_list, parse_point,
)

x, y, t, h = symbols("x y t h")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published} is not {truth}")


def same_values(published, truth):
    published = sorted(published, key=float)
    truth = sorted(truth, key=float)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


# --- before --------------------------------------------------------------------------------------------------------

def horizontal_stretch_point(tex):
    """(6, 5) on y = f(x). On y = f(2x) the same height 5 occurs where the input 2x equals 6."""
    (x_new,) = solve(2 * x - 6, x)
    same_point(tex, (x_new, 5))


# --- graphs --------------------------------------------------------------------------------------------------------

def cos_minima(tex):
    """Minimum points of cos x on [-2pi, 2pi]: where cos x takes its least value on that interval."""
    domain = Interval(-2 * pi, 2 * pi)
    least = minimum(cos(x), x, domain)
    same_values(parse_list(tex), list(solveset(cos(x) - least, x, domain)))


def tan_asymptotes_degrees(tex):
    """tan x (x in degrees) has no value where cos x = 0, for 0 <= x <= 360."""
    truth = list(solveset(cos(x * pi / 180), x, Interval(0, 360)))
    pieces = re.split(r"\\text\{\s*or\s*\}", tex.strip().strip("$"))
    if len(pieces) < 2:
        raise ValueError(f"expected several asymptotes in {tex!r}")
    published = []
    for piece in pieces:
        if not re.match(r"\s*x\s*=", piece):
            raise ValueError(f"each asymptote must be an equation x = ... in {tex!r}")
        published.append(parse_degrees(f"${piece}$"))
    same_values(published, truth)


def sin_solutions(value, tolerance):
    """Number of solutions of sin x = 0.3 on [0, 4pi]."""
    roots = solveset(sin(x) - Rational(3, 10), x, Interval(0, 4 * pi))
    check_numeric(value, len(list(roots)), dp=0, tolerance=tolerance)


def cos_range(tex):
    domain = Interval(0, pi / 2)
    truth = Interval(minimum(cos(x), x, domain), maximum(cos(x), x, domain))
    check_same_set(tex, truth, var="y")


# --- parameters ----------------------------------------------------------------------------------------------------

def read_parameters(tex):
    f = 2 * sin(3 * (x + pi / 4)) + 5
    p = periodicity(f, x)
    one_period = Interval(0, p)
    amplitude = (maximum(f, x, one_period) - minimum(f, x, one_period)) / 2
    check_assignments(tex, {"A": amplitude, "p": p})


def parameters_from_graph(tex):
    """y = a cos(bx) + d, a, b > 0, maximum (0, 9), next minimum (pi/3, 1). The first stationary point after 0 is at
    b x = pi, so take the smallest b > 0 that makes x = pi/3 stationary, then solve the two point conditions."""
    a, b, d = symbols("a b d", positive=True)
    curve = a * cos(b * x) + d
    candidates = solveset(sin(b * pi / 3), b, Interval.open(0, 50))
    b_value = min(candidates, key=float)
    fitted = curve.subs(b, b_value)
    (sol,) = solve([fitted.subs(x, 0) - 9, fitted.subs(x, pi / 3) - 1], [a, d], dict=True)
    if not sol[a] > 0:
        raise AssertionError("model needs a > 0")
    second = fitted.subs(sol).diff(x, 2).subs(x, pi / 3)
    if not second > 0:
        raise AssertionError("(pi/3, 1) should be a minimum")
    check_assignments(tex, {"a": sol[a], "b": b_value, "d": sol[d]})


def period_degrees(tex):
    g = 5 * sin(4 * x * pi / 180) - 1  # x in degrees
    published = parse_degrees(tex)
    truth = periodicity(g, x)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} degrees is not {truth}")


def minimum_value(value, tolerance):
    hx = 7 - 3 * cos(pi * x / 2)
    p = periodicity(hx, x)
    check_numeric(value, minimum(hx, x, Interval(0, p)), dp=0, tolerance=tolerance)


# --- transformations -----------------------------------------------------------------------------------------------

def build_equation(tex):
    stretched_up = 4 * sin(x)
    stretched_across = stretched_up.subs(x, 3 * x)
    moved = stretched_across.subs(x, x + pi / 6)
    check_same_equation(tex, y - moved)


def describe_and_max(tex):
    """First maximum point of g with x > 0, found from g itself over one period after 0."""
    g = 3 * cos(2 * (x + pi / 6)) - 1
    p = periodicity(g, x)
    window = Interval.Lopen(0, p)
    top = maximum(g, x, window)
    first = min(solveset(g - top, x, window), key=float)
    same_point(tex, (first, top))


def image_equation(tex):
    stretched = sin(x).subs(x, 2 * x)
    moved = stretched.subs(x, x - pi / 3)
    check_same_equation(tex, y - moved)


def tan_shift_asymptote(tex):
    roots = list(solveset(cos(x + pi / 3), x, Interval.open(0, pi)))
    if len(roots) != 1:
        raise AssertionError(f"expected one asymptote, found {roots}")
    check_same_equation(tex, x - roots[0])


# --- models --------------------------------------------------------------------------------------------------------

def model_daylight(tex):
    """D = a cos(b(t - c)) + d: max 16 on day 170, min 8, period 365, a, b > 0, 0 <= c < 365."""
    a, b, d = symbols("a b d", positive=True)
    c = symbols("c")
    # cos ranges over [-1, 1], so the model's extremes are d + a and d - a.
    top, bottom = maximum(cos(x), x, Interval(0, 2 * pi)), minimum(cos(x), x, Interval(0, 2 * pi))
    (sol,) = solve([a * top + d - 16, a * bottom + d - 8], [a, d], dict=True)
    (b_value,) = solve(periodicity(cos(b * t), t) - 365, b)
    model = sol[a] * cos(b_value * (t - c)) + sol[d]
    c_values = solveset(model.subs(t, 170) - 16, c, Interval.Ropen(0, 365))
    c_list = list(c_values)
    if len(c_list) != 1:
        raise AssertionError(f"expected one c in [0, 365[, found {c_values}")
    check_assignments(tex, {"a": sol[a], "b": b_value, "c": c_list[0], "d": sol[d]})


def regression_form(tex):
    """The published equation must be the calculator's curve 4.2 sin(0.26x - 1.3) + 15.6, written another way."""
    truth = y - (Rational(21, 5) * sin(Rational(13, 50) * x - Rational(13, 10)) + Rational(78, 5))
    published = nsimplify(parse_equation(tex), rational=True)
    ratio = simplify(published / truth)
    if ratio.free_symbols or ratio == 0 or not ratio.is_finite:
        raise AssertionError(f"published {published} = 0 is not {truth} = 0")
    if not re.search(r"\\sin\s*\(\s*0\.26\s*\(", tex):
        raise AssertionError(f"{tex!r} is not in the form a sin(b(x + c)) + d")


def greenhouse_times():
    temperature = 6 * sin(pi / 12 * (t - 9)) + 22
    return sorted(solveset(temperature - 26, t, Interval(0, 24)), key=float)


def model_gdc(tex):
    check_rounded_list(tex, greenhouse_times(), sf=3)


def greenhouse_duration(value, tolerance):
    first, second = greenhouse_times()
    check_numeric(value, second - first, sf=3, tolerance=tolerance)


def model_sign(tex):
    """Lowest 30 at t = 0, first highest 50 at t = 0.8. Fit h = d + A cos(bt) from the data."""
    d = (30 + 50) / Rational(2)
    A = 30 - d  # h(0) = d + A cos 0
    b = symbols("b", positive=True)
    candidates = solveset(d + A * cos(b * Rational(4, 5)) - 50, b, Interval.open(0, 50))
    b_value = min(candidates, key=float)
    check_same_equation(tex, h - (d + A * cos(b_value * t)))


def buoy_b(value, tolerance):
    b = symbols("b", positive=True)
    period = Rational(60, 8)
    (b_value,) = solve(periodicity(sin(b * t), t) - period, b)
    check_numeric(value, b_value, sf=3, tolerance=tolerance)


CHECKS = {
    "before-exact-sin": lambda tex: same(tex, sin(5 * pi / 6)),
    "before-exact-cos": lambda tex: same(tex, cos(4 * pi / 3)),
    "before-horizontal-stretch": horizontal_stretch_point,
    "ex-cos-minimum": cos_minima,
    "ex-tan-asymptotes": tan_asymptotes_degrees,
    "check-sin-solutions": sin_solutions,
    "check-cos-range": cos_range,
    "ex-read-parameters": read_parameters,
    "ex-parameters-from-graph": parameters_from_graph,
    "check-period-degrees": period_degrees,
    "check-minimum-value": minimum_value,
    "ex-build-equation": build_equation,
    "ex-describe-and-max": describe_and_max,
    "check-image-equation": image_equation,
    "check-tan-asymptote": tan_shift_asymptote,
    "ex-model-daylight": model_daylight,
    "ex-regression-form": regression_form,
    "ex-model-gdc": model_gdc,
    "check-greenhouse-duration": greenhouse_duration,
    "check-model-sign": model_sign,
    "check-buoy-b": buoy_b,
}

# Counts and the minimum value are exact integers (tolerance 0); the other two are 3 s.f. as their prompts say.
NUMERIC = {
    "check-sin-solutions": {"dp": 0},
    "check-minimum-value": {"dp": 0},
    "check-greenhouse-duration": {"sf": 3},
    "check-buoy-b": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
