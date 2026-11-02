"""SymPy assertions for lesson 3.10 (compound-angle identities). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are built from each question's own data. Exact values are SymPy's own evaluation of the trig function at the
given angle. Given-ratio questions build each angle from its ratio and quadrant (an obtuse angle with sine 3/5 is
pi - asin(3/5)), so the sign choice is tested independently of the lesson's Pythagorean working. A show-that answer is
a chain `A = B`: every side must equal the expression the question starts from, for every angle (expand_trig then
simplify). Equations are solved by SymPy's solveset on the stated interval, straight from the original equation.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Interval, N, Rational, acos, asin, atan, cos, expand_trig, pi, rad, simplify, sin, solve, solveset, symbols, tan,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import _split, _strip_decorations, _top_level_cuts, check_numeric, parse_answer, parse_list  # noqa: E402

x, theta, t = symbols("x theta t")
A, B = symbols("A B")


def equal(a, b):
    """True when a - b is identically zero, after expanding compound and multiple angles into single-angle ratios."""
    return simplify(expand_trig(a - b)) == 0


def same(tex, truth):
    published = parse_answer(tex)
    if not equal(published, truth):
        raise AssertionError(f"published {published} is not {truth}")


def chain_is(tex, truth):
    """Every side of the published statement `X = Y = ...` equals the truth for every angle."""
    cleaned = _strip_decorations(tex)
    parts = _split(cleaned, _top_level_cuts(cleaned, r"\\equiv|="))
    if len(parts) < 2:
        raise ValueError(f"{tex!r} is not a statement with =")
    for part in parts:
        side = parse_answer(part)
        if not equal(side, truth):
            raise AssertionError(f"side {side} is not identically {truth}")


def roots_are(tex, truth_set):
    """All solutions, in any order. A single value (no "or", no comma, no \\pm) is read with parse_answer, so a
    one-value answer is a wrong count (AssertionError), not an unreadable one."""
    truth = sorted(truth_set, key=float)
    multi = re.search(r"\\pm|\\mp|\\text\{\s*or\s*\}|,", tex)
    published = sorted(parse_list(tex) if multi else [parse_answer(tex)], key=float)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def angles_cos_diff():
    """A acute with cos A = 7/25; B obtuse with sin B = 3/5."""
    a = acos(Rational(7, 25))
    b = pi - asin(Rational(3, 5))
    assert 0 < a < pi / 2 and pi / 2 < b < pi
    return a, b


def tan_sum_angle(tex):
    """ex-tan-sum-angle: A + B = atan 2 + atan 3 (both acute). SymPy does not reduce the sum of two arctans to a
    multiple of pi, so compare the published value with it to 60 significant figures, and also require the published
    angle to lie in ]0, pi[ with tangent exactly tan(atan 2 + atan 3) computed from the compound identity."""
    published = parse_answer(tex)
    truth = atan(2) + atan(3)
    if not (0 < published < pi):
        raise AssertionError(f"published {published} is not between 0 and pi")
    if simplify(tan(published) - expand_trig(tan(truth))) != 0:
        raise AssertionError(f"tan({published}) is not tan(A + B)")
    if abs(N(published - truth, 60)) > 1e-50:
        raise AssertionError(f"published {published} is not atan(2) + atan(3)")


def tan_b_value():
    """check-tan-find-b: solve (1/2 + t) / (1 - t/2) = 3 for t = tan B."""
    roots = solve((Rational(1, 2) + t) / (1 - t / 2) - 3, t)
    assert len(roots) == 1
    return roots[0]


def obtuse_from_tan(value):
    """The obtuse angle with the given (negative) tangent."""
    angle = pi + atan(value)
    assert pi / 2 < angle < pi
    return angle


CHECKS = {
    "before-cos-from-sin": lambda tex: same(tex, cos(asin(Rational(2, 7)))),
    "before-double-cos": lambda v, tolerance: check_numeric(
        v, simplify(expand_trig(cos(2 * asin(Rational(1, 4))))), sf=3, tolerance=tolerance
    ),
    "before-solve-tan": lambda tex: roots_are(tex, solveset(tan(x) + 1, x, Interval.Ropen(0, 2 * pi))),
    "ex-cos-7pi-12": lambda tex: same(tex, cos(7 * pi / 12)),
    "check-cos-pattern": lambda v, tolerance: check_numeric(
        v, simplify(cos(rad(80)) * cos(rad(20)) + sin(rad(80)) * sin(rad(20))), sf=3, tolerance=tolerance
    ),
    "ex-cos-diff-ratios": lambda tex: same(tex, cos(angles_cos_diff()[0] - angles_cos_diff()[1])),
    "check-sin-sum-ratios": lambda tex: same(tex, sin(angles_cos_diff()[0] + angles_cos_diff()[1])),
    "ex-tan-105": lambda tex: same(tex, tan(rad(105))),
    "check-tan-minus-quarter": lambda tex: same(tex, tan(x - pi / 4)),
    "ex-tan-sum-angle": tan_sum_angle,
    "check-tan-find-b": lambda v, tolerance: check_numeric(v, tan_b_value(), sf=3, tolerance=tolerance),
    "ex-derive-tan-double": lambda tex: chain_is(tex, tan(2 * theta)),
    "ex-tan-double-value": lambda tex: same(tex, tan(2 * obtuse_from_tan(-2))),
    "check-tan-pi-8": lambda tex: same(tex, tan(pi / 8)),
    "ex-tan-double-equation": lambda tex: roots_are(tex, solveset(tan(2 * x) - 3 * tan(x), x, Interval.Ropen(0, pi))),
    "check-tan-double-third": lambda v, tolerance: check_numeric(
        v, simplify(expand_trig(tan(2 * atan(Rational(1, 3))))), sf=3, tolerance=tolerance
    ),
    "ex-show-sin-product": lambda tex: chain_is(tex, sin(A + B) * sin(A - B)),
    "check-cos-sum-diff": lambda tex: same(tex, cos(A + B) + cos(A - B)),
    "ex-cos-four": lambda tex: chain_is(tex, cos(4 * theta)),
    "check-cos4-value": lambda v, tolerance: check_numeric(
        v, simplify(expand_trig(cos(4 * acos(Rational(1, 3))))), sf=3, tolerance=tolerance
    ),
    "ex-solve-shift": lambda tex: roots_are(tex, solveset(sin(x - pi / 6) - cos(x), x, Interval.Ropen(0, 2 * pi))),
}

NUMERIC = {
    "before-double-cos": {"sf": 3},
    "check-cos-pattern": {"sf": 3},
    "check-tan-find-b": {"sf": 3},
    "check-tan-double-third": {"sf": 3},
    "check-cos4-value": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
