"""SymPy assertions for lesson 5.12 (Continuity, limits and higher derivatives). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, Sum, cos, diff, exp, limit, oo, simplify, sqrt, summation, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, parse_answer  # noqa: E402

x, h, n = symbols("x h n")
k = symbols("k", integer=True, nonnegative=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


# --- Continuity and differentiability (word answers) -------------------------------------------------------------
# Each option names a (continuous, differentiable) pair at a point. "Differentiable but not continuous" can never be
# the truth, so it always raises AssertionError.
JOIN_WORDS = {
    "Continuous and differentiable": (True, True),
    "Continuous but not differentiable": (True, False),
    "Not continuous, so not differentiable": (False, False),
    "Differentiable but not continuous": (False, True),
}
JOIN_ANSWER = re.compile(r"\s*(" + "|".join(re.escape(w) for w in JOIN_WORDS) + r") at \$x = (.+?)\$\s*")


def join_truth(left, right, at, value):
    """Truth from the pieces: `left` is used for x < at, `right` for x > at, and f(at) = value.
    Continuous: both one-sided limits equal f(at). Differentiable: the one-sided limits of the difference quotient
    (f(at + h) - f(at)) / h as h -> 0 from below and above are finite and equal."""
    from_left, from_right = limit(left, x, at, "-"), limit(right, x, at, "+")
    continuous = simplify(from_left - value) == 0 and simplify(from_right - value) == 0
    slope_left = limit((left.subs(x, at + h) - value) / h, h, 0, "-")
    slope_right = limit((right.subs(x, at + h) - value) / h, h, 0, "+")
    differentiable = slope_left.is_finite and slope_right.is_finite and simplify(slope_left - slope_right) == 0
    return bool(continuous), bool(differentiable)


def join_is(text, left, right, at, value):
    match = JOIN_ANSWER.fullmatch(text)
    if not match:
        raise ValueError(f"cannot read {text!r}")
    words, point = match.groups()
    if simplify(parse_answer(point) - at) != 0:
        raise AssertionError(f"answer is about x = {point}, not x = {at}")
    truth = join_truth(left, right, at, value)
    if JOIN_WORDS[words] != truth:
        raise AssertionError(f"truth (continuous, differentiable) = {truth}, not {words}")


# --- Convergence ------------------------------------------------------------------------------------------------
TERM = re.compile(r"\s*([+-])?\s*(\d+(?:\.\d+)?)")


def series_terms(text):
    """The listed terms of a series written like `$32 - 24 + 18 - \\dots$`, as exact rationals."""
    body = text.strip()
    if not (body.startswith("$") and body.endswith("$")):
        raise ValueError(f"cannot read series {text!r}")
    body = re.sub(r"[+-]?\s*\\[lc]?dots\s*$", "", body[1:-1].strip())
    terms, pos = [], 0
    while pos < len(body):
        match = TERM.match(body, pos)
        if not match or match.end() == pos:
            raise ValueError(f"cannot read series {text!r} at {body[pos:]!r}")
        sign = -1 if match.group(1) == "-" else 1
        terms.append(sign * Rational(match.group(2)))
        pos = match.end()
        while pos < len(body) and body[pos] == " ":
            pos += 1
    if len(terms) < 3:
        raise ValueError(f"series {text!r} needs three terms")
    return terms


def converges_option(text):
    """The correct option is the series with a sum to infinity. SymPy decides convergence of sum u1 r^k itself."""
    terms = series_terms(text)
    r = terms[1] / terms[0]
    if any(terms[i + 1] / terms[i] != r for i in range(len(terms) - 1)):
        raise ValueError(f"{text!r} is not geometric")
    if not Sum(terms[0] * r**k, (k, 0, oo)).is_convergent():
        raise AssertionError(f"{text!r} has r = {r}, so it diverges")


def sum_to_infinity(tex, first, ratio):
    truth = summation(first * ratio**k, (k, 0, oo))
    same(tex, truth)


def least_terms_within(tex):
    """50 + 45 + 40.5 + ...: least n with S_inf - S_n < 1, found by stepping n with exact partial sums."""
    first, ratio = Rational(50), Rational(45, 50)
    s_inf = summation(first * ratio**k, (k, 0, oo))
    count = 0
    while s_inf - summation(first * ratio**k, (k, 0, count - 1)) >= 1:
        count += 1
    same(tex, count)


# --- First principles -----------------------------------------------------------------------------------------
def first_principles(f):
    """f'(x) as the limit of the difference quotient; cross-checked against diff so the limit is trusted."""
    truth = limit((f.subs(x, x + h) - f) / h, h, 0)
    if simplify(truth - diff(f, x)) != 0:
        raise AssertionError("limit and diff disagree")
    return truth


