"""SymPy assertions for lesson 2.1 (straight-line equations). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built from the question's own points, lines or measurements: gradients from (y2 - y1)/(x2 - x1), lines
as lhs - rhs through a point with a gradient, perpendicular gradients by solving m1 * m2 = -1, intercepts and
intersections with sympy.solve. Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, S, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_equation, parse_answer,
)

x, y, k, m = symbols("x y k m")


def gradient(p, q):
    return (S(q[1]) - S(p[1])) / (S(q[0]) - S(p[0]))


def line_through(point, slope):
    """lhs - rhs of the line through `point` with gradient `slope`."""
    return y - S(point[1]) - slope * (x - S(point[0]))


def gradient_of(line):
    """Gradient of a non-vertical line given as lhs - rhs, from dy/dx = -(d/dx)/(d/dy)."""
    return simplify(-line.diff(x) / line.diff(y))


def perpendicular(slope):
    (value,) = solve(slope * m + 1, m)
    return value


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def word_is(text, truth):
    if text.strip() != truth:
        raise AssertionError(f"published {text!r}, truth {truth!r}")


def rounded_named(tex, truths, sf=3):
    """`x \\approx 4.53, \\; y \\approx 5.12`: each named piece must be its own truth rounded to `sf` figures."""
    pieces = [piece.strip() for piece in re.split(r",\s*\\;", tex.strip().strip("$"))]
    if len(pieces) != len(truths):
        raise AssertionError(f"{tex!r} has {len(pieces)} value(s), {len(truths)} expected")
    for piece, (name, truth) in zip(pieces, truths.items()):
        if not piece.startswith(f"{name} "):
            raise AssertionError(f"{piece!r} should give {name}")
        check_rounded(f"${piece}$", truth, sf=sf)


# --- before ---------------------------------------------------------------------------------------------------------
def before_substitute(tex):
    a = symbols("a")
    (truth,) = solve(3 * a - 7 - 5, a)
    same(tex, truth)


# --- gradient section -------------------------------------------------------------------------------------------------
def gradient_find_k(tex):
    (truth,) = solve((14 - k) - 3 * (k - 2), k)
    # P(2, k) and Q(k, 14) must be distinct x-values for the gradient to exist.
    assert truth != 2
    assert gradient((2, truth), (truth, 14)) == 3
    same(tex, truth)


def vertical_line(tex):
    p, q = (3, -1), (3, 6)
    assert p[0] == q[0]  # no run: the line is vertical, x = constant
    check_same_equation(tex, x - p[0])


# --- forms section ----------------------------------------------------------------------------------------------------
def intercepts_area(tex):
    line = 3 * x + 4 * y - 24
    (ax,) = solve(line.subs(y, 0), x)
    (by,) = solve(line.subs(x, 0), y)
    same(tex, Rational(1, 2) * ax * by)


def x_intercept(value, tolerance):
    (truth,) = solve((2 * x + 5 * y - 7).subs(y, 0), x)
    check_numeric(value, truth, sf=3, tolerance=tolerance)


# --- parallel / perpendicular -------------------------------------------------------------------------------------------
def parallel_through_point(tex):
    slope = gradient_of(4 * x + 2 * y - 3)
    check_same_equation(tex, line_through((3, 1), slope))


def perpendicular_bisector(tex):
    a, b = (-1, 2), (5, 6)
    mid = (Rational(a[0] + b[0], 2), Rational(a[1] + b[1], 2))
    check_same_equation(tex, line_through(mid, perpendicular(gradient(a, b))))


def foot_of_perpendicular(tex):
    l1 = y - (Rational(6, 10) * x + Rational(24, 10))
    l2 = line_through((7, 1), perpendicular(gradient_of(l1)))
    sol = solve([l1, l2], [x, y], dict=True)[0]
    rounded_named(tex, {"x": sol[x], "y": sol[y]})


def parallel_or_perpendicular(text):
    m1 = gradient_of(3 * x - 6 * y + 2)
    m2 = gradient_of(y - (-2 * x + 1))
    truth = "Parallel" if m1 == m2 else ("Perpendicular" if m1 * m2 == -1 else "Neither")
    word_is(text, truth)


# --- real gradients ---------------------------------------------------------------------------------------------------
def road_along_surface(tex):
    rise, slope_length = 84, 1200  # 1.2 km in metres, measured along the road
    run = sqrt(slope_length**2 - rise**2)
    check_rounded(tex, rise / run, sf=3)


def road_sign_rise(value, tolerance):
    check_numeric(value, Rational(12, 100) * 250, sf=3, tolerance=tolerance)


def steeper_ramp(text):
    ma, mb = Rational(6, 10) / Rational(75, 10), Rational(5, 10) / 6
    truth = "Ramp A" if ma > mb else ("Ramp B" if mb > ma else "They are equally steep")
    word_is(text, truth)


CHECKS = {
    "before-substitute-point": before_substitute,
    "before-make-y-subject": lambda tex: check_same_equation(tex, 4 * x - 2 * y - 6),
    "before-negative-fraction": lambda tex: same(tex, gradient((-2, 5), (2, -3))),
    "ex-gradient-two-points": lambda tex: same(tex, gradient((-3, 5), (1, -7))),
    "ex-gradient-find-k": gradient_find_k,
    "check-gradient-two-points": lambda tex: same(tex, gradient((-2, 1), (4, -8))),
    "check-vertical-line": vertical_line,
    "ex-line-point-gradient": lambda tex: check_same_equation(tex, line_through((4, -1), Rational(-3, 2))),
    "ex-line-two-points-general": lambda tex: check_same_equation(tex, line_through((-2, -3), gradient((-2, -3), (4, 1)))),
    "check-general-form": lambda tex: check_same_equation(tex, y - (Rational(-3, 4) * x + 2)),
    "ex-intercepts-triangle": intercepts_area,
    "check-x-intercept": x_intercept,
    "ex-parallel-through-point": parallel_through_point,
    "ex-perpendicular-bisector": perpendicular_bisector,
    "check-perpendicular-gradient": lambda tex: same(tex, perpendicular(gradient_of(2 * x - 5 * y + 1))),
    "ex-foot-of-perpendicular-gdc": foot_of_perpendicular,
    "check-parallel-or-perpendicular": parallel_or_perpendicular,
    "ex-ramp-gradient": lambda tex: same(tex, Rational(45, 100) / Rational(54, 10)),
    "ex-road-along-surface": road_along_surface,
    "check-road-sign-rise": road_sign_rise,
    "check-steeper-ramp": steeper_ramp,
}

NUMERIC = {"check-x-intercept": {"sf": 3}, "check-road-sign-rise": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
