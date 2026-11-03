"""SymPy assertions for lesson 3.5 (Unit-circle trigonometry and exact values). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths come from SymPy's own trig functions evaluated at the question's angles: unit-circle coordinates, exact values
(SymPy evaluates cos(7*pi/6) and friends exactly), angles placed in their quadrant with acos/asin, and the related-angle
rules by simplifying sin(pi - x) and so on. For the ambiguous case, the triangles are found independently of the sine
rule: the cosine rule a^2 = b^2 + c^2 - 2bc cos A is a quadratic in the unknown side c, each positive root is a
triangle, and its angle comes back from the cosine rule. Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Rational, S, acos, asin, cos, nsimplify, pi, simplify, sin, solve, sqrt, symbols, tan,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded_list, check_same_equation, parse_answer, parse_degrees,
)

x, y, c = symbols("x y c")
DEG = pi / 180


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def triangles(A_deg, a, b):
    """Every triangle with angle A, side a opposite it and side b: positive roots c of the cosine rule.

    Returns the angle B (opposite b) of each triangle in degrees, found from the cosine rule, not the sine rule.
    """
    A = A_deg * DEG
    roots = [r for r in solve(c**2 - 2 * b * c * cos(A) + b**2 - a**2, c) if r.is_real and r.evalf() > 0]
    return [acos((a**2 + r**2 - b**2) / (2 * a * r)) / DEG for r in roots]


def pieces(tex):
    parts = re.split(r"\\text\{\s*or\s*\}", tex)
    if len(parts) < 2:
        raise ValueError(f"{tex!r} should give two angles joined by \\text{{ or }}")
    return parts


def exact_angle_list(tex, truths):
    published = sorted((parse_degrees(part) for part in pieces(tex)), key=lambda v: float(v))
    expected = sorted(truths, key=lambda v: float(v))
    if len(published) != len(expected) or any(simplify(p - t) != 0 for p, t in zip(published, expected)):
        raise AssertionError(f"published {published} degrees, truth {expected}")


# --- before ----------------------------------------------------------------------------------------------------------
def before_right_ratio(tex):
    hyp, opp = 41, 9
    adjacent = sqrt(hyp**2 - opp**2)
    same(tex, adjacent / hyp)


def before_sine_rule(v, tolerance):
    check_numeric(v, 6 * sin(110 * DEG) / sin(35 * DEG), sf=3, tolerance=tolerance)


# --- unit circle -------------------------------------------------------------------------------------------------------
def circle_point(tex):
    px, py = Rational(-7, 25), Rational(24, 25)
    assert px**2 + py**2 == 1, "P must be on the unit circle"
    theta = acos(px)  # px < 0 and py > 0: second quadrant, which acos already returns
    check_assignments(tex, {"\\cos\\theta": cos(theta), "\\sin\\theta": sin(theta)})


def circle_related(tex):
    alpha = asin(Rational(2, 9))
    same(tex, sin(pi + alpha))


def circle_sign(tex):
    theta = pi + acos(Rational(5, 6))  # third-quadrant angle with cosine -5/6
    assert simplify(cos(theta) + Rational(5, 6)) == 0
    same(tex, sin(theta))


def circle_sign_check(tex):
    theta = pi - acos(Rational(8, 17))  # second-quadrant angle with cosine -8/17
    assert simplify(cos(theta) + Rational(8, 17)) == 0
    same(tex, sin(theta))


# --- tangent -----------------------------------------------------------------------------------------------------------
QUADRANT_WORDS = {"first": 1, "second": 2, "third": 3, "fourth": 4}


def tan_sign(text):
    word = re.sub(r"[^a-z]", "", text.lower())
    if word not in QUADRANT_WORDS:
        raise ValueError(f"cannot read quadrant {text!r}")
    # Test the middle angle of each quadrant: sin > 0 and tan < 0.
    truth = [q for q in range(1, 5) if sin((2 * q - 1) * pi / 4) > 0 and tan((2 * q - 1) * pi / 4) < 0]
    assert len(truth) == 1
    if QUADRANT_WORDS[word] != truth[0]:
        raise AssertionError(f"{text} quadrant, truth quadrant {truth[0]}")


def tan_line(tex):
    theta = acos(Rational(-1, 3))  # in ]0, pi[ as the question requires
    check_same_equation(tex, y - x * tan(theta))


# --- exact values ------------------------------------------------------------------------------------------------------
def tan_degrees(tex):
    same(tex, tan(300 * DEG))


# --- ambiguous case ----------------------------------------------------------------------------------------------------
def ambiguous_exact(tex):
    # A = 30 deg, a = BC = 3*sqrt(2) faces A, b = AC = 6 faces B.
    exact_angle_list(tex, [nsimplify(angle) for angle in triangles(30, 3 * sqrt(2), 6)])


def ambiguous_gdc(tex):
    # P = 38 deg, QR = 8 faces P, PQ = 11 faces R.
    check_rounded_list(tex, triangles(38, 8, 11), sf=3, unit="°")


def ambiguous_pr(v, tolerance):
    # Obtuse R: PR faces Q, and Q = 180 - 38 - R.
    R = max(triangles(38, 8, 11), key=lambda angle: float(angle))
    Q = 180 - 38 - R
    check_numeric(v, 8 * sin(Q * DEG) / sin(38 * DEG), sf=3, tolerance=tolerance)


def ambiguous_count(tex):
    published = parse_answer(tex)
    if simplify(published - len(triangles(40, 7, 9))) != 0:
        raise AssertionError(f"published {published} triangles, truth {len(triangles(40, 7, 9))}")


def ambiguous_obtuse(v, tolerance):
    # X = 25 deg, YZ = 6 faces X, XZ = 10 faces Y; take the obtuse Y.
    obtuse = [angle for angle in triangles(25, 6, 10) if angle.evalf() > 90]
    assert len(obtuse) == 1
    check_numeric(v, obtuse[0], sf=3, tolerance=tolerance)


CHECKS = {
    "before-right-ratio": before_right_ratio,
    "before-radians": lambda tex: same(tex, 150 * DEG),
    "before-sine-rule": before_sine_rule,
    "ex-circle-point": circle_point,
    "ex-circle-simplify": lambda tex: same(tex, sin(pi - x) + sin(-x) + cos(pi + x)),
    "check-circle-related": circle_related,
    "ex-circle-sign": circle_sign,
    "check-circle-sign": circle_sign_check,
    "ex-tan-quotient": lambda tex: same(tex, Rational(-20, 29) / Rational(-21, 29)),
    "check-tan-sign": tan_sign,
    "ex-tan-line": tan_line,
    "check-tan-related": lambda tex: same(tex, tan(4 * pi - x)),
    "ex-exact-cos": lambda tex: same(tex, cos(7 * pi / 6)),
    "ex-exact-tan-degrees": tan_degrees,
    "check-exact-sin": lambda tex: same(tex, sin(5 * pi / 4)),
    "ex-exact-combo": lambda tex: same(tex, 2 * sin(4 * pi / 3) - tan(3 * pi / 4)),
    "check-exact-negative": lambda tex: same(tex, cos(-4 * pi / 3)),
    "ex-ambiguous-exact": ambiguous_exact,
    "ex-ambiguous-gdc": ambiguous_gdc,
    "check-ambiguous-pr": ambiguous_pr,
    "check-ambiguous-count": ambiguous_count,
    "check-ambiguous-obtuse": ambiguous_obtuse,
}

NUMERIC = {"before-sine-rule": {"sf": 3}, "check-ambiguous-pr": {"sf": 3}, "check-ambiguous-obtuse": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
