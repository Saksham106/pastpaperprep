"""SymPy assertions for lesson 5.16 (integration by substitution and parts). Not shipped to the browser.

verify(id, value) receives the lesson's own published text: an example's `answer` TeX, or a check's option TeX.
check-math.py passes the correct option, which must pass, and every distractor, each of which must raise AssertionError.
"""
import sys
from pathlib import Path

from sympy import Rational, cos, diff, exp, integrate, log, simplify, sin, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_antiderivative, parse_answer  # noqa: E402

x = symbols("x")


def same(a, b):
    if simplify(a - b) != 0:
        raise AssertionError(f"published {a} is not equal to {b}")


def antiderivative_is(tex, integrand):
    """Differentiating the published answer must give the integrand back (checked at sample points)."""
    check_antiderivative(tex, integrand)


def derivative_is(tex, function):
    same(parse_answer(tex), diff(function, x))


def definite_is(tex):
    """The published value must equal the exact integral, which must itself be 116/15."""
    exact = integrate(x * sqrt(x + 1), (x, 0, 3))
    same(exact, Rational(116, 15))
    same(parse_answer(tex), exact)


# id -> assertion on the published answer.
CHECKS = {
    "before-product-rule": lambda tex: derivative_is(tex, x * exp(x)),
    "before-integrate-cos": lambda tex: antiderivative_is(tex, cos(x)),
    "ex-parts-xe2x": lambda tex: antiderivative_is(tex, x * exp(2 * x)),
    "check-integrate-ln": lambda tex: antiderivative_is(tex, log(x)),
    "ex-parts-twice-exsinx": lambda tex: antiderivative_is(tex, exp(x) * sin(x)),
    "ex-subst-definite": lambda tex: definite_is(tex),
}


def verify(id, value):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    if not isinstance(value, str):
        raise TypeError(f"{id}: expected TeX, got {value!r}")
    CHECKS[id](value)
