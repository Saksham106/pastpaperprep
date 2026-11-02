"""SymPy assertions for lesson 3.1 (3D distance, midpoint and measurement). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built from the question's own data: distances from the 3D distance formula, midpoints by averaging,
volumes and areas from the solid formulas with slant heights found by Pythagoras, and angles from the sides of the
right-angled triangle each question names (converted to degrees). Nothing below types in a final answer.
"""
import sys
from pathlib import Path

from sympy import Poly, Rational, S, asin, atan, pi, real_roots, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, parse_answer, parse_degrees, parse_list, parse_point, parse_with_unit,
)

x, k, a, b, c = symbols("x k a b c")


def deg(angle):
    return angle * 180 / pi


def dist(p, q):
    return sqrt(sum((S(u) - S(v)) ** 2 for u, v in zip(p, q)))


def midpoint(p, q):
    return [(S(u) + S(v)) / 2 for u, v in zip(p, q)]


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_with_unit(tex, truth, unit):
    """An exact value followed by a unit, e.g. `A = 90\\pi\\text{ cm}^{2}`."""
    published = parse_answer(parse_with_unit(tex, unit))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published} is not {truth}")


def same_degrees(tex, truth):
    published = parse_degrees(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} degrees is not {truth}")


def roots_are(tex, equation, var):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truth = sorted(solve(equation, var), key=lambda r: float(r))
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


# --- before ----------------------------------------------------------------------------------------------------------
def before_sine_angle(tex):
    # sin(theta) = opposite / hypotenuse = 5 / 8
    check_rounded(tex, deg(asin(Rational(5, 8))), sf=3, unit="°")


# --- distance and midpoint ---------------------------------------------------------------------------------------------
def distance_find_k(tex):
    # AB^2 = 13^2 with A(1, k, 3), B(4, 2, -1)
    roots_are(tex, dist((1, k, 3), (4, 2, -1)) ** 2 - 13**2, k)


# --- solids ------------------------------------------------------------------------------------------------------------
def cone_total_surface(r, h):
    slant = sqrt(r**2 + h**2)
    return pi * r * slant + pi * r**2


def pyramid_total_surface(side, height):
    # each triangular face's height runs from the apex to the middle of a base edge, side/2 from the centre
    face_height = sqrt(S(height) ** 2 + (S(side) / 2) ** 2)
    return S(side) ** 2 + 4 * Rational(1, 2) * side * face_height


def ornament_side():
    """Positive real root of cube + pyramid volume = 400: x^3 + (1/3) x^2 (6) = 400."""
    volume = x**3 + Rational(1, 3) * x**2 * 6 - 400
    roots = [r for r in real_roots(Poly(volume, x)) if r > 0]
    assert len(roots) == 1
    return roots[0]


# --- triangles inside solids -------------------------------------------------------------------------------------------
def pyramid_height(side, edge):
    half_diagonal = sqrt(S(side) ** 2 + S(side) ** 2) / 2
    return sqrt(S(edge) ** 2 - half_diagonal**2)


def rect_pyramid_edge(length, width, height):
    half_diagonal = sqrt(S(length) ** 2 + S(width) ** 2) / 2
    return sqrt(half_diagonal**2 + S(height) ** 2)


# --- angles ------------------------------------------------------------------------------------------------------------
def angle_with_base(length, width, height):
    """Angle between a cuboid's space diagonal and its base: tan = height / base diagonal."""
    return deg(atan(S(height) / sqrt(S(length) ** 2 + S(width) ** 2)))


def angle_with_xy_plane(p, q):
    """p lies in the xy-plane; sin = vertical rise / length of the segment."""
    assert S(p[2]) == 0
    return deg(asin((S(q[2]) - S(p[2])) / dist(p, q)))


CHECKS = {
    "before-pythagoras": lambda tex: same(tex, sqrt(7**2 + 24**2)),
    "before-sine-angle": before_sine_angle,
    "before-circle-area": lambda tex: same(tex, pi * (Rational(10, 2)) ** 2),
    "ex-distance-3d": lambda tex: same(tex, dist((2, -1, 5), (-4, 1, 2))),
    "check-midpoint-3d": lambda tex: same_point(tex, midpoint((-3, 7, 2), (5, -1, -6))),
    "ex-distance-find-k": distance_find_k,
    "check-distance-3d": lambda tex: same(tex, dist((3, 0, -2), (-1, 5, 1))),
    "ex-cone-surface": lambda tex: same_with_unit(tex, cone_total_surface(5, 12), "cm^2"),
    "ex-pyramid-surface": lambda tex: same_with_unit(tex, pyramid_total_surface(6, 4), "cm^2"),
    "check-pyramid-volume": lambda v, tolerance: check_numeric(
        v, Rational(1, 3) * 6**2 * 4, sf=3, tolerance=tolerance),
    # the two points are the ends of a diameter of the flat face: r is half their distance; V is half a sphere's
    "check-hemisphere-diameter-volume": lambda tex: same(
        tex, Rational(1, 2) * Rational(4, 3) * pi * (dist((1, 2, -3), (7, -2, 9)) / 2) ** 3),
    "ex-ornament-gdc": lambda tex: check_rounded(tex, ornament_side(), sf=3, unit="cm"),
    "ex-box-diagonal": lambda tex: same_with_unit(tex, dist((0, 0, 0), (4, 4, 7)), "cm"),
    "ex-pyramid-height": lambda tex: same_with_unit(tex, pyramid_height(8, 9), "cm"),
    "check-rect-pyramid-edge": lambda tex: same(tex, rect_pyramid_edge(24, 18, 8)),
    "ex-cuboid-angle-base": lambda tex: same_degrees(tex, angle_with_base(4, 3, 5)),
    "check-cuboid-angle": lambda tex: check_rounded(tex, angle_with_base(12, 5, 4), sf=3, unit="°"),
    # the height splits the vertex angle into two halves with tan(half) = radius / height
    "ex-cone-vertex-angle": lambda tex: check_rounded(tex, 2 * deg(atan(Rational(6, 8))), sf=3, unit="°"),
    # same split as above, for the 5 cm by 12 cm cone: tan(half) = radius / height
    "check-cone-vertex-angle": lambda tex: check_rounded(tex, 2 * deg(atan(Rational(5, 12))), sf=3, unit="°"),
    "ex-coords-angle-plane": lambda tex: check_rounded(tex, angle_with_xy_plane((-2, 1, 0), (4, -5, 7)), sf=3, unit="°"),
    # sin = VX / VC, with VX found from the edge and half the base diagonal
    "check-pyramid-edge-angle": lambda v, tolerance: check_numeric(
        v, deg(asin(pyramid_height(8, 9) / 9)), sf=3, tolerance=tolerance),
}

NUMERIC = {"check-pyramid-volume": {"sf": 3}, "check-pyramid-edge-angle": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
