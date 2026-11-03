"""SymPy assertions for lesson 3.14 (Vector equations of lines). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built from the question's own data: directions from differences of points, Cartesian equations solved
part by part for the parameter, angles from the scalar product of direction vectors, speeds from magnitudes and the
closest approach by minimising the squared distance with calculus. Nothing below types in a final answer.
"""
import sys
from pathlib import Path

from sympy import Matrix, Rational, S, Symbol, acos, diff, pi, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_equation, check_same_line, parse_answer, parse_degrees, parse_point,
    parse_vector, parse_vector_line, parse_with_unit,
)

x, y, z, t, k, lam = symbols("x y z t k lambda")


def vec(*entries):
    return Matrix([S(e) for e in entries])


def direction_from_cartesian(parts, variables):
    """Set each Cartesian part equal to lambda, solve for its coordinate, and read off (point, direction)."""
    coords = [solve(part - lam, var)[0] for part, var in zip(parts, variables)]
    point = [c.subs(lam, 0) for c in coords]
    direction = [diff(c, lam) for c in coords]
    return point, direction


def acute_angle_degrees(b1, b2):
    b1, b2 = Matrix(b1), Matrix(b2)
    return acos(abs(b1.dot(b2)) / (b1.norm() * b2.norm())) * 180 / pi


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_degrees(tex, truth):
    published = parse_degrees(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} degrees is not {truth}")


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published} is not {list(truth)}")


def same_vector(tex, truth):
    published = parse_vector(tex)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published} is not {list(truth)}")


def parallel_vector(tex, truth):
    published = Matrix(parse_vector(tex))
    if published.shape != Matrix(truth).shape or all(simplify(e) == 0 for e in published):
        raise AssertionError(f"{published.T} is not a non-zero vector of the right size")
    if Matrix.hstack(published, Matrix(truth)).rank(simplify=True) != 1:
        raise AssertionError(f"{published.T} is not parallel to {list(truth)}")


def exact_motion(tex, start, velocity):
    """A motion equation must have exactly this start and this velocity (a parallel direction is a different speed)."""
    point, direction = parse_vector_line(tex)
    if any(simplify(p - q) != 0 for p, q in zip(point, start)) or len(point) != len(start):
        raise AssertionError(f"start {point} is not {list(start)}")
    if any(simplify(d - v) != 0 for d, v in zip(direction, velocity)) or len(direction) != len(velocity):
        raise AssertionError(f"velocity {direction} is not {list(velocity)}")


def same_cartesian_line(tex, point, direction):
    """`(x - x0)/l = (y - y0)/m = (z - z0)/n`: substitute the true parametric point; every part must give the same
    non-constant function of the parameter, so the published equations describe exactly the true line."""
    body = tex.strip().strip("$")
    depth, cuts = 0, []
    for i, ch in enumerate(body):
        depth += ch == "{"
        depth -= ch == "}"
        if ch == "=" and depth == 0:
            cuts.append(i)
    pieces = [body[a + 1:b] for a, b in zip([-1] + cuts, cuts + [len(body)])]
    if len(pieces) != len(point):
        raise AssertionError(f"{tex!r} has {len(pieces)} parts, expected {len(point)}")
    exprs = [parse_answer(piece) for piece in pieces]
    names = [x, y, z][: len(point)]
    exprs = [e.subs({s: Symbol(s.name) for s in e.free_symbols}) for e in exprs]
    on_line = {var: S(p) + t * S(d) for var, p, d in zip(names, point, direction)}
    values = [simplify(e.subs(on_line)) for e in exprs]
    for e, var in zip(exprs, names):
        if e.free_symbols != {var}:
            raise AssertionError(f"part {e} should involve only {var}")
    if any(not v.has(t) for v in values) or any(simplify(v - values[0]) != 0 for v in values[1:]):
        raise AssertionError(f"parts give {values} on the true line, not one common parameter")


# --- the data of each question -------------------------------------------------------------------------------------
P, Q = vec(4, 0, -3), vec(1, 5, -1)
C, D = vec(2, -1, 3), vec(0, 4, 1)
ANGLE_P2 = direction_from_cartesian([(x - 5) / 2, 4 - y, (z + 1) / 2], [x, y, z])[1]
SHIP_A = (vec(2, 9), vec(5, -1))
SHIP_B = (vec(-4, 1), vec(7, 3))


def x_axis_crossing(tex):
    a, b = vec(-3, 2), vec(5, -2)
    point = a + lam * b
    root = solve(point[1], lam)[0]
    same_point(tex, list(point.subs(lam, root)))


def two_parts(tex):
    """Split a two-part answer `first, \\; second` at its one top-level comma (outside any bracket)."""
    body = tex.strip().strip("$")
    depth, cuts = 0, []
    for i, ch in enumerate(body):
        depth += ch in "{(["
        depth -= ch in "})]"
        if ch == "," and depth == 0:
            cuts.append(i)
    if len(cuts) != 1:
        raise ValueError(f"{tex!r} should hold exactly two parts separated by one comma")
    first, second = body[: cuts[0]], body[cuts[0] + 1:]
    return first.strip(), second.replace("\\;", " ").strip()


def on_line(point, a, b):
    """True when some single lambda gives `point` from a + lambda*b in every component."""
    sols = solve([a[i] + lam * b[i] - point[i] for i in range(len(point))], lam, dict=True)
    return bool(sols)


