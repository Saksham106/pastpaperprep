"""SymPy assertions for lesson 5.15 (extended differentiation and integration). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

The lesson writes cosec in IB notation, \\operatorname{cosec}. SymPy's LaTeX parser reads that as a product of letters
without complaint, so `read` rewrites it to \\csc (the same function) before parsing. Nothing else is changed.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Eq, Symbol, acos, asin, atan, cos, cot, csc, diff, expand_log, integrate, log, pi, sec, simplify, sin, solve,
    sqrt, symbols, tan,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_antiderivative, check_numeric, check_rounded, check_same_equation, parse_answer  # noqa: E402

x, t = symbols("x t")
C = symbols("C")


def read(tex):
    """IB's \\operatorname{cosec} -> \\csc, so the parser sees the cosecant function rather than letters."""
    return re.sub(r"\\operatorname\{cosec\}", r"\\csc ", tex)


def same(tex, truth):
    published = parse_answer(read(tex))
    difference = expand_log(published - truth, force=True)
    # sec/csc/cot identities (sec^2 = 1 + tan^2 ...) need rewriting in sin and cos before SymPy can see they cancel.
    if simplify(difference) != 0 and simplify(difference.rewrite(sin)) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def derivative_is(tex, function):
    same(tex, diff(function, x))


def gradient_at(tex, function, point):
    same(tex, diff(function, x).subs(x, point))


def antiderivative(tex, integrand, samples=None):
    """An indefinite integral: must end with + C, and differentiate back to the integrand at sample points."""
    if not re.search(r"\+\s*C\s*\$?\s*$", tex):
        raise AssertionError(f"{tex!r} has no + C")
    check_antiderivative(read(tex), integrand, samples=samples)


def tangent_log2():
    """ex-tangent-log2: tangent to y = log_2 x at x = 8, built from SymPy's own value and derivative."""
    f = log(x, 2)
    x1 = 8
    y1 = simplify(f.subs(x, x1))
    m = diff(f, x).subs(x, x1)
    return Symbol("y") - (y1 + m * (x - x1))


def family_member():
    """ex-family-arctan: f' = 6/(9 + x^2) through (3, pi). SymPy integrates and solves for C; nothing typed in."""
    family = integrate(6 / (9 + x**2), x) + C
    (constant,) = solve(Eq(family.subs(x, 3), pi), C)
    curve = family.subs(C, constant)
    assert simplify(diff(curve, x) - 6 / (9 + x**2)) == 0
    assert simplify(curve.subs(x, 3) - pi) == 0
    return curve


def distance_velocity():
    """ex-velocity-gdc: v > 0 on [0, 4] (denominator (t+2)^2 + 4), so distance = definite integral of v."""
    v = 10 / (t**2 + 4 * t + 8)
    assert all(not root.is_real for root in solve(t**2 + 4 * t + 8, t))  # no real roots, so v never changes sign
    return integrate(v, (t, 0, 4))


CHECKS = {
    # Before you start (3.9, 1.11, 5.10)
    "before-sec-identity": lambda tex: same(tex, sec(x) ** 2),
    "before-partial-fractions": lambda tex: same(tex, 4 / ((x - 1) * (x + 3))),
    "before-integrate-linear": lambda tex: antiderivative(tex, cos(5 * x)),
    # Derivatives of tan, sec, cosec and cot
    "ex-diff-tan-cot": lambda tex: derivative_is(tex, 4 * tan(x) - cot(x)),
    "check-diff-sec": lambda tex: derivative_is(tex, sec(5 * x)),
    "ex-cosec-gradient": lambda tex: gradient_at(tex, csc(2 * x), pi / 6),
    "check-diff-xtan": lambda tex: derivative_is(tex, x * tan(x)),
    # Any base
    "ex-diff-a-power": lambda tex: derivative_is(tex, 5 ** (2 * x)),
    "check-diff-log3": lambda tex: derivative_is(tex, log(x**2 + 1, 3)),
    "ex-tangent-log2": lambda tex: check_same_equation(read(tex), tangent_log2()),
    "check-gradient-2x": lambda v, tolerance: check_numeric(v, diff(2**x, x).subs(x, 3), sf=3, tolerance=tolerance),
    # Inverse trig
    "ex-diff-arctan3x": lambda tex: derivative_is(tex, atan(3 * x)),
    "check-diff-arccos4x": lambda tex: derivative_is(tex, acos(4 * x)),
    "ex-arcsin-gradient": lambda tex: gradient_at(tex, asin(x / 2), 1),
    "check-diff-arctan-x2": lambda tex: derivative_is(tex, atan(x**2)),
    # Integrating them back
    "ex-int-cosec2": lambda tex: antiderivative(tex, csc(3 - 2 * x) ** 2),
    "check-int-a-power": lambda tex: antiderivative(tex, 6**x),
    "ex-int-arcsin-linear": lambda tex: antiderivative(tex, 1 / sqrt(25 - 4 * x**2), samples=[-2.2, -1.3, -0.4, 0.5, 1.6, 2.4]),
    "check-int-sec-tan": lambda tex: antiderivative(tex, sec(3 * x) * tan(3 * x)),
    "ex-family-arctan": lambda tex: same(tex, family_member()),
    # Completing the square
    "ex-square-arctan": lambda tex: antiderivative(tex, 1 / (x**2 - 6 * x + 13)),
    "check-square-arctan": lambda tex: antiderivative(tex, 1 / (x**2 + 10 * x + 29)),
    "check-square-arcsin": lambda tex: antiderivative(tex, 1 / sqrt(6 * x - x**2 - 5), samples=[1.2, 1.9, 2.5, 3.3, 4.4]),
    "ex-velocity-gdc": lambda tex: check_rounded(tex, distance_velocity(), sf=3, unit="m"),
    # Partial fractions
    "ex-pf-log": lambda tex: antiderivative(tex, 5 / (x**2 - x - 6)),
    "check-pf-antiderivative": lambda tex: antiderivative(tex, 2 / (x**2 - 1)),
    "ex-pf-definite": lambda tex: same(tex, integrate((3 * x + 5) / ((x + 1) * (x + 3)), (x, 0, 1))),
    "check-pf-numeric": lambda v, tolerance: check_numeric(v, integrate(1 / (x * (x - 1)), (x, 2, 4)), sf=3, tolerance=tolerance),
}

NUMERIC = {"check-gradient-2x": {"sf": 3}, "check-pf-numeric": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
