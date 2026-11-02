"""SymPy assertions for lesson 5.11 (definite integrals and areas). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Abs, Integral, Interval, Rational, cos, exp, expand_log, integrate, nsolve, pi, simplify, sin, solve, solveset, sqrt, symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_antiderivative, check_numeric, check_rounded, parse_answer  # noqa: E402

x = symbols("x")
k = symbols("k", real=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(expand_log(published - truth, force=True)) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def antiderivative(tex, integrand):
    """An indefinite integral must end with + C and differentiate back to the integrand."""
    if not re.search(r"\+\s*C\s*\$?\s*$", tex):
        raise AssertionError(f"{tex!r} has no + C")
    check_antiderivative(tex, integrand)


def area_to_axis(f, a, b):
    """Area between y = f(x) and the x-axis on [a, b]: split at every root inside, add the size of each piece."""
    cuts = sorted({a, b, *[r for r in solveset(f, x, Interval(a, b)) if a < r < b]}, key=lambda v: float(v))
    return sum(Abs(integrate(f, (x, lo, hi))) for lo, hi in zip(cuts, cuts[1:]))


def area_between(f, g):
    """Total area enclosed by y = f(x) and y = g(x): split at every real meeting point, add the size of each piece."""
    meets = sorted([r for r in solve(f - g, x) if r.is_real], key=lambda v: float(v))
    assert len(meets) >= 2
    return sum(Abs(integrate(f - g, (x, lo, hi))) for lo, hi in zip(meets, meets[1:]))


def unknown_upper_limit():
    """k > 1 with integral of 2x - 1 from 1 to k equal to 12, solved from the integral, not typed in."""
    roots = [r for r in solve(integrate(2 * x - 1, (x, 1, k)) - 12, k) if r > 1]
    assert len(roots) == 1
    return roots[0]


def gdc_area():
    """3cos x and x^2 - 2x meet twice (no algebraic solution): find both numerically, then integrate top minus bottom."""
    f, g = 3 * cos(x), x**2 - 2 * x
    lo, hi = nsolve(f - g, x, -0.7, prec=30), nsolve(f - g, x, 1.7, prec=30)
    # Exactly two meeting points: f - g is positive at 0 and negative well outside them, and its sign changes only there.
    assert (f - g).subs(x, 0) > 0 and (f - g).subs(x, -2) < 0 and (f - g).subs(x, 3) < 0
    return Integral(f - g, (x, lo, hi)).evalf(30)


CHECKS = {
    # Before you start (5.10, 5.5)
    "before-integrate-reciprocal": lambda tex: antiderivative(tex, 6 / (3 * x - 1)),
    "before-integrate-sin": lambda tex: antiderivative(tex, 4 * sin(2 * x)),
    "before-area-gdc": lambda v, tolerance: check_numeric(v, integrate(1 + x**3, (x, 0, Rational(3, 2))), sf=3, tolerance=tolerance),
    # Definite integrals by hand
    "ex-definite-poly": lambda tex: same(tex, integrate(4 * x**3 - 6 * x + 1, (x, 1, 3))),
    "ex-definite-ln": lambda tex: same(tex, integrate(6 / (2 * x + 1), (x, 1, 4))),
    "check-definite-trig": lambda tex: same(tex, integrate(sin(x) + x, (x, 0, pi))),
    "check-unknown-limit": lambda v, tolerance: check_numeric(v, unknown_upper_limit(), sf=3, tolerance=tolerance),
    # No elementary antiderivative: evaluate numerically to 30 digits.
    "ex-definite-gdc": lambda tex: check_rounded(tex, Integral(exp(-x**2), (x, 0, Rational(6, 5))).evalf(30), sf=3),
    # Area when the curve goes below the x-axis
    "ex-area-below": lambda tex: same(tex, area_to_axis(x**2 - 6 * x + 5, 1, 5)),
    "ex-area-split": lambda tex: same(tex, area_to_axis(x**3 - x**2 - 2 * x, -1, 2)),
    "check-area-cos": lambda tex: same(tex, area_to_axis(2 * cos(x), 0, 3 * pi / 2)),
    "check-area-split": lambda v, tolerance: check_numeric(v, area_to_axis(x**2 - 4, 0, 3), sf=3, tolerance=tolerance),
    # Area between two curves
    "ex-between-line": lambda tex: same(tex, area_between(x + 4, x**2 - 2 * x)),
    "check-between-root": lambda v, tolerance: check_numeric(v, area_between(sqrt(x), x / 2), sf=3, tolerance=tolerance),
    "check-between-split": lambda tex: same(tex, area_between(4 * x, x**3)),
    "ex-between-gdc": lambda tex: check_rounded(tex, gdc_area(), sf=3),
}

NUMERIC = {
    "before-area-gdc": {"sf": 3},
    "check-unknown-limit": {"sf": 3},
    "check-area-split": {"sf": 3},
    "check-between-root": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
