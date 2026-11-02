"""SymPy assertions for lesson 5.6 (differentiation rules and standard functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed with sympy.diff from the question's own function; stationary points come from solving the
computed derivative. The two GDC answers have no closed form, so their truth is a 50-digit nsolve root of the computed
derivative equation, started inside the interval the question gives (each interval holds exactly one root).
"""
import sys
from pathlib import Path

from sympy import E, Interval, S, cos, diff, exp, log, nsolve, pi, simplify, sin, solveset, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_equation, parse_answer, parse_list, parse_point,
)

x, y = symbols("x y")


def d(f):
    return diff(f, x)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def real_roots(expr, domain=S.Reals):
    roots = solveset(expr, x, domain)
    return sorted(roots, key=lambda r: float(r))


def roots_are(tex, expr):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truth = real_roots(expr)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def stationary_point(f, domain=S.Reals):
    """The single point of y = f(x) where f'(x) = 0 (each curve used has exactly one)."""
    (a,) = real_roots(d(f), domain)
    return [a, f.subs(x, a)]


def point_is(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def tangent(f, a):
    """lhs - rhs of the tangent to y = f(x) at x = a."""
    return y - f.subs(x, a) - d(f).subs(x, a) * (x - a)


def gdc_root(equation, start):
    return nsolve(equation, x, start, prec=50)


F_ROOTS = 6 * x ** S("1/3") + 4 / sqrt(x)
F_TANGENT = 4 * sin(x) - x**2
F_CHAIN_STAT = exp(2 * x) - 6 * x
F_PRODUCT_GDC = x**2 * cos(x)

CHECKS = {
    "before-power-integer": lambda tex: same(tex, d(2 * x**3 - 5 / x**2)),
    "before-composite": lambda tex: same(tex, (x**3).subs(x, 2 * x + 1)),
    "before-exact-values": lambda tex: same(tex, cos(pi / 3) + log(exp(2))),
    "ex-standard-roots": lambda tex: same(tex, d(F_ROOTS)),
    "check-standard-sum": lambda tex: same(tex, d(3 / x + 2 * sqrt(x) - cos(x))),
    "ex-standard-tangent": lambda tex: check_same_equation(tex, tangent(F_TANGENT, pi / 2)),
    "check-standard-constants": lambda tex: same(tex, d(E**2 * x + 3 * exp(x) - log(4))),
    "ex-chain-root": lambda tex: same(tex, d(sqrt(x**2 + 9)).subs(x, 4)),
    "check-chain-linear": lambda tex: same(tex, d((2 * x - 5) ** 4)),
    "ex-chain-mixed": lambda tex: same(tex, d(log(3 * x**2 + 2) - 4 * exp(1 - 2 * x))),
    "check-chain-trig-value": lambda tex: same(tex, d(3 * sin(2 * x) + cos(4 * x)).subs(x, pi / 6)),
    "ex-chain-stationary": lambda tex: point_is(tex, stationary_point(F_CHAIN_STAT)),
    # Gradient of sin(x^2) equal to 1 on [0, 1]: no closed form, so a high-precision root of the computed derivative.
    "check-chain-gdc": lambda v, tolerance: check_numeric(v, gdc_root(d(sin(x**2)) - 1, 0.5), sf=3, tolerance=tolerance),
    "ex-product-basic": lambda tex: same(tex, d(x**3 * log(x))),
    "check-product-basic": lambda tex: same(tex, d(x * exp(x))),
    "ex-product-stationary": lambda tex: roots_are(tex, d(x**2 * exp(-3 * x))),
    "check-product-trig": lambda tex: same(tex, d((2 * x + 1) * sin(x)).subs(x, pi)),
    # Horizontal tangent of x^2 cos x on ]0, 2[: no closed form, so a high-precision root of the computed derivative.
    "ex-product-gdc": lambda tex: check_rounded(tex, gdc_root(d(F_PRODUCT_GDC), 1), sf=3),
    "ex-quotient-basic": lambda tex: same(tex, d(x**2 / (x + 3))),
    "check-quotient-linear": lambda tex: same(tex, d((2 * x - 1) / (x + 4))),
    "ex-quotient-stationary": lambda tex: point_is(tex, stationary_point(log(x) / x, Interval.open(0, S.Infinity))),
    "check-quotient-exp": lambda tex: same(tex, d(exp(2 * x) / (x**2 + 1)).subs(x, 1)),
}

# Required precision of every numeric check; the prompt says "to 3 s.f.".
NUMERIC = {"check-chain-gdc": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
