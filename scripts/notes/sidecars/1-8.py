"""SymPy assertions for lesson 1.8 (Infinite geometric series). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every sum to infinity is computed here with SymPy's `summation` to infinity of the series' own terms (not with the
booklet formula), ratios come from dividing the given terms, ranges of x from solving |r| < 1 as an inequality, and
unknowns with solve, keeping only solutions that satisfy |r| < 1. "Least n" is found by testing whole numbers in turn.
"""
import re
import sys
from pathlib import Path

from sympy import Abs, Integer, Rational, S, oo, simplify, solve, solve_univariate_inequality, summation, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, check_same_set, parse_answer, parse_with_unit  # noqa: E402

k, x, u, r = symbols("k x u r")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_with_unit(tex, truth, unit):
    published = parse_answer(parse_with_unit(tex, unit))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} {unit} is not {truth}")


def ratio_of(*terms):
    """Common ratio from consecutive given terms; refuses a list that is not geometric."""
    ratios = {Rational(b) / Rational(a) for a, b in zip(terms, terms[1:])}
    if len(ratios) != 1:
        raise RuntimeError(f"{terms} is not geometric")
    return ratios.pop()


def sum_to_infinity(first, ratio, start=0):
    """sum_{k=start}^{oo} first * ratio^(k - start), computed by SymPy; refuses a divergent series."""
    if Abs(ratio) >= 1:
        raise RuntimeError("divergent series has no sum to infinity")
    return summation(S(first) * ratio ** (k - start), (k, start, oo))


def partial_sum(first, ratio, count):
    total, term = S(0), S(first)
    for _ in range(count):
        total += term
        term *= ratio
    return total


NO_SUM = re.compile(r"\s*No, because \$\\lvert r\\rvert = (.+?) (?:>|\\ge) 1\$\s*")


def has_sum_option(tex, terms):
    """Word answer: either a value of S_infinity, or 'No, because |r| = ... > 1'. The truth depends on |r|."""
    ratio = ratio_of(*terms)
    claim_no = NO_SUM.fullmatch(tex)
    if Abs(ratio) < 1:
        if claim_no:
            raise AssertionError(f"|r| = {Abs(ratio)} < 1, so the series does have a sum to infinity")
        same(tex, sum_to_infinity(terms[0], ratio))
        return
    if claim_no:
        same(f"${claim_no.group(1)}$", Abs(ratio))
        return
    if "S_{\\infty}" in tex:
        raise AssertionError(f"|r| = {Abs(ratio)} >= 1: the series is divergent, so {tex!r} is wrong")
    raise ValueError(f"cannot read option {tex!r}")


def x_range(ratio_expr):
    return solve_univariate_inequality(Abs(ratio_expr) < 1, x, relational=False)


def x_for_sum():
    """First term 4, ratio (3 - 2x)/5, S_infinity = 5: solve, keeping only x where the series converges."""
    ratio = (3 - 2 * x) / 5
    valid = [s for s in solve(4 / (1 - ratio) - 5, x) if s in x_range(ratio)]
    if len(valid) != 1:
        raise RuntimeError(f"expected one valid x, got {valid}")
    return valid[0]


def ratio_from_sum(first, total):
    valid = [s for s in solve(first / (1 - r) - total, r) if Abs(s) < 1]
    if len(valid) != 1:
        raise RuntimeError(f"expected one valid r, got {valid}")
    return valid[0]


def first_from_sum(ratio, total):
    return solve(u / (1 - ratio) - total, u)[0]


def second_term_and_sum():
    """u1 r = -12 and u1 / (1 - r) = 16, keeping the solution with |r| < 1."""
    sols = [s for s in solve([u * r + 12, u - 16 * (1 - r)], [u, r], dict=True) if Abs(s[r]) < 1]
    if len(sols) != 1:
        raise RuntimeError(f"expected one valid solution, got {sols}")
    return {"r": sols[0][r], "u_{1}": sols[0][u]}


def bounce_total():
    """First drop of 6 m, then every rise (6 * 0.7^k for k >= 1) is matched by an equal fall."""
    rises = summation(6 * Rational(7, 10) ** k, (k, 1, oo))
    return 6 + 2 * rises


def bounce_total_try():
    """First drop of 10 m, then every rise (10 * 0.6^k for k >= 1) is matched by an equal fall."""
    return 10 + 2 * summation(10 * Rational(6, 10) ** k, (k, 1, oo))


def least_terms_within_one():
    first, ratio = 900, ratio_of(900, 600, 400)
    limit = sum_to_infinity(first, ratio)
    for m in range(1, 500):
        if limit - partial_sum(first, ratio, m) < 1:
            return Integer(m)
    raise RuntimeError("no n found")


CHECKS = {
    # before you start
    "before-geo-ratio": lambda tex: same(tex, ratio_of(81, -27, 9)),
    "before-geo-sum": lambda v, tolerance: check_numeric(v, partial_sum(54, ratio_of(54, 18, 6), 4), sf=3, tolerance=tolerance),
    # why
    "ex-sum-quarter": lambda tex: same(tex, sum_to_infinity(40, ratio_of(40, 10, Rational(5, 2)))),
    "check-sum-direct": lambda v, tolerance: check_numeric(v, sum_to_infinity(63, ratio_of(63, 9, Rational(9, 7))), sf=3, tolerance=tolerance),
    "ex-sum-alternating": lambda tex: same(tex, sum_to_infinity(50, ratio_of(50, -20, 8))),
    "check-sum-negative": lambda tex: same(tex, sum_to_infinity(24, ratio_of(24, -6, Rational(3, 2)))),
    "check-sigma-infinite": lambda tex: same(tex, summation(6 * Rational(1, 4) ** k, (k, 1, oo))),
    # condition
    "ex-show-converges": lambda tex: same(tex, sum_to_infinity(Rational(5, 4), ratio_of(Rational(5, 4), -1, Rational(4, 5)))),
    "check-has-sum": lambda tex: has_sum_option(tex, [8, -12, 18]),
    "ex-x-range": lambda tex: check_same_set(tex, x_range((3 - 2 * x) / 5)),
    "check-x-given-sum": lambda v, tolerance: check_numeric(v, x_for_sum(), sf=3, tolerance=tolerance),
    "check-x-range": lambda tex: check_same_set(tex, x_range((x + 1) / 3)),
    # using
    "ex-find-ratio": lambda tex: same(tex, ratio_from_sum(15, 25)),
    "check-find-first": lambda v, tolerance: check_numeric(v, first_from_sum(Rational(-6, 10), 40), sf=3, tolerance=tolerance),
    "ex-u2-and-sum": lambda tex: check_assignments(tex, second_term_and_sum()),
    "ex-bounce": lambda tex: same_with_unit(tex, bounce_total(), "m"),
    "check-bounce-try": lambda v, tolerance: check_numeric(v, bounce_total_try(), sf=3, tolerance=tolerance),
    "ex-least-n": lambda tex: same(tex, least_terms_within_one()),
}

NUMERIC = {
    "before-geo-sum": {"sf": 3},
    "check-sum-direct": {"sf": 3},
    "check-x-given-sum": {"sf": 3},
    "check-find-first": {"sf": 3},
    "check-bounce-try": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