def quotient_is(tex, f):
    same(tex, simplify((f.subs(x, x + h) - f) / h))


def derivative_at_point(value, tolerance, f, at):
    truth = limit((f.subs(x, at + h) - f.subs(x, at)) / h, h, 0)
    check_numeric(value, truth, sf=3, tolerance=tolerance)


# --- Higher derivatives ---------------------------------------------------------------------------------------
def nth_formula_is(tex, f, upto=8):
    """A formula in n must give the true kth derivative for k = 1..upto (the induction proof is in the lesson)."""
    published = parse_answer(tex)
    if n not in published.free_symbols:
        raise AssertionError(f"{published} does not depend on n")
    for order in range(1, upto + 1):
        if simplify(published.subs(n, order) - diff(f, x, order)) != 0:
            raise AssertionError(f"formula fails at n = {order}")


CHECKS = {
    # before
    "before-chord-limit": lambda tex: same(tex, limit(4 + h, h, 0)),
    "before-second-derivative": lambda tex: same(tex, diff(2 * x**3 - 5 * x**2 + x, x, 2)),
    "before-sum-infinity": lambda tex: sum_to_infinity(tex, 9, Rational(1, 3)),
    # continuity
    "ex-join-corner": lambda text: join_is(text, x**2, 3 - 2 * x, 1, Rational(1)),
    "ex-join-smooth": lambda text: join_is(text, 4 * x - 4, x**2, 2, Rational(4)),
    "check-join-jump": lambda text: join_is(text, x + 3, 2 - x**2, 0, Rational(2)),
    "check-join-corner": lambda text: join_is(text, x**2 + 1, 4 * x - 2, 1, Rational(2)),
    # convergence
    "ex-geometric-series": lambda tex: sum_to_infinity(tex, 12, Rational(8, 12)),
    "check-which-converges": converges_option,
    "ex-limit-infinity": lambda tex: same(tex, limit((6 * x**2 - x) / (2 * x**2 + 5), x, oo)),
    "check-limit-rational": lambda tex: same(tex, limit((5 - 2 * x) / (x + 3), x, oo)),
    "ex-gdc-partial-sums": least_terms_within,
    # first principles
    "ex-fp-quadratic": lambda tex: same(tex, first_principles(3 * x**2 - 5 * x)),
    "ex-fp-cubic": lambda tex: same(tex, first_principles(2 * x**3 + x)),
    "check-fp-quotient": lambda tex: quotient_is(tex, 4 - x**2),
    "check-fp-at-point": lambda v, tolerance: derivative_at_point(v, tolerance, x**3 + 2 * x**2, -1),
    # higher derivatives
    "ex-third-poly": lambda tex: same(tex, diff(x**5 - 3 * x**3 + 2 * x, x, 3)),
    "check-third-quartic": lambda tex: same(tex, diff(x**4 - 2 * x**3 + 7 * x, x, 3)),
    "ex-nth-product": lambda tex: nth_formula_is(tex, x * exp(-x)),
    "check-fourth-cos": lambda tex: same(tex, diff(cos(2 * x), x, 4)),
    "check-third-root": lambda v, tolerance: check_numeric(v, diff(sqrt(x), x, 3).subs(x, 1), sf=3, tolerance=tolerance),
}

NUMERIC = {"check-fp-at-point": {"sf": 3}, "check-third-root": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
