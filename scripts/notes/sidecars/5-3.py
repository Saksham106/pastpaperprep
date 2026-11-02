"""SymPy assertions for lesson 5.3 (differentiation of integer-power polynomials). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import sys
from pathlib import Path

from sympy import Poly, Rational, diff, limit, numer, pi, real_roots, simplify, symbols, together

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

x, r, t, h = symbols("x r t h")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def derivative_is(tex, function, var=x):
    """The published derivative must equal SymPy's derivative of the question's function."""
    same(tex, diff(function, var))


def chord_limit_truth():
    """Gradient of y = x^2 at x = 1 as the limit of chord gradients (the table in the question approaches it)."""
    f = x**2
    return limit((f.subs(x, 1 + h) - f.subs(x, 1)) / h, h, 0)


def gdc_root_truth():
    """The x > 0 where f'(x) = 4 for f(x) = 0.5x^4 - 3x^2 + 2/x: an exact real root of the cleared numerator."""
    f = Rational(1, 2) * x**4 - 3 * x**2 + 2 / x
    equation = numer(together(diff(f, x) - 4))
    roots = [root for root in real_roots(Poly(equation, x)) if root.evalf() > 0]
    assert len(roots) == 1, f"expected one positive root, got {roots}"
    return roots[0]


CHECKS = {
    "before-chord-limit": lambda tex: same(tex, chord_limit_truth()),
    "before-negative-exponent": lambda tex: same(tex, 3 / x**4),
    "ex-power-5x4": lambda tex: derivative_is(tex, 5 * x**4),
    "ex-power-sphere": lambda tex: derivative_is(tex, Rational(4, 3) * pi * r**3, r),
    "check-power-basic": lambda tex: derivative_is(tex, 4 * x**7),
    "check-rate-numeric": lambda v, tolerance: check_numeric(
        v, diff(Rational(49, 10) * t**2, t).subs(t, 3), sf=3, tolerance=tolerance),
    "ex-negative-6x2": lambda tex: derivative_is(tex, 6 / x**2),
    "ex-negative-split-coefficient": lambda tex: derivative_is(tex, 3 / (2 * x**4)),
    "check-negative-power": lambda tex: derivative_is(tex, 5 / x),
    "check-negative-gradient": lambda v, tolerance: check_numeric(
        v, diff(8 / x**2, x).subs(x, 2), sf=3, tolerance=tolerance),
    "ex-sum-cubic": lambda tex: derivative_is(tex, 2 * x**3 - 5 * x**2 + 4 * x - 7),
    "check-sum-poly": lambda tex: derivative_is(tex, x**5 - 4 * x**3 + x - 9),
    "ex-sum-fraction": lambda tex: same(tex, diff((x**4 - 3 * x**2 + 5) / x**2, x).subs(x, -1)),
    "check-rewrite-product": lambda tex: derivative_is(tex, x**2 * (x - 4)),
    "ex-sum-gdc": lambda tex: check_rounded(tex, gdc_root_truth(), sf=3),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-rate-numeric": {"sf": 3}, "check-negative-gradient": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
