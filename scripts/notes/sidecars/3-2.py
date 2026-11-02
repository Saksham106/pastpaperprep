"""SymPy assertions for lesson 3.2 (triangle trigonometry). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data. Lengths and angles found with the sine or cosine rule are
cross-checked by building the triangle in coordinates (vertex at the origin, one side on the x-axis) and measuring it,
so the rule used in the lesson is not the only evidence. Angles are in degrees throughout.
"""
import sys
from pathlib import Path

from sympy import Matrix, Rational, acos, asin, atan, cos, pi, simplify, sin, solve, sqrt, symbols, tan

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

x = symbols("x")


def rad(degrees):
    return degrees * pi / 180


def deg(radians):
    return radians * 180 / pi


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def sas_triangle(p, q, angle):
    """Corners of the triangle with sides p and q meeting at `angle` (degrees) at the origin: O, P on the x-axis, Q."""
    return Matrix([0, 0]), Matrix([p, 0]), Matrix([q * cos(rad(angle)), q * sin(rad(angle))])


def third_side(p, q, angle):
    """Measured in coordinates, then compared with the cosine rule."""
    _, P, Q = sas_triangle(p, q, angle)
    measured = (P - Q).norm()
    by_rule = sqrt(p**2 + q**2 - 2 * p * q * cos(rad(angle)))
    assert abs(float(measured - by_rule)) < 1e-12
    return measured


def area_sas(p, q, angle):
    """Shoelace area of the coordinate triangle, compared with 1/2 pq sin C."""
    O, P, Q = sas_triangle(p, q, angle)
    shoelace = abs((P[0] - O[0]) * (Q[1] - O[1]) - (Q[0] - O[0]) * (P[1] - O[1])) / 2
    assert abs(float(shoelace - Rational(1, 2) * p * q * sin(rad(angle)))) < 1e-12
    return shoelace


def angle_between(U, V):
    """Angle in degrees between two vectors in coordinates."""
    return deg(acos(U.dot(V) / (U.norm() * V.norm())))


def angle_from_sides(a, b, c):
    """Angle (degrees) opposite c in the triangle with sides a, b, c, measured in coordinates: put a on the x-axis,
    find the third corner from the two circle equations, then measure the angle at the origin."""
    px, py = symbols("px py", real=True)
    corners = solve([px**2 + py**2 - b**2, (px - a) ** 2 + py**2 - c**2], [px, py], dict=True)
    corner = [s for s in corners if s[py] > 0][0]
    return angle_between(Matrix([a, 0]), Matrix([corner[px], corner[py]]))


def cos_from_sides(a, b, c):
    """Exact cosine of the angle opposite c, from the coordinate corner (x-coordinate over the radius b)."""
    px, py = symbols("px py", real=True)
    corners = solve([px**2 + py**2 - b**2, (px - a) ** 2 + py**2 - c**2], [px, py], dict=True)
    return simplify(corners[0][px] / b)


# ex-sine-angle: KL = 12 faces M = 64, LM = 9 faces K (acute since 9 < 12); KM faces L.
K_ANGLE = deg(asin(9 * sin(rad(64)) / 12))
L_ANGLE = 180 - 64 - K_ANGLE
KM = 12 * sin(rad(L_ANGLE)) / sin(rad(64))
# Cross-check: rebuild the triangle at M from MK and ML = 9 with angle 64 and confirm KL = 12.
assert abs(float(third_side(KM, 9, 64) - 12)) < 1e-12

# ex-area-solve: 1/2 x (x + 4) sin 65 = 30, positive root.
AREA_ROOTS = solve(Rational(1, 2) * x * (x + 4) * sin(rad(65)) - 30, x)
AREA_X = [r for r in AREA_ROOTS if r.evalf() > 0]
assert len(AREA_X) == 1

# ex-choose-quad: AC from triangle ABC, CD by the sine rule in ACD, total area.
QUAD_AC = third_side(9, 6, 104)
QUAD_CD = QUAD_AC * sin(rad(47)) / sin(rad(71))
QUAD_AD = QUAD_AC * sin(rad(62)) / sin(rad(71))
# Cross-check: in coordinates (A at the origin, AC on the x-axis), D sits at angle 47 from AC at distance AD, and the
# angle at D between DA and DC must come out as 71 degrees.
_D = Matrix([QUAD_AD * cos(rad(47)), QUAD_AD * sin(rad(47))])
_C = Matrix([QUAD_AC, 0])
assert abs(float(angle_between(-_D, _C - _D) - 71)) < 1e-9
assert abs(float((_C - _D).norm() - QUAD_CD)) < 1e-12
QUAD_AREA = area_sas(9, 6, 104) + area_sas(QUAD_AC, QUAD_CD, 62)

