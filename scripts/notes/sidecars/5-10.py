"""SymPy assertions for lesson 5.10 (indefinite integration and substitution). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import re
import sys
from pathlib import Path

from sympy import Eq, Rational, Symbol, cos, diff, exp, integrate, ln, simplify, sin, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_antiderivative, check_numeric, check_rounded, check_same_equation, parse_answer  # noqa: E402

x = symbols("x")
C = symbols("C")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def derivative_is(tex, function):
    same(tex, diff(function, x))


def antiderivative(tex, integrand, samples=None):
    """An indefinite integral: must end with + C (the lesson teaches that dropping it is wrong), and differentiate back
    to the integrand at sample points (check_antiderivative handles ln|.|)."""
    if not re.search(r"\+\s*C\s*\$?\s*$", tex):
        raise AssertionError(f"{tex!r} has no + C")
    check_antiderivative(tex, integrand, samples=samples)


def curve_through(derivative, x0, y0):
    """SymPy's own antiderivative of `derivative` plus C, with C solved from the point (x0, y0), not typed in."""
    family = integrate(derivative, x) + C
    (constant,) = solve(Eq(family.subs(x, x0), y0), C)
    curve = family.subs(C, constant)
    assert simplify(diff(curve, x) - derivative) == 0
    assert simplify(curve.subs(x, x0) - y0) == 0
    return curve, constant


def f_at_5():
    """ex-linear-gdc: f'(x) = 3/x + e^(0.5x) for x > 0, f(2) = 4. Truth f(5) from SymPy's antiderivative and C."""
    curve, _ = curve_through(3 / x + exp(Rational(1, 2) * x), 2, 4)
    value = curve.subs(x, 5)
    # Independent check: f(5) = f(2) + definite integral of f' from 2 to 5.
    assert abs(float(value) - float(4 + integrate(3 / x + exp(Rational(1, 2) * x), (x, 2, 5)))) < 1e-12
    return value


# check_antiderivative samples x on both sides of 0 and skips points where either side is not real (sqrt, x^(2/3)).
CHECKS = {
    # Before you start (5.5, 5.6)
    "before-power-integral": lambda tex: antiderivative(tex, 3 * x**2 - 4 / x**3),
    "before-chain-sin": lambda tex: derivative_is(tex, sin(4 * x)),
    "before-derivative-ln": lambda tex: derivative_is(tex, ln(5 * x)),
    # Five standard integrals
    "ex-standard-plain": lambda tex: antiderivative(tex, 4 * sqrt(x) + 3 / x - 2 * cos(x)),
    "check-integrate-root": lambda tex: antiderivative(tex, 5 * x ** Rational(2, 3)),
    "check-integrate-trig": lambda tex: antiderivative(tex, 4 * sin(x) - 2 / x),
    "ex-curve-standard": lambda tex: check_same_equation(tex, Symbol("y") - curve_through(2 * exp(x) - 3 * sin(x), 0, 8)[0]),
    "check-constant-exp": lambda v, tolerance: check_numeric(v, curve_through(6 * exp(x) - 4 * cos(x), 0, 10)[1], sf=3, tolerance=tolerance),
    # A linear expression inside
    "ex-linear-cos": lambda tex: antiderivative(tex, cos(4 * x - 1)),
    "check-linear-sin-third": lambda tex: antiderivative(tex, sin(x / 3)),
    "ex-linear-mixed": lambda tex: antiderivative(tex, 6 / sqrt(3 * x + 2) - 4 * exp(-2 * x)),
    "check-linear-reciprocal": lambda tex: antiderivative(tex, 1 / (4 * x + 3)),
    "ex-linear-gdc": lambda tex: check_rounded(tex, f_at_5(), sf=3),
    # Reversing the chain rule
    "ex-inspect-power": lambda tex: antiderivative(tex, x * (x**2 - 3) ** 4),
    "check-inspect-trig": lambda tex: antiderivative(tex, 6 * x * sin(x**2)),
    "ex-inspect-log": lambda tex: antiderivative(tex, sin(x) / cos(x)),
    "check-inspect-log": lambda tex: antiderivative(tex, 6 * x**2 / (x**3 + 5)),
    # Integration by substitution
    "ex-sub-root": lambda tex: antiderivative(tex, 3 * x**2 * sqrt(x**3 + 2)),
    "ex-sub-exam": lambda tex: antiderivative(tex, cos(x) / (2 + sin(x)) ** 3),
    "check-sub-root": lambda tex: antiderivative(tex, x / sqrt(x**2 + 9)),
    "check-sub-trig-power": lambda tex: antiderivative(tex, sin(x) * cos(x) ** 4),
}

NUMERIC = {"check-constant-exp": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
