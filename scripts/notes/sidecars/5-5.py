"""SymPy assertions for lesson 5.5 (antidifferentiation, definite integrals and area). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import re
import sys
from pathlib import Path

from sympy import Eq, Integral, Rational, Symbol, diff, integrate, solve, simplify, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_antiderivative, check_numeric, check_rounded, check_same_equation, parse_answer  # noqa: E402

x = symbols("x")
C = symbols("C")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def antiderivative(tex, integrand):
    """An indefinite integral: must end with + C (the lesson teaches that dropping it is wrong), and differentiate back."""
    if not re.search(r"\+\s*C\s*\$?\s*$", tex):
        raise AssertionError(f"{tex!r} has no + C")
    check_antiderivative(tex, integrand)


def function_is(tex, truth):
    """`f(x) = ...`: the left-hand side must be exactly f(x), and the right-hand side must equal the truth."""
    pieces = tex.strip().strip("$").split("=")
    if len(pieces) != 2:
        raise ValueError(f"{tex!r} must be one equation f(x) = ...")
    if pieces[0].replace(" ", "") != "f(x)":
        raise AssertionError(f"{tex!r} does not give f(x)")
    same(tex, truth)


def derivative_is(tex, function):
    same(tex, diff(function, x))


def curve_through(derivative, x0, y0):
    """The antiderivative of `derivative` (plus C) that takes the value y0 at x0, with C solved for, not typed in."""
    family = integrate(derivative, x) + C
    (constant,) = solve(Eq(family.subs(x, x0), y0), C)
    curve = family.subs(C, constant)
    # Independent checks on the truth itself: right derivative, right value at the point.
    assert simplify(diff(curve, x) - derivative) == 0
    assert simplify(curve.subs(x, x0) - y0) == 0
    return curve, constant


def constant_through(derivative, x0, y0):
    return curve_through(derivative, x0, y0)[1]


def area_between_roots(f):
    """Area under f between its two real x-intercepts; f must be positive strictly between them."""
    roots = sorted(solve(f, x), key=lambda r: float(r))
    assert len(roots) == 2
    middle = (roots[0] + roots[1]) / 2
    assert f.subs(x, middle) > 0
    return integrate(f, (x, roots[0], roots[1]))


def positive_on(f, a, b):
    """f > 0 on [a, b]: positive at both ends and at every interior stationary point."""
    points = [a, b] + [p for p in solve(diff(f, x), x) if p.is_real and a < p < b]
    assert all(f.subs(x, p) > 0 for p in points)
    return f


CHECKS = {
    # Before you start (5.3)
    "before-differentiate-poly": lambda tex: derivative_is(tex, 4 * x**3 - 5 * x + 2),
    "before-differentiate-negative": lambda tex: derivative_is(tex, 3 / x**2),
    # Antidifferentiation
    "ex-integrate-poly": lambda tex: antiderivative(tex, 6 * x**2 - 4 * x + 5),
    "check-integrate-power": lambda tex: antiderivative(tex, 8 * x**3),
    "ex-integrate-negative-power": lambda tex: antiderivative(tex, (2 * x**4 + 3) / x**2),
    "check-integrate-negative": lambda tex: antiderivative(tex, 6 / x**4),
    "check-integrate-brackets": lambda tex: antiderivative(tex, (2 * x + 1) ** 2),
    # Boundary conditions
    "ex-boundary-curve": lambda tex: check_same_equation(tex, Symbol("y") - curve_through(4 * x - 3, 2, 5)[0]),
    "ex-boundary-function": lambda tex: function_is(tex, curve_through(6 * x**2 - 2 / x**2, 1, 7)[0]),
    "check-find-constant": lambda v, tolerance: check_numeric(v, constant_through(6 * x + 2, 2, 12), sf=3, tolerance=tolerance),
    "check-boundary-function": lambda tex: function_is(tex, curve_through(3 * x**2 - 4 * x, 2, 1)[0]),
    # Definite integrals on the GDC
    "ex-definite-poly": lambda tex: check_rounded(tex, integrate(x**3 - 2 * x + 1 / x**2, (x, 1, 3)), sf=3),
    # No elementary antiderivative: evaluate numerically to 30 digits.
    "ex-definite-gdc-only": lambda tex: check_rounded(tex, Integral(sqrt(x**3 + 1), (x, 0, 2)).evalf(30), sf=3),
    "check-definite-value": lambda v, tolerance: check_numeric(v, integrate(x**3 - 3 * x**2 + 5, (x, -1, 2)), sf=3, tolerance=tolerance),
    "check-definite-swapped": lambda tex: check_rounded(tex, integrate(x**2 + 1, (x, 1, 3)), sf=3),
    # Area
    "ex-area-link": lambda tex: same(tex, integrate(positive_on(x**2, Rational(1, 100), 2), (x, 0, 2))),
    "ex-area-enclosed": lambda tex: check_rounded(tex, area_between_roots(3 + 2 * x - x**2 / 2), sf=3),
    "check-area-gdc": lambda v, tolerance: check_numeric(v, integrate(positive_on(x**3 - 2 * x**2 + 4, 0, 2), (x, 0, 2)), sf=3, tolerance=tolerance),
    "check-area-enclosed": lambda tex: same(tex, area_between_roots(4 - x**2)),
}

NUMERIC = {
    "check-find-constant": {"sf": 3},
    "check-definite-value": {"sf": 3},
    "check-area-gdc": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
