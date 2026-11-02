"""SymPy assertions for lesson 3.6 (trigonometric identities). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are built from each question's own data. A show-that answer is a chain `A = B`: `chain_is` parses every side
and requires each to equal the expression the question starts from, for every angle. "Write in terms of one ratio"
answers must also be free of the other ratio. Given-ratio questions build the angle itself from the given ratio and
quadrant (for example theta = pi - asin(5/13) for an obtuse angle with sine 5/13) and evaluate the asked ratios at that
angle, so the sign choice is tested independently of the lesson's Pythagorean working.
"""
import re
import sys
from pathlib import Path

from sympy import Interval, Rational, acos, asin, cos, expand_trig, pi, simplify, sin, solveset, symbols, tan
from sympy.calculus.util import function_range

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    _split, _strip_decorations, _top_level_cuts, check_assignments, check_numeric, check_rounded, parse_answer,
    parse_list,
)

x = symbols("x")
theta = symbols("theta")


def equal(a, b):
    """True when a - b is identically zero, after expanding double angles into single-angle ratios."""
    return simplify(expand_trig(a - b)) == 0


def same(tex, truth):
    published = parse_answer(tex)
    if not equal(published, truth):
        raise AssertionError(f"published {published} is not {truth}")
    return published


def only_ratio(tex, truth, banned):
    """Equal to the truth and written without the banned function (e.g. cos when the answer must be in sin x only)."""
    published = same(tex, truth)
    if published.has(banned):
        raise AssertionError(f"published {published} still contains {banned.__name__}")


def chain_is(tex, truth):
    """Every side of the published statement `A = B = ...` equals the truth for every angle."""
    cleaned = _strip_decorations(tex)
    parts = _split(cleaned, _top_level_cuts(cleaned, r"\\equiv|="))
    if len(parts) < 2:
        raise ValueError(f"{tex!r} is not a statement with =")
    for part in parts:
        side = parse_answer(part)
        if not equal(side, truth):
            raise AssertionError(f"side {side} is not identically {truth}")


def degrees(d):
    return Rational(d) * pi / 180


def obtuse_from_sin(s):
    """The obtuse angle with sine s (second quadrant)."""
    angle = pi - asin(s)
    assert pi / 2 < angle < pi
    return angle


def quadrant_signs(tex):
    """Word answer: the option's signs of sin and cos must be the true signs on ]90°, 180°[ (ranges computed by SymPy)."""
    t = symbols("t", real=True)
    obtuse = Interval.open(pi / 2, pi)
    truth = {
        "sin": "+" if function_range(sin(t), t, obtuse).is_subset(Interval.open(0, 1)) else "-",
        "cos": "-" if function_range(cos(t), t, obtuse).is_subset(Interval.open(-1, 0)) else "+",
    }
    found = dict(re.findall(r"\\(sin|cos)\\theta\s*([<>])\s*0", tex))
    if set(found) != {"sin", "cos"}:
        raise ValueError(f"cannot read the signs in {tex!r}")
    published = {name: "+" if sign == ">" else "-" for name, sign in found.items()}
    if published != truth:
        raise AssertionError(f"published signs {published}, truth {truth}")


def ratios_obtuse(tex):
    angle = obtuse_from_sin(Rational(5, 13))
    check_assignments(tex, {r"\cos\theta": simplify(cos(angle)), r"\tan\theta": simplify(tan(angle))})


def ratios_double(tex):
    """cos(alpha) = -1/3 in the third quadrant: alpha = pi + acos(1/3)."""
    alpha = pi + acos(Rational(1, 3))
    assert pi < alpha < 3 * pi / 2 and simplify(cos(alpha) + Rational(1, 3)) == 0
    check_assignments(
        tex,
        {r"\sin2\alpha": simplify(expand_trig(sin(2 * alpha))), r"\cos2\alpha": simplify(expand_trig(cos(2 * alpha)))},
    )


def tan_values_no_quadrant(tex):
    """sin(theta) = 8/17 with no quadrant: every angle in [0, 2pi) with that sine, and tan at each.

    A single value (no \\pm, no "or", no comma) is read with parse_answer, so a one-value answer is a wrong count
    (AssertionError), not an unreadable one.
    """
    t = symbols("t", real=True)
    angles = solveset(sin(t) - Rational(8, 17), t, Interval.Ropen(0, 2 * pi))
    truth = sorted({simplify(tan(a)) for a in angles}, key=float)
    multi = re.search(r"\\pm|\\mp|\\text\{\s*or\s*\}|,", tex)
    published = sorted(parse_list(tex) if multi else [parse_answer(tex)], key=float)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")

CHECKS = {
    "before-exact-cos": lambda tex: same(tex, cos(5 * pi / 6)),
    "before-quadrant-signs": quadrant_signs,
    "ex-pyth-one-ratio": lambda tex: only_ratio(tex, 5 * cos(x) ** 2 - 2 * sin(x) + 1, cos),
    "check-pyth-simplify": lambda tex: only_ratio(tex, 7 - 7 * cos(x) ** 2, cos),
    "ex-pyth-tan-show": lambda tex: chain_is(tex, tan(theta) + 1 / tan(theta)),
    "check-pyth-one-ratio": lambda tex: only_ratio(tex, 2 * sin(theta) ** 2 + 3 * cos(theta), sin),
    "ex-double-exact-sin": lambda tex: same(tex, sin(degrees(15)) * cos(degrees(15))),
    "check-double-cos-form": lambda tex: only_ratio(tex, cos(2 * theta), sin),
    "ex-double-square-show": lambda tex: chain_is(tex, (sin(x) + cos(x)) ** 2),
    "ex-double-tan-show": lambda tex: chain_is(tex, sin(2 * x) / (1 + cos(2 * x))),
    "check-double-sin-value": lambda tex: same(tex, 4 * sin(pi / 8) * cos(pi / 8)),
    "ex-ratios-obtuse": ratios_obtuse,
    "check-ratios-tan": lambda tex: same(tex, tan(obtuse_from_sin(Rational(2, 3)))),
    "check-ratios-no-quadrant": tan_values_no_quadrant,
    "ex-ratios-double": ratios_double,
    "check-ratios-cos2": lambda v, tolerance: check_numeric(
        v, simplify(expand_trig(cos(2 * asin(Rational(3, 10))))), sf=3, tolerance=tolerance
    ),
    "ex-ratios-p2": lambda tex: check_rounded(tex, sin(2 * obtuse_from_sin(Rational(21, 50))), sf=3),
}

NUMERIC = {"check-ratios-cos2": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
