"""SymPy assertions for lesson 3.4 (radians, arc length and sector area). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built here from the question's own data. Sector truths come from the "fraction of the whole circle"
definition (theta / 2pi of the circumference or of pi r^2), not from the booklet formulas the lesson quotes, and the
reverse problems are solved as equations. The one equation with no exact solution (a segment's angle) is solved
numerically to 50 digits, after checking the area grows with the angle so the root is the only one.
"""
import sys
from pathlib import Path

from sympy import Rational, diff, cos, nsolve, pi, simplify, sin, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, check_rounded, parse_answer, parse_with_unit  # noqa: E402

r, t = symbols("r theta", positive=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_with_unit(tex, truth, unit):
    published = parse_answer(parse_with_unit(tex, unit))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def to_radians(degrees):
    return Rational(degrees) * pi / 180


def to_degrees(radians):
    return radians * 180 / pi


def arc(radius, angle):
    """Arc as the fraction angle / (2 pi) of the circumference 2 pi r."""
    return angle / (2 * pi) * 2 * pi * radius


def sector(radius, angle):
    """Sector area as the fraction angle / (2 pi) of the circle's area pi r^2."""
    return angle / (2 * pi) * pi * radius**2


def triangle(a, b, angle):
    return Rational(1, 2) * a * b * sin(angle)


def reverse_r_theta():
    """Arc 8 and area 36: solve both equations for r and theta."""
    (sol,) = solve([arc(r, t) - 8, sector(r, t) - 36], [r, t], dict=True)
    return {"r": sol[r], "\\theta": sol[t]}


def reverse_area():
    """Angle 0.4 and arc 6: r from the arc equation, then the area."""
    angle = Rational(2, 5)
    (radius,) = solve(arc(r, angle) - 6, r)
    return sector(radius, angle)


def major_sector():
    """Radius 10, minor angle 0.8: the major angle is 2 pi - 0.8. Cross-check: whole circle minus minor sector."""
    minor = Rational(4, 5)
    major = sector(10, 2 * pi - minor)
    assert simplify(major - (pi * 10**2 - sector(10, minor))) == 0
    return major


def segment_angle():
    """24.5(theta - sin theta) = 10. The area's derivative 24.5(1 - cos theta) is >= 0, so there is one root in ]0, 2pi[."""
    area = sector(7, t) - triangle(7, 7, t)
    assert simplify(diff(area, t) - Rational(49, 2) * (1 - cos(t))) == 0
    root = nsolve(area - 10, t, 1.4, prec=50)
    assert 0 < root < pi  # a minor segment
    return root


CHECKS = {
    "before-circle-fraction": lambda tex: same(tex, Rational(90, 360) * pi * 4**2),
    "before-triangle-area": lambda tex: same(tex, triangle(6, 10, to_radians(30))),
    "ex-deg-rad-exact": lambda tex: same(tex, to_radians(240)),
    "ex-deg-rad-decimal": lambda tex: check_rounded(tex, to_radians(50), sf=3),
    "check-convert-315": lambda tex: same(tex, to_radians(315)),
    "check-convert-7pi12": lambda v, tolerance: check_numeric(v, to_degrees(7 * pi / 12), sf=3, tolerance=tolerance),
    "ex-sector-exact": lambda tex: check_assignments(
        tex, {"l": arc(6, 2 * pi / 3), "P": 2 * 6 + arc(6, 2 * pi / 3)}
    ),
    "ex-sector-degrees": lambda tex: same_with_unit(tex, sector(8, to_radians(135)), "cm^2"),
    "check-arc-length": lambda tex: same(tex, arc(12, 5 * pi / 6)),
    "ex-major-sector": lambda tex: same_with_unit(tex, major_sector(), "cm^2"),
    "check-sector-area": lambda v, tolerance: check_numeric(v, sector(Rational(15, 2), Rational(11, 5)), sf=3, tolerance=tolerance),
    "ex-reverse-r-theta": lambda tex: check_assignments(tex, reverse_r_theta()),
    "check-reverse-area": lambda tex: same(tex, reverse_area()),
    "ex-segment-quarter": lambda tex: same_with_unit(tex, sector(4, pi / 2) - triangle(4, 4, pi / 2), "cm^2"),
    "ex-segment-solve": lambda tex: check_rounded(tex, segment_angle(), sf=3),
    "check-segment-area": lambda v, tolerance: check_numeric(
        v, sector(Rational(17, 2), Rational(19, 10)) - triangle(Rational(17, 2), Rational(17, 2), Rational(19, 10)), sf=3, tolerance=tolerance
    ),
    "check-wiper": lambda v, tolerance: check_numeric(
        v, sector(55, to_radians(110)) - sector(15, to_radians(110)), sf=3, tolerance=tolerance
    ),
}

NUMERIC = {
    "check-convert-7pi12": {"sf": 3},
    "check-sector-area": {"sf": 3},
    "check-segment-area": {"sf": 3},
    "check-wiper": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