def membership(statement, truth_on_line):
    """`\\mathrm{R} \\in L` or `\\mathrm{R} \\notin L`: it must name the true case."""
    compact = statement.replace(" ", "")
    if compact == "\\mathrm{R}\\notinL":
        published = False
    elif compact == "\\mathrm{R}\\inL":
        published = True
    else:
        raise ValueError(f"cannot read {statement!r} as R in L or R not in L")
    if published != truth_on_line:
        raise AssertionError(f"published R on L = {published}, truth {truth_on_line}")


def line_and_point_r(tex):
    line, statement = two_parts(tex)
    check_same_line(f"${line}$", list(P), list(Q - P))
    membership(statement, on_line(vec(-5, 15, 1), P, Q - P))


def boat_speed_and_time(tex):
    speed_part, time_part = two_parts(tex)
    a, v = vec(-9, 4), vec(6, 8)
    name = speed_part.split("=")[0].replace(" ", "")
    if name != "\\lvert\\boldsymbol{v}\\rvert":
        raise AssertionError(f"first part names {name!r}, expected the speed |v|")
    speed = parse_answer(parse_with_unit(f"${speed_part}$", "km h^-1"))
    if simplify(speed - v.norm()) != 0:
        raise AssertionError(f"published speed {speed} is not {v.norm()}")
    if not time_part.replace(" ", "").startswith("t="):
        raise AssertionError(f"second part {time_part!r} should give t")
    same(f"${time_part}$", solve(a[0] + t * v[0], t)[0])


def point_on_line_k(value, tolerance):
    a, b = vec(1, -2, 5), vec(3, 3, -2)
    lam_y = solve(a[1] + lam * b[1] - 7, lam)[0]
    if simplify(a[2] + lam_y * b[2] - (-1)) != 0:
        raise AssertionError("z does not agree: the point is not on the line for any k")
    check_numeric(value, a[0] + lam_y * b[0], sf=3, tolerance=tolerance)


def closest_approach(tex):
    gap = (SHIP_B[0] - SHIP_A[0]) + t * (SHIP_B[1] - SHIP_A[1])
    d2 = gap.dot(gap)
    t_min = [r for r in solve(diff(d2, t), t) if r >= 0][0]
    check_rounded(tex, sqrt(d2.subs(t, t_min)), sf=3, unit="km")


def velocity_from_speed(tex):
    heading = vec(4, -3)
    exact_motion(tex, vec(1, 2), 20 * heading / heading.norm())


CHECKS = {
    "before-displacement": lambda tex: same_vector(tex, vec(5, 1, 0) - vec(2, -1, 4)),
    "before-magnitude": lambda v, tolerance: check_numeric(v, vec(4, -4, 7).norm(), sf=3, tolerance=tolerance),
    "before-scalar-product": lambda v, tolerance: check_numeric(v, vec(1, -2, 4).dot(vec(3, 5, 1)), sf=3, tolerance=tolerance),
    # section 1
    "ex-line-2d-x-axis": x_axis_crossing,
    "ex-line-two-points-3d": line_and_point_r,
    "check-line-through-two-points": lambda tex: check_same_line(tex, list(C), list(D - C)),
    "check-point-on-line-k": point_on_line_k,
    # section 2
    "ex-vector-to-cartesian": lambda tex: same_cartesian_line(tex, [-4, 3, 1], [2, -5, 3]),
    "ex-cartesian-to-vector": lambda tex: check_same_line(tex, *direction_from_cartesian([(6 - x) / 3, (2 * y + 1) / 4, z + 2], [x, y, z])),
    "check-read-direction": lambda tex: parallel_vector(tex, direction_from_cartesian([(x - 2) / 3, (1 - y) / 4, (z + 5) / 2], [x, y, z])[1]),
    # 2D line through (1, 4) with direction (2, -6): y - 4 = (-6/2)(x - 1)
    "check-2d-cartesian": lambda tex: check_same_equation(tex, y - 4 - Rational(-6, 2) * (x - 1)),
    # section 3
    "ex-angle-exact": lambda tex: same_degrees(tex, acute_angle_degrees([2, 1, -2], [0, -1, 1])),
    "ex-angle-cartesian": lambda tex: check_rounded(tex, acute_angle_degrees(ANGLE_P2, [1, 4, -8]), sf=3, unit="°"),
    "check-perpendicular-k": lambda v, tolerance: check_numeric(v, solve(vec(k, 2, -1).dot(vec(3, k, 4)), k)[0], sf=3, tolerance=tolerance),
    "check-acute-angle": lambda tex: check_rounded(tex, acute_angle_degrees([1, 2, 2], [2, -2, -1]), sf=3, unit="°"),
    # section 4
    "ex-boat-due-north": boat_speed_and_time,
    "check-drone-distance": lambda v, tolerance: check_numeric(v, 5 * vec(2, -6, 3).norm(), sf=3, tolerance=tolerance),
    "check-velocity-from-speed": velocity_from_speed,
    "ex-closest-approach": closest_approach,
}

NUMERIC = {
    "before-magnitude": {"sf": 3},
    "before-scalar-product": {"sf": 3},
    "check-point-on-line-k": {"sf": 3},
    "check-perpendicular-k": {"sf": 3},
    "check-drone-distance": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
