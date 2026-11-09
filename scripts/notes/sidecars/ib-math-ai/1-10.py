"""SymPy assertion for lesson 1.10 (Rational exponents). Not shipped to the browser.

Only ex-simplify-algebraic is checked here: it applies a fractional power to a power of x, (x^3)^(-2/3) = x^-2, which
holds only for x > 0 as the question states. The declarative `expression` kind compares letters with no assumptions,
so it cannot prove this; here every letter is given the lesson's assumption that it is positive. Every other block in
the lesson uses its own `verify` block.
"""
import sys
from pathlib import Path

from sympy import Rational, Symbol, simplify, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import parse_answer  # noqa: E402

x = Symbol("x", positive=True)


def positive(expr):
    """Parsed letters carry no assumptions; give every one the question's assumption that it is positive."""
    return expr.subs({s: Symbol(s.name, positive=True) for s in expr.free_symbols})


def same(tex, truth):
    published = positive(parse_answer(tex))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


CHECKS = {
    # sqrt(x) * (8x^3)^(-2/3), x > 0, from the question's own expression.
    "ex-simplify-algebraic": lambda tex: same(tex, sqrt(x) * (8 * x**3) ** Rational(-2, 3)),
}

NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
