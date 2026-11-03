"""SymPy assertions for lesson 3.3 (Applied triangle trigonometry). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

How the truths are computed, independently of the lesson's working:
- every triangle is placed in coordinates (x east, y north; heights as a separate vertical coordinate), built only
  from the question's data, and lengths and angles are read off the coordinates with Pythagoras and atan2;
- bearings are the clockwise angle from north, atan2(east, north), taken into [0, 360);
- the roof height is the distance of R from the line AB, with the triangle built from the two beams and the 98 degree
  angle at R, so no sine rule or cosine rule from the lesson is reused.
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, N, Rational, atan, atan2, cos, pi, simplify, sin, sqrt, tan

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer, parse_approx, parse_with_unit  # noqa: E402


def deg(a):
    return a * pi / 180


def to_deg(r):
    return r * 180 / pi


def step(start, bearing_deg, length):
    """The point `length` from `start` on a bearing, as (east, north)."""
    return start + length * Matrix([sin(deg(bearing_deg)), cos(deg(bearing_deg))])


def bearing_of(frm, to):
    d = to - frm
    b = to_deg(atan2(d[0], d[1]))
    return b + 360 if b.evalf() < 0 else b


def dist(p, q):
    return sqrt((p - q).dot(p - q))


ORIGIN = Matrix([0, 0])


def same(tex, truth, unit=None):
    published = parse_answer(parse_with_unit(tex, unit) if unit else tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def parts(tex, names):
    """Split a several-part answer `$a \\approx 1, \\; b \\approx 2$` into its pieces, each checked by name and order."""
    inner = tex.strip()
    if inner.startswith("$") and inner.endswith("$"):
        inner = inner[1:-1]
    pieces = [piece.strip() for piece in re.split(r",\s*\\;\s*", inner)]
    if len(pieces) != len(names):
        raise AssertionError(f"{tex!r} gives {len(pieces)} part(s), {len(names)} expected")
    for piece, name in zip(pieces, names):
        if not piece.startswith(name):
            raise AssertionError(f"part {piece!r} should start with {name!r}")
    return [f"${piece}$" for piece in pieces]


def angle_at(vertex, p, q):
    """The angle p-vertex-q in degrees, from the coordinates (atan2 of the cross and dot products)."""
    u, v = p - vertex, q - vertex
    return to_deg(atan2(abs(u[0] * v[1] - u[1] * v[0]), u.dot(v)))


def exact_degrees(tex, truth):
    """An exact angle in degrees that may carry leading zeros (a bearing such as 063 degrees)."""
    value, _, _, relation = parse_approx(tex, "°")
    if relation != "=":
        raise AssertionError(f"{tex!r} should be exact, not rounded")
    # The truth comes from atan2 of exact trig values, which SymPy can't always simplify, so compare to 40 digits.
    if abs(N(Rational(str(value)) - truth, 50)) > Rational(1, 10**40):
        raise AssertionError(f"published {value} is not {N(truth, 12)}")


# ------------------------------------------------------------------------------------------------------------ before

def right_ratio(tex):
    opposite, hyp = 20, 29
    adjacent = sqrt(hyp**2 - opposite**2)
    same(tex, opposite / adjacent)


def cosine_rule_side(tex):
    # X at the origin, XY along the x-axis, XZ at 120 degrees.
    Y = Matrix([11, 0])
    Z = 24 * Matrix([cos(deg(120)), sin(deg(120))])
    same(tex, dist(Y, Z))


def meet(p, u, q, v):
    """Where the ray p + s*u meets the ray q + t*v (Cramer's rule, no simplification)."""
    det = u[0] * (-v[1]) - (-v[0]) * u[1]
    rhs = q - p
    s = (rhs[0] * (-v[1]) - (-v[0]) * rhs[1]) / det
    return p + s * u


def sine_rule_side():
    # Q at the origin, R at (12, 0). P is where the ray from Q at 40 degrees meets the ray from R at 65 degrees
    # (the angle at R is 180 - 75 - 40). PR is read off the coordinates.
    R = Matrix([12, 0])
    P = meet(ORIGIN, Matrix([cos(deg(40)), sin(deg(40))]), R, Matrix([cos(deg(180 - 65)), sin(deg(180 - 65))]))
    return dist(P, R)


# ---------------------------------------------------------------------------------------------------------- diagrams

def path_length(tex):
    G = Matrix([0, 0, 0])
    H = Matrix([35, 0, 12])  # 35 m along the level, 12 m up
    same(tex, sqrt((H - G).dot(H - G)), "m")


def roof_height(tex):
    # R at the origin; A and B along directions 98 degrees apart.
    A = Rational(52, 10) * Matrix([cos(deg(0)), sin(deg(0))])
    B = Rational(38, 10) * Matrix([cos(deg(98)), sin(deg(98))])
    AB = B - A
    # Distance from R (origin) to line AB: |cross(A, AB)| / |AB|.
    height = abs(A[0] * AB[1] - A[1] * AB[0]) / sqrt(AB.dot(AB))
    span, rise = parts(tex, [r"\text{AB}", r"\text{RM}"])
    check_rounded(span, dist(A, B), sf=3, unit="m")  # part (a)
    check_rounded(rise, height, sf=3, unit="m")  # part (b)


def garden_side(tex):
    P = Matrix([7, 0])
    Q = 11 * Matrix([cos(deg(48)), sin(deg(48))])
    check_rounded(tex, dist(P, Q), sf=3, unit="m")


# --------------------------------------------------------------------------------------------- elevation, depression

def buoy_distance(tex):
    # Angle of depression 30 deg equals the elevation of T from B; height 45 over the horizontal distance.
    same(tex, 45 / tan(deg(30)), "m")


def drone_angle(tex):
    check_rounded(tex, to_deg(atan(Rational(20, 50))), sf=3, unit="°")


def buildings_height(tex):
    gap = 48 / tan(deg(28))
    top = 48 + gap * tan(deg(17))
    check_rounded(tex, top, sf=3, unit="m")


def tower_car(tex):
    check_rounded(tex, 60 / tan(deg(4)), sf=3, unit="m")


# ---------------------------------------------------------------------------------------------------------- bearings

def ship_bearing(tex):
    A = step(ORIGIN, 50, 12)
    B = step(A, 140, 9)
    # Part (a) is a "show that": the angle at A is 90 degrees, so the example's Pythagoras step is valid.
    HA, AB = ORIGIN - A, B - A
    if simplify(HA.dot(AB)) != 0:
        raise AssertionError("part (a): angle HAB is not 90 degrees")
    side_hb, bearing = parts(tex, [r"\text{HB}", r"\text{bearing}"])
    same(side_hb, dist(ORIGIN, B), "km")  # part (b)
    check_rounded(bearing, bearing_of(ORIGIN, B), sf=3, unit="°")  # part (c)


def yacht_bearing(tex):
    Q = step(ORIGIN, 75, 20)
    R = step(Q, 200, 14)
    angle_q, side_pr, bearing = parts(tex, [r"\text{P}\hat{\text{Q}}\text{R}", r"\text{PR}", r"\text{bearing}"])
    exact_degrees(angle_q, angle_at(Q, ORIGIN, R))  # part (a)
    check_rounded(side_pr, dist(ORIGIN, R), sf=3, unit="km")  # part (b)
    check_rounded(bearing, bearing_of(ORIGIN, R), sf=3, unit="°")  # part (c)


def back_bearing(tex):
    B = step(ORIGIN, 297, 1)
    exact_degrees(tex, bearing_of(B, ORIGIN))


def angle_abc():
    A = ORIGIN
    B = step(A, 35, 1)
    C = step(B, 160, 1)
    return angle_at(B, A, C)


def tower_elevation(tex):
    F = step(ORIGIN, 40, 600)
    B = step(ORIGIN, 110, 450)
    side_fb, elevation = parts(tex, [r"\text{FB}", r"\theta"])
    check_rounded(side_fb, dist(F, B), sf=3, unit="m")  # part (a)
    check_rounded(elevation, to_deg(atan(85 / dist(F, B))), sf=3, unit="°")  # part (b)


CHECKS = {
    "before-right-ratio": right_ratio,
    "before-cosine-rule": cosine_rule_side,
    "before-sine-rule": lambda v, tolerance: check_numeric(v, sine_rule_side(), sf=3, tolerance=tolerance),
    "ex-diagram-path": path_length,
    "check-ladder": lambda v, tolerance: check_numeric(v, sqrt(Rational(65, 10) ** 2 - 6**2), sf=3, tolerance=tolerance),
    "ex-diagram-roof": roof_height,
    "check-garden-side": garden_side,
    "ex-depression-buoy": buoy_distance,
    "check-drone-angle": drone_angle,
    "ex-elevation-buildings": buildings_height,
    "check-tower-car": tower_car,
    "ex-bearing-right-angle": ship_bearing,
    "check-back-bearing": back_bearing,
    "ex-bearing-cosine": yacht_bearing,
    "check-bearing-angle": lambda v, tolerance: check_numeric(v, angle_abc(), sf=3, tolerance=tolerance),
    "ex-tower-bearing": tower_elevation,
}

NUMERIC = {
    "before-sine-rule": {"sf": 3},
    "check-bearing-angle": {"sf": 3},
    "check-ladder": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
