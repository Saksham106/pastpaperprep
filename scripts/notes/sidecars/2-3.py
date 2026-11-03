"""SymPy assertions for lesson 2.3 (Graphs of functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed from the question's own data: outputs by substitution, intercepts and meeting points by
solving, a vertex from f'(x) = 0, asymptotes as limits, ranges and intercept counts from the given key points, and the
profit model's zeros and its level-30 crossings by solving.
"""
import sys
from pathlib import Path

from sympy import Interval, Rational, Symbol, diff, limit, oo, simplify, solve, sqrt, symbols
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded_list, check_same_equation, check_same_set, parse_answer, parse_list, parse_point,
)

x, t, a = symbols("x t a")
xr = Symbol("x", real=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def roots_are(tex, expr):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truth = sorted(solve(expr, x), key=lambda r: float(r))
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != 2 or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def on_curve(tex, f):
    """The published point (a, b) must satisfy b = f(a)."""
    px, py = parse_point(tex)
    if simplify(f.subs(x, px) - py) != 0:
        raise AssertionError(f"({px}, {py}) is not on y = {f}: f({px}) = {f.subs(x, px)}")


def unknown_coefficient_intercepts(tex):
    """y = a x^2 + 3x - 2 through (2, 12): solve for a, then the x-intercepts of the resulting curve."""
    curve = a * x**2 + 3 * x - 2
    values = solve(curve.subs(x, 2) - 12, a)
    assert len(values) == 1
    roots_are(tex, curve.subs(a, values[0]))


def quadratic_maximum(tex):
    """y = 6 + x - x^2: the turning point from f'(x) = 0, confirmed a maximum by f'' < 0 and inside [-3, 4]."""
    f = 6 + x - x**2
    crit = solve(diff(f, x), x)
    assert len(crit) == 1 and diff(f, x, 2) < 0 and -3 <= crit[0] <= 4
    same_point(tex, [crit[0], f.subs(x, crit[0])])


def left_end_point(tex):
    f = x**2 - 2 * x - 8
    same_point(tex, [-3, f.subs(x, -3)])


def intercept_count(points):
    """x-intercepts of a continuous graph that is monotonic between consecutive listed key points (the turning points
    and end points, with no other turning points): one crossing on each stretch whose end heights have strictly opposite
    signs, plus each listed point that lies on the axis."""
    heights = [y for _, y in points]
    crossings = sum(1 for p, q in zip(heights, heights[1:]) if p * q < 0)
    return crossings + sum(1 for y in heights if y == 0)


def range_from_points(points):
    """Monotonic between consecutive key points, so the extreme heights are attained at listed points."""
    heights = [y for _, y in points]
    return Interval(min(heights), max(heights))


def horizontal_asymptote(tex, model, var, name):
    level = limit(model, var, oo)
    assert level.is_finite
    check_same_equation(tex, Symbol(name) - level)


PROFIT = 20 * sqrt(x) - 2 * x - 10  # P(x) = R(x) - C(x), 0 <= x <= 100


def largest_x_with_profit_at_least(level):
    """P(x) >= level holds between the two solutions of P(x) = level (P rises then falls on [0, 100]); the largest such x
    is the larger solution. Check P really is below the level just beyond it, and that it lies inside the domain."""
    xs = [r for r in solve(PROFIT - level, x) if 0 <= r <= 100]
    assert len(xs) == 2, xs
    top = max(xs, key=lambda r: float(r))
    assert PROFIT.subs(x, top + Rational(1, 100)) < level and PROFIT.subs(x, top - Rational(1, 100)) > level
    return top


INFO_POINTS = [(-1, -3), (1, 4), (4, -2), (6, 0)]
RANGE_POINTS = [(0, 2), (2, -1), (5, 3)]

CHECKS = {
    "before-evaluate": lambda tex: same(tex, (7 - x**2).subs(x, -3)),
    "before-domain": lambda tex: check_same_set(
        tex, solve_univariate_inequality(xr - 5 >= 0, xr, relational=False)),
    "ex-point-on-graph": lambda tex: same(tex, (x**3 - 3 * x + 5).subs(x, -2)),
    "check-point-on-curve": lambda tex: on_curve(tex, 5 - 2 * x**2),
    "ex-unknown-coefficient": unknown_coefficient_intercepts,
    "check-y-intercept": lambda v, tolerance: check_numeric(
        v, ((x - 4) * (2 * x + 3)).subs(x, 0), sf=3, tolerance=tolerance),
    "ex-draw-table": lambda tex: same(tex, (Rational(1, 2) * x**3 - 2 * x).subs(x, 3)),
    "ex-sketch-quadratic": quadratic_maximum,
    "check-end-point": left_end_point,
    "ex-info-sketch": lambda tex: same(tex, intercept_count(INFO_POINTS)),
    "check-range-from-facts": lambda tex: check_same_set(tex, range_from_points(RANGE_POINTS), var="y"),
    "ex-cooling-context": lambda tex: horizontal_asymptote(tex, 20 + 140 / (t + 2), t, "T"),
    "check-asymptote-model": lambda tex: horizontal_asymptote(tex, 5 * t / (t + 2), t, "C"),
    "ex-difference-zeros": lambda tex: roots_are(tex, (x**2 + 1) - (2 * x + 4)),
    "check-difference-value": lambda tex: same(tex, (3 * x - 1 - x**2).subs(x, 2)),
    "ex-profit-gdc": lambda tex: check_rounded_list(tex, solve(PROFIT, x), sf=3),
    "check-profit-30": lambda v, tolerance: check_numeric(
        v, largest_x_with_profit_at_least(30), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-y-intercept": {"sf": 3}, "check-profit-30": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