# check-choose-area: PQ = 10, P = 40, Q = 75; PR faces Q.
PR = 10 * sin(rad(75)) / sin(rad(65))
CHOOSE_AREA = area_sas(10, PR, 40)

# check-area-sides: AB = 8, BC = 11, angle B = 82.
AREA_SIDES = area_sas(8, 11, 82)

# ex-choose-sss: Heron's formula as an independent truth for sides 4, 7, 9.
_s = Rational(4 + 7 + 9, 2)
HERON_479 = sqrt(_s * (_s - 4) * (_s - 7) * (_s - 9))

# ex-area-exact: tan(theta) = 12/5, theta acute, sides 6 and 7.
AREA_TAN = Rational(1, 2) * 6 * 7 * sin(atan(Rational(12, 5)))


CHECKS = {
    "before-pythagoras": lambda v, tolerance: check_numeric(v, sqrt(17**2 - 8**2), sf=3, tolerance=tolerance),
    "before-inverse": lambda v, tolerance: check_numeric(v, solve(3 * x - 4 - 11, x)[0], sf=3, tolerance=tolerance),
    # QR is opposite the 35 degree angle, PR = 14 is the hypotenuse.
    "ex-right-side": lambda tex: check_rounded(tex, 14 * sin(rad(35)), sf=3, unit="cm"),
    # Angle at X: opposite YZ = 4, adjacent XY = 7; measured as the angle between XY and XZ in coordinates.
    "ex-right-angle": lambda tex: check_rounded(tex, angle_between(Matrix([7, 0]), Matrix([7, 4])), sf=3, unit="°"),
    "check-right-hyp": lambda v, tolerance: check_numeric(v, Rational(63, 10) / sin(rad(52)), sf=3, tolerance=tolerance),
    "ex-right-exact": lambda tex: same(tex, tan(asin(Rational(3, 7)))),
    "check-right-angle": lambda tex: check_rounded(tex, deg(acos(Rational(6, 10))), sf=3, unit="°"),
    # b faces B = 71, a = 9 faces A = 48.
    "ex-sine-side": lambda tex: check_rounded(tex, 9 * sin(rad(71)) / sin(rad(48)), sf=3, unit="cm"),
    "check-sine-side": lambda v, tolerance: check_numeric(v, 15 * sin(rad(33)) / sin(rad(102)), sf=3, tolerance=tolerance),
    "ex-sine-angle": lambda tex: check_rounded(tex, KM, sf=3, unit="cm"),
    # a = 7 < b = 10, so A is acute.
    "check-sine-angle": lambda tex: check_rounded(tex, deg(asin(7 * sin(rad(80)) / 10)), sf=3, unit="°"),
    "ex-cosine-side": lambda tex: check_rounded(tex, third_side(8, 11, 52), sf=3, unit="cm"),
    "ex-cosine-angle": lambda tex: check_rounded(tex, angle_from_sides(6, 10, 13), sf=3, unit="°"),
    "check-cosine-side": lambda v, tolerance: check_numeric(
        v, third_side(Rational(52, 10), Rational(75, 10), 38), sf=3, tolerance=tolerance),
    "check-cosine-exact": lambda tex: same(tex, cos_from_sides(3, 5, 7)),
    "ex-area-exact": lambda tex: same(tex, AREA_TAN),
    "check-area-sides": lambda tex: check_rounded(tex, AREA_SIDES, sf=3, unit="cm^2"),
    "ex-area-solve": lambda tex: check_rounded(tex, AREA_X[0], sf=3),
    "check-area-obtuse": lambda v, tolerance: check_numeric(v, area_sas(12, Rational(55, 10), 128), sf=3, tolerance=tolerance),
    "ex-choose-sss": lambda tex: same(tex, HERON_479),
    "ex-choose-quad": lambda tex: check_rounded(tex, QUAD_AREA, sf=3, unit="cm^2"),
    "check-choose-area": lambda v, tolerance: check_numeric(v, CHOOSE_AREA, sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-pythagoras": {"sf": 3},
    "before-inverse": {"sf": 3},
    "check-right-hyp": {"sf": 3},
    "check-sine-side": {"sf": 3},
    "check-cosine-side": {"sf": 3},
    "check-area-obtuse": {"sf": 3},
    "check-choose-area": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
