"""SymPy assertions for lesson 5.4 (tangents and normals). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built from the question's own curve and point: the tangent is y - f(a) = f'(a)(x - a) and the normal is
y - f(a) = -(x - a)/f'(a), with f'(a) from sympy.diff. Nothing below types in a final answer.
"""
import sys
from pathlib import Path

from sympy import Abs, Rational, diff, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_rounded_list, check_same_equation, parse_answer, parse_point,
)

x, y, m = symbols("x y m")


def point_and_gradient(f, a):
    return f.subs(x, a), diff(f, x).subs(x, a)


def tangent(f, a):
    """lhs - rhs of the tangent to y = f(x) at x = a."""
    ya, slope = point_and_gradient(f, a)
    return y - ya - slope * (x - a)


def normal(f, a):
    """lhs - rhs of the normal to y = f(x) at x = a; refuses f'(a) = 0 (normal_any covers the vertical case)."""
    ya, slope = point_and_gradient(f, a)
    if slope == 0:
        raise ValueError("horizontal tangent: the normal is vertical")
    return y - ya + (x - a) / slope


def normal_any(f, a):
    """lhs - rhs of the normal at x = a written as (x - a) + f'(a)(y - f(a)) = 0, the line through the point
    perpendicular to the tangent's direction (1, f'(a)). It stays valid when f'(a) = 0: it is then x - a, the vertical line."""
    ya, slope = point_and_gradient(f, a)
    return (x - a) + slope * (y - ya)


def line_y(line, at_x):
    """y on the line (given as lhs - rhs) at x = at_x."""
    (value,) = solve(line.subs(x, at_x), y)
    return value


def line_x_intercept(line):
    (value,) = solve(line.subs(y, 0), x)
    return value


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def point_is(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def gradient_point(f, gradient):
    """The point on y = f(x) where the tangent has the given gradient (exactly one for the curve used)."""
    (a,) = solve(diff(f, x) - gradient, x)
    return [a, f.subs(x, a)]


def perpendicular_gradient(gradient):
    (value,) = solve(gradient * m + 1, m)
    return value


def triangle_area():
    """Triangle PAB: P on the curve, A and B where the tangent and normal at P meet the x-axis."""
    f, a = x**3 - 3 * x**2 + 4, 1
    xa, xb = line_x_intercept(tangent(f, a)), line_x_intercept(normal(f, a))
    return Rational(1, 2) * Abs(xa - xb) * Abs(f.subs(x, a))


def other_intersections(f, a):
    """x-coordinates where the normal at x = a meets y = f(x) again, excluding x = a itself."""
    curve_minus_normal = f - line_y(normal(f, a), x)
    return [r for r in solve(curve_minus_normal, x) if simplify(r - a) != 0]


F_GDC_TANGENT = 10 / (1 + x**2)
F_GDC_NORMAL = Rational(1, 2) * x**3 - x**2 + 2
F_GDC_CHECK = 12 / (x**2 + 2)

CHECKS = {
    "before-power-rule": lambda tex: same(tex, diff(x**3 - 4 / x, x)),
    "before-line-point-gradient": lambda tex: check_same_equation(tex, y - (-1) - 3 * (x - 2)),
    "before-perpendicular": lambda tex: same(tex, perpendicular_gradient(3)),
    "ex-tangent-quadratic": lambda tex: check_same_equation(tex, tangent(x**2 - 3 * x + 1, 4)),
    "ex-tangent-integer-form": lambda tex: check_same_equation(tex, tangent(2 * x**3 - 8 / x, 2)),
    "check-tangent-cubic": lambda tex: check_same_equation(tex, tangent(x**3 - 4 * x, 1)),
    "check-gradient-point": lambda tex: point_is(tex, gradient_point(x**2 - 6 * x + 1, 4)),
    "ex-normal-quadratic": lambda tex: check_same_equation(tex, normal(x**2 - 4 * x + 5, 3)),
    "ex-normal-triangle": lambda tex: same(tex, triangle_area()),
    "check-normal-vertical": lambda tex: check_same_equation(tex, normal_any(x**2 - 6 * x + 11, 3)),
    "check-normal-equation": lambda tex: check_same_equation(tex, normal(x**2 + 2 * x - 3, 1)),
    "check-normal-intercept": lambda v, tolerance: check_numeric(v, line_y(normal(x**3, 2), 0), sf=3, tolerance=tolerance),
    "ex-gdc-tangent-crossing": lambda tex: check_rounded(tex, line_x_intercept(tangent(F_GDC_TANGENT, Rational(3, 2))), sf=3),
    "ex-gdc-normal-meets-again": lambda tex: check_rounded_list(tex, other_intersections(F_GDC_NORMAL, 1), sf=3),
    "check-gdc-intercept": lambda v, tolerance: check_numeric(v, line_y(tangent(F_GDC_CHECK, 1), 0), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the prompts say "to 3 s.f.".
NUMERIC = {"check-normal-intercept": {"sf": 3}, "check-gdc-intercept": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
