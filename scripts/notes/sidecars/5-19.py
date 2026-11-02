"""SymPy assertions for lesson 5.19 (Maclaurin series and deriving expansions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed independently: SymPy's own `series` for each function, the total derivative of the differential
equation for the series of its solution, `integrate` / `limit` for the estimates. Nothing is typed in as the answer.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Rational, Symbol, asin, cos, diff, exp, factorial, integrate, limit, log, simplify, sin, sqrt, symbols,
)
from sympy import series as sympy_series

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

x = symbols("x")
Y = Symbol("Y")  # stands for y in a differential equation dy/dx = F(x, Y)

# A published series ends "+ \ldots" or "- \ldots" (the terms go on). Strip only that tail before parsing;
# everything else in the published text is read and compared.
_TAIL = re.compile(r"\s*[+-]\s*\\(?:l|c)?dots\s*\$?\s*$")


def _polynomial(tex):
    return parse_answer(_TAIL.sub("", tex.strip().rstrip("$")) )


def same(published, truth):
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def truncated(f, order):
    """SymPy's Maclaurin series of f with every term up to x**order, nothing higher."""
    return sympy_series(f, x, 0, order + 1).removeO()


def series_is(tex, f, order):
    same(_polynomial(tex), truncated(f, order))


def from_values(tex, values):
    """Series built from given derivative values f(0), f'(0), ...: coefficient f^(n)(0) / n!."""
    same(_polynomial(tex), sum(v / factorial(n) * x**n for n, v in enumerate(values)))


def de_series(rhs, y0, order):
    """Maclaurin polynomial of the solution of dy/dx = rhs(x, Y), y(0) = y0, by total differentiation."""
    derivs = [Y, rhs]
    while len(derivs) <= order:
        d = derivs[-1]
        derivs.append(diff(d, x) + diff(d, Y) * rhs)
    return sum(d.subs({x: 0, Y: y0}) / factorial(n) * x**n for n, d in enumerate(derivs[: order + 1]))


def de_series_is(tex, rhs, y0, order):
    same(_polynomial(tex), de_series(rhs, y0, order))


def after_last_equals(tex, truth):
    """`a \\approx b = c`: read c, the exact value of the estimate, and compare it with the truth."""
    same(parse_answer(tex.split("=")[-1]), truth)


def option_value(tex, truth):
    same(parse_answer(tex), truth)


ROOT_E_ESTIMATE = truncated(exp(x), 3).subs(x, Rational(1, 2))  # first four terms of e^x at x = 1/2
LN_ESTIMATE = truncated(log(1 + x), 3).subs(x, Rational(2, 5))  # first three terms of ln(1+x) at x = 0.4
# first three non-zero terms of e^(-x^3) are 1, x^3, x^6 terms: truncate at x^6, then integrate over [0, 0.5]
EXP_CUBE_ESTIMATE = integrate(truncated(exp(-x**3), 6), (x, 0, Rational(1, 2)))
# first two non-zero terms of ln(1 + x^2) are x^2 and x^4: truncate at x^4, then integrate over [0, 0.4]
LN_SQUARE_ESTIMATE = integrate(truncated(log(1 + x**2), 4), (x, 0, Rational(2, 5)))
DE_NONLINEAR = de_series(exp(x) + Y**2, 0, 3)


CHECKS = {
    "before-chain-rule": lambda tex: option_value(tex, diff(exp(-4 * x), x)),
    "before-third-derivative": lambda tex: option_value(tex, diff(x**5, x, 3)),
    "ex-derive-cos": lambda tex: series_is(tex, cos(x), 4),
    "ex-esinx": lambda tex: series_is(tex, exp(sin(x)), 2),
    "check-build-coefficients": lambda tex: from_values(tex, [2, -1, 6, 12]),
    "ex-binomial-cuberoot": lambda tex: series_is(tex, (1 + x) ** Rational(1, 3), 3),
    "check-binomial-negative": lambda tex: series_is(tex, (1 + x) ** -2, 2),
    "ex-root-e": lambda tex: after_last_equals(tex, ROOT_E_ESTIMATE),
    "check-ln-estimate": lambda v, tolerance: check_numeric(v, LN_ESTIMATE, sf=3, tolerance=tolerance),
    "ex-ln-3x": lambda tex: series_is(tex, log(1 + 3 * x), 3),
    "check-subst-exp": lambda tex: series_is(tex, exp(-3 * x), 3),
    "ex-product-ln": lambda tex: series_is(tex, log(1 + x) / (1 + x), 3),
    "check-product": lambda tex: series_is(tex, sqrt(1 + x) * cos(x), 2),
    "check-limit": lambda v, tolerance: check_numeric(v, limit((log(1 + 2 * x) - 2 * x) / x**2, x, 0), sf=3, tolerance=tolerance),
    "ex-diff-ln": lambda tex: series_is(tex, 1 / (1 + x), 3),
    "check-diff-geometric": lambda tex: series_is(tex, 1 / (1 - x) ** 2, 2),
    "ex-arcsin": lambda tex: series_is(tex, asin(x), 5),
    "ex-integral-estimate": lambda tex: check_rounded(tex, EXP_CUBE_ESTIMATE, sf=5),
    "check-integral-numeric": lambda v, tolerance: check_numeric(v, LN_SQUARE_ESTIMATE, sf=3, tolerance=tolerance),
    "ex-de-linear": lambda tex: de_series_is(tex, Y - x**2, 1, 3),
    "check-de-coefficient": lambda tex: option_value(tex, de_series(x * Y + 2, 1, 2).coeff(x, 2)),
    "ex-de-nonlinear": lambda tex: de_series_is(tex, exp(x) + Y**2, 0, 3),
    "check-de-estimate": lambda v, tolerance: check_numeric(v, DE_NONLINEAR.subs(x, Rational(1, 5)), sf=3, tolerance=tolerance),
}

NUMERIC = {
    "check-ln-estimate": {"sf": 3},
    "check-limit": {"sf": 3},
    "check-integral-numeric": {"sf": 3},
    "check-de-estimate": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
