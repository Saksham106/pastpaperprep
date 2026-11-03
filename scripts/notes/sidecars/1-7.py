"""SymPy assertions for lesson 1.7 (Rational exponents and logarithm laws). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths come from the question's own data: rational powers are evaluated by SymPy, a logarithm's value is the real
solution of the matching exponential equation (so the change-of-base formula is never used to check itself), log and
exponential equations are solved with `solve` on positive or real unknowns, and log expressions are compared after
expanding every log into logs of primes, so two forms of the same number are equal and different numbers are not.
"""
import sys
from pathlib import Path

from sympy import Eq, Integer, Rational, S, Symbol, cbrt, expand_log, log, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer, parse_list  # noqa: E402

R = Rational
x = symbols("x", positive=True)
xr = symbols("x", real=True)
y = symbols("y", real=True)
u = symbols("u", real=True)


def positive(expr):
    """Parsed letters carry no assumptions; give every one the lesson's assumption that it is positive."""
    return expr.subs({s: Symbol(s.name, positive=True) for s in expr.free_symbols})


def equal(a, b):
    return simplify(expand_log(positive(a) - positive(b), force=True)) == 0


def same(tex, truth):
    published = parse_answer(tex)
    if not equal(published, truth):
        raise AssertionError(f"published {published} is not {truth}")


def only(values):
    values = list(values)
    if len(values) != 1:
        raise AssertionError(f"expected one solution, found {values}")
    return values[0]


def real_solutions(equation, var):
    return [r for r in solve(equation, var) if r.is_real]


def log_value(base, number):
    """log_base(number), as the real power y with base**y = number."""
    return only(real_solutions(Eq(S(base) ** y, number), y))


def roots_are(tex, truths):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truths = sorted(truths, key=lambda r: float(r))
    if len(published) != len(truths) or not all(equal(p, t) for p, t in zip(published, truths)):
        raise AssertionError(f"published {published}, truth {truths}")


# Before you start --------------------------------------------------------------------------------------------------

def before_log_form(tex):
    """10^x = 3 written as a log statement: the right-hand side must be the x that solves it."""
    same(tex, only(real_solutions(Eq(10**xr, 3), xr)))


# Worked answers ----------------------------------------------------------------------------------------------------

def hidden_quadratic(tex):
    """9^x - 10*3^x + 21 = 0 with u = 3^x: each positive root u gives one real x = log_3 u."""
    us = [r for r in solve(u**2 - 10 * u + 21, u) if r > 0]
    roots_are(tex, [log_value(3, r) for r in us])


WORDS = {"None": 0, "One": 1, "Two": 2}


def hidden_quadratic_count(text):
    """4^x - 3*2^x - 10 = 0: count the positive roots of u^2 - 3u - 10 (2^x can only take positive values)."""
    if text not in WORDS:
        raise ValueError(f"unknown option {text!r}")
    count = len([r for r in solve(u**2 - 3 * u - 10, u) if r > 0])
    if WORDS[text] != count:
        raise AssertionError(f"{text} is not {count} solution(s)")


CHECKS = {
    "before-integer-exponents": lambda tex: same(tex, x**7 * x**-2 / x**3),
    "before-log-form": before_log_form,
    "before-log-value": lambda v, tolerance: check_numeric(v, log_value(2, 32), sf=3, tolerance=tolerance),
    # Rational exponents
    "ex-evaluate-negative-fraction": lambda tex: same(tex, Integer(32) ** R(-3, 5)),
    "ex-simplify-fractional-powers": lambda tex: same(tex, (9 * x**4) ** R(3, 2) / (3 * x ** R(1, 2))),
    "check-evaluate-fraction-power": lambda tex: same(tex, Integer(125) ** R(2, 3)),
    "check-single-power": lambda tex: same(tex, cbrt(x**2) / x**2),
    # Meaning of a logarithm
    "ex-log-fraction-value": lambda tex: same(tex, log_value(27, 9)),
    "ex-log-equation-definition": lambda tex: same(tex, only(solve(Eq(log(2 * x - 6, 4), R(3, 2)), x))),
    "check-log-value": lambda tex: same(tex, log_value(8, R(1, 4))),
    "check-log-one-and-base": lambda v, tolerance: check_numeric(
        v, log_value(5, 1) + log_value(7, 7) + log_value(3, 3**4), sf=3, tolerance=tolerance
    ),
    # Laws of logarithms
    "ex-combine-single-log": lambda tex: same(tex, 2 * log(10) - log(4) + log(R(1, 5))),
    "ex-log-in-terms": lambda tex: same(tex, ex_log_in_terms_truth()),
    "ex-log-equation-laws": lambda tex: same(tex, only(solve(Eq(log(x, 2) + log(x + 6, 2), 4), x))),
    "check-combine-logs": lambda tex: same(tex, log(20, 3) - 2 * log(2, 3) + log(R(9, 5), 3)),
    "check-log-in-terms": lambda v, tolerance: check_numeric(v, check_log_in_terms_truth(), sf=3, tolerance=tolerance),
    # Change of base
    "ex-change-base-exact": lambda tex: same(tex, log_value(8, 128)),
    "ex-change-base-equation": lambda tex: same(tex, only(solve(Eq(log(x, 2) + log(x, 4) + log(x, 16), 7), x))),
    "check-change-base-exact": lambda tex: same(tex, log_value(4, 32)),
    "check-change-base-numeric": lambda v, tolerance: check_numeric(v, log_value(7, 200), sf=3, tolerance=tolerance),
    # Exponential equations
    "ex-same-base": lambda tex: same(tex, only(real_solutions(Eq(R(1, 4) ** xr, 8 ** (2 * xr - 1)), xr))),
    "ex-take-logs-exact": lambda tex: same(tex, only(real_solutions(Eq(3 ** (2 * xr - 1), 7), xr))),
    "ex-unknown-both-sides": lambda tex: same(tex, only(real_solutions(Eq(5**xr, 2 ** (xr + 3)), xr))),
    "ex-hidden-quadratic": hidden_quadratic,
    "check-hidden-quadratic-count": hidden_quadratic_count,
    "ex-medicine-decay": lambda tex: check_rounded(
        tex, only(real_solutions(Eq(400 * R(8, 10) ** xr, 50), xr)), sf=3, unit="hours"
    ),
    "check-same-base": lambda tex: same(tex, only(real_solutions(Eq(25**xr, 125 ** (xr - 1)), xr))),
    "check-take-logs-numeric": lambda v, tolerance: check_numeric(v, log_value(6, 50), sf=3, tolerance=tolerance),
}


def ex_log_in_terms_truth():
    """log_b m = 5 and log_b n = -2 mean m = b^5 and n = b^-2; take log_b of m^2 / sqrt(n) directly."""
    b = symbols("b", positive=True)
    m, n = b**5, b**-2
    return simplify(expand_log(log(m**2 / sqrt(n), b), force=True))


def check_log_in_terms_truth():
    """log_a x = 6 and log_a y = 4 mean x = a^6 and y = a^4; take log_a of cbrt(x) / y directly."""
    a = symbols("a", positive=True)
    xv, yv = a**6, a**4
    return simplify(expand_log(log(cbrt(xv) / yv, a), force=True))


# Required precision of every numeric check.
NUMERIC = {
    "before-log-value": {"sf": 3},
    "check-log-one-and-base": {"sf": 3},
    "check-log-in-terms": {"sf": 3},
    "check-change-base-numeric": {"sf": 3},
    "check-take-logs-numeric": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
