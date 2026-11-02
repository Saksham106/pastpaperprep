"""SymPy assertions for lesson 3.11 (trigonometric-function relationships and symmetry). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths come from SymPy's own evaluation of the trig functions at the stated angles. Equations are solved by solveset on
the stated interval, straight from the original equation; solveset returns some roots as arctans, so roots are compared
to 50 significant figures and each published root is also substituted back into the equation. Symmetry answers are
checked by the property only a right answer has: a half-turn centre (a, b) needs f(2a - x) = 2b - f(x) for every x.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Interval, N, Rational, Symbol, acos, asin, cos, expand_trig, periodicity, pi, simplify, sin, solveset, symbols, tan,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import _split, _strip_decorations, _top_level_cuts, check_numeric, parse_answer, parse_list, parse_point  # noqa: E402

x, theta = symbols("x theta")
p = Symbol("p", positive=True)


def equal(a, b):
    """True when a - b is identically zero, after expanding compound and multiple angles."""
    return simplify(expand_trig(a - b)) == 0


def same(tex, truth):
    published = parse_answer(tex)
    if not equal(published, truth):
        raise AssertionError(f"published {published} is not {truth}")


def chain_is(tex, truth):
    """Every side of the published statement `X = Y = ...` equals the truth for every x."""
    cleaned = _strip_decorations(tex)
    parts = _split(cleaned, _top_level_cuts(cleaned, r"\\equiv|="))
    if len(parts) < 2:
        raise ValueError(f"{tex!r} is not a statement with =")
    for part in parts:
        side = parse_answer(part)
        if not equal(side, truth):
            raise AssertionError(f"side {side} is not identically {truth}")


def roots_are(tex, equation, interval):
    """All solutions of equation = 0 on the interval, in any order. A one-value answer is read with parse_answer."""
    truth = sorted(solveset(equation, x, interval), key=float)
    multi = re.search(r"\\pm|\\mp|\\text\{\s*or\s*\}|,", tex)
    published = sorted(parse_list(tex) if multi else [parse_answer(tex)], key=float)
    if len(published) != len(truth):
        raise AssertionError(f"published {published}, truth {truth}")
    for value, root in zip(published, truth):
        if abs(N(value - root, 50)) > 1e-40:
            raise AssertionError(f"published {value} is not the root {root}")
        if abs(N(equation.subs(x, value), 50)) > 1e-40:
            raise AssertionError(f"published {value} does not satisfy the equation")


def tan_in_terms_of_p(tex):
    """ex-tan-in-terms-of-p: alpha = acos(p) is the acute angle with cosine p, for 0 < p < 1."""
    # The parser makes a plain symbol p; give it the question's condition p > 0 so sqrt(1 - p^2) compares cleanly.
    published = parse_answer(tex).subs(Symbol("p"), p)
    truth = tan(pi / 2 + acos(p))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")
    # Spot values as an independent cross-check of the symbolic comparison.
    for value in (Rational(1, 5), Rational(1, 2), Rational(9, 10)):
        if abs(N((published - truth).subs(p, value), 50)) > 1e-40:
            raise AssertionError(f"published {published} differs from the truth at p = {value}")


def sum_of_four(tex):
    """ex-sum-solutions: the sum of the solutions of sin x = k on [0, 4pi] does not depend on k in ]0, 1[."""
    published = parse_answer(tex)
    for k in (Rational(1, 3), Rational(3, 4)):
        roots = solveset(sin(x) - k, x, Interval(0, 4 * pi))
        assert len(roots) == 4
        if simplify(published - sum(roots)) != 0:
            raise AssertionError(f"published {published} is not the sum {simplify(sum(roots))} for k = {k}")


def half_turn_centre_of_cos(tex):
    """check-cos-centre: (a, b) is a half-turn centre of y = cos x when cos(2a - x) = 2b - cos x for every x."""
    a, b = parse_point(tex)
    if not equal(cos(2 * a - x), 2 * b - cos(x)):
        raise AssertionError(f"({a}, {b}) is not a half-turn centre of y = cos x")


def other_cos_solution(tex):
    """check-cos-other-solution: the solution of cos x = cos(pi/9) in [0, 2pi[ other than pi/9."""
    roots = solveset(cos(x) - cos(pi / 9), x, Interval.Ropen(0, 2 * pi))
    others = [r for r in roots if simplify(r - pi / 9) != 0]
    assert len(others) == 1
    same(tex, others[0])


def smallest_positive_root(tex):
    """check-smallest-root: the smallest positive solution of sin 5x = cos x (one is in ]0, pi[)."""
    truth = min(solveset(sin(5 * x) - cos(x), x, Interval.open(0, pi)), key=float)
    published = parse_answer(tex)
    if abs(N(published - truth, 50)) > 1e-40:
        raise AssertionError(f"published {published} is not the smallest root {truth}")


def tan_complement_value():
    """check-tan-complement-value: beta acute with sin beta = 0.6."""
    beta = asin(Rational(3, 5))
    return simplify(expand_trig(tan(pi / 2 - beta)))


CHECKS = {
    "before-exact-sin": lambda tex: same(tex, sin(5 * pi / 6)),
    "before-tan-period": lambda tex: same(tex, periodicity(tan(x), x)),
    "ex-simplify-related": lambda tex: same(tex, 2 * cos(pi - x) + sin(pi / 2 + x)),
    "check-cos-quarter-plus": lambda tex: same(tex, cos(pi / 2 + theta)),
    "ex-tan-in-terms-of-p": tan_in_terms_of_p,
    "check-tan-complement-value": lambda v, tolerance: check_numeric(v, tan_complement_value(), sf=3, tolerance=tolerance),
    "ex-show-mirror": lambda tex: chain_is(tex, 2 * sin(x) + sin(3 * x)),
    "check-cos-centre": half_turn_centre_of_cos,
    "check-cos-other-solution": other_cos_solution,
    "ex-sum-solutions": sum_of_four,
    "ex-prove-product": lambda tex: chain_is(tex, -sin(x)),
    "check-simplify-quotient": lambda tex: same(tex, cos(pi - x) / sin(pi / 2 + x)),
    "ex-sin-equals-cos": lambda tex: roots_are(tex, sin(3 * x) - cos(x), Interval(0, pi / 2)),
    "check-smallest-root": smallest_positive_root,
    "ex-quadratic-in-sine": lambda tex: roots_are(tex, 2 * cos(x) ** 2 - 5 * cos(pi / 2 - x) + 1, Interval(0, 2 * pi)),
    "check-reject-root": lambda tex: roots_are(tex, 2 * sin(x) ** 2 + 3 * cos(pi - x), Interval(0, 2 * pi)),
}

NUMERIC = {"check-tan-complement-value": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
