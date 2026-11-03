"""SymPy assertions for lesson 3.17 (Vector equations of planes). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every true plane is built from the question's own data: directions from differences of points, normals from the
vector product of two directions (or read from a given equation's coefficients), the constant from a point on the
plane. A published plane in vector form passes only if its two directions are non-parallel, both perpendicular to the
true normal, and its point lies on the true plane, so any equivalent vector equation is accepted and nothing else.
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, S, linsolve, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_same_equation, parse_answer, parse_point, parse_vector  # noqa: E402

x, y, z, k, lam, mu, a, b, c = symbols("x y z k lambda mu a b c")
XYZ = Matrix([x, y, z])

_VEC = r"\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}"


def vec(*entries):
    return Matrix([S(e) for e in entries])


def _entries(body, tex):
    parts = [part.strip() for part in body.split("\\\\")]
    if len(parts) != 3 or any(not part for part in parts):
        raise ValueError(f"{tex!r} has a vector without three components")
    return Matrix([parse_answer(part) for part in parts])


def parse_plane_vector(tex):
    """(point, b, c) of `\\boldsymbol{r} = (point) + \\lambda (b) + \\mu (c)`."""
    body = tex.strip().strip("$").strip()
    match = re.fullmatch(r"\\boldsymbol\{r\}\s*=\s*" + _VEC + r"\s*\+\s*\\lambda\s*" + _VEC + r"\s*\+\s*\\mu\s*" + _VEC, body, re.S)
    if not match:
        raise ValueError(f"{tex!r} is not of the form r = a + lambda b + mu c")
    return tuple(_entries(group, tex) for group in match.groups())


def parse_plane_normal(tex):
    """(n, d) of `\\boldsymbol{r} \\cdot (n) = d`."""
    body = tex.strip().strip("$").strip()
    match = re.fullmatch(r"\\boldsymbol\{r\}\s*\\cdot\s*" + _VEC + r"\s*=\s*(.+)", body, re.S)
    if not match:
        raise ValueError(f"{tex!r} is not of the form r . n = d")
    return _entries(match.group(1), tex), parse_answer(match.group(2))


def same_plane_vector(tex, normal, point):
    """Published r = p + lambda b + mu c is the plane through `point` with normal `normal`."""
    p, d1, d2 = parse_plane_vector(tex)
    if Matrix.hstack(d1, d2).rank(simplify=True) != 2:
        raise AssertionError(f"directions {list(d1)} and {list(d2)} are parallel (or zero): not a plane")
    for d in (d1, d2):
        if simplify(d.dot(normal)) != 0:
            raise AssertionError(f"direction {list(d)} does not lie in the plane with normal {list(normal)}")
    if simplify((p - point).dot(normal)) != 0:
        raise AssertionError(f"point {list(p)} is not on the plane")


def same_plane_normal(tex, normal, point):
    """Published r . n = d is the plane through `point` with normal `normal` (any non-zero multiple)."""
    n, d = parse_plane_normal(tex)
    if all(simplify(e) == 0 for e in n):
        raise AssertionError("zero normal")
    if Matrix.hstack(n, normal).rank(simplify=True) != 1:
        raise AssertionError(f"normal {list(n)} is not parallel to {list(normal)}")
    if simplify(d - n.dot(point)) != 0:
        raise AssertionError(f"right-hand side {d} is not {n.dot(point)}")


def same_cartesian(tex, normal, point):
    check_same_equation(tex, normal.dot(XYZ) - normal.dot(point))


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


def perpendicular_vector(tex, other):
    published = Matrix(parse_vector(tex))
    if all(simplify(e) == 0 for e in published):
        raise AssertionError("zero vector")
    if simplify(published.dot(other)) != 0:
        raise AssertionError(f"{published.T} . {list(other)} is not 0")


def normal_from_cartesian(lhs, rhs):
    """Coefficients of x, y, z in lhs - rhs, read independently of how the equation was written."""
    expr = (lhs - rhs).expand()
    return Matrix([expr.coeff(v) for v in (x, y, z)]), -expr.subs({x: 0, y: 0, z: 0})


# --- question data -------------------------------------------------------------------------------------------------
D, E, F = vec(1, 2, -1), vec(4, 0, 1), vec(2, 5, 0)
N_DEF = (E - D).cross(F - D)
A3, B3, C3 = vec(2, 0, -3), vec(5, 1, -1), vec(0, 4, -2)
L_POINT, L_DIR, G = vec(1, -2, 0), vec(2, 1, 1), vec(3, 1, 4)
GA, GB, GC = vec(1, 2, 2), vec(5, 0, 2), vec(-2, 1, 4)
PERP_LINE_POINT, PERP_LINE_DIR, PERP_B = vec(3, 0, 2), vec(2, -1, 5), vec(0, 3, -1)


def plane_point(tex):
    p, b1, c1 = vec(3, -1, 2), vec(1, 0, 2), vec(0, 1, -1)
    same_point(tex, list(p + 2 * b1 - 3 * c1))


def point_on_plane_k(tex):
    general = D + lam * (E - D) + mu * (F - D)
    sol = solve([general[0] - 6, general[1] + 5], [lam, mu], dict=True)[0]
    truth = general[2].subs(sol)
    value = parse_answer(tex)
    if simplify(value - truth) != 0:
        raise AssertionError(f"published k = {value} is not {truth}")


def plane_gdc(tex):
    # Independent route: solve a x + b y + c z = 1 through the three points (the GDC method), then compare.
    sol = linsolve([a * P[0] + b * P[1] + c * P[2] - 1 for P in (GA, GB, GC)], [a, b, c])
    (coeffs,) = list(sol)
    check_same_equation(tex, coeffs[0] * x + coeffs[1] * y + coeffs[2] * z - 1)
    # and the vector-product route agrees
    n = (GB - GA).cross(GC - GA)
    same_cartesian(tex, n, GA)


def read_normal(tex):
    # 4y - x = 2z + 3
    n, _ = normal_from_cartesian(4 * y - x, 2 * z + 3)
    parallel_vector(tex, n)


def point_on_plane_numeric(value, tolerance):
    n, d = normal_from_cartesian(5 * x - 3 * y + 2 * z, 4)
    truth = solve(n.dot(vec(k, 2, -1)) - d, k)[0]
    check_numeric(value, truth, sf=3, tolerance=tolerance)


def cartesian_to_vector(tex, lhs, rhs):
    n, d = normal_from_cartesian(lhs, rhs)
    # a point on the plane: solve for x with y = z = 0 when possible, otherwise y
    if n[0] != 0:
        point = vec(d / n[0], 0, 0)
    else:
        point = vec(0, d / n[1], 0)
    same_plane_vector(tex, n, point)


CHECKS = {
    "before-line-direction": lambda tex: parallel_vector(tex, vec(-1, 3, 4) - vec(2, 5, -1)),
    "before-perpendicular": lambda tex: perpendicular_vector(tex, vec(3, -2, 1)),
    "before-cross-product": lambda tex: same_vector(tex, list(vec(2, 1, 0).cross(vec(1, -1, 3)))),
    # section 1
    "ex-plane-point-two-dirs": plane_point,
    "ex-plane-three-points": lambda tex: same_plane_vector(tex, N_DEF, D),
    "ex-point-on-plane-k": point_on_plane_k,
    "check-plane-three-points": lambda tex: same_plane_vector(tex, (B3 - A3).cross(C3 - A3), A3),
    "check-plane-containing-line": lambda tex: same_plane_vector(tex, L_DIR.cross(G - L_POINT), G),
    # section 2
    "ex-normal-form-basic": lambda tex: same_plane_normal(tex, vec(4, 1, -2), vec(2, -3, 1)),
    "ex-normal-three-points": lambda tex: same_plane_normal(tex, N_DEF, D),
    "check-normal-constant": lambda v, tolerance: check_numeric(v, vec(4, -1, 2).dot(vec(1, 4, -3)), sf=3, tolerance=tolerance),
    # a plane perpendicular to a line has the line's direction as its normal; B is the point on the plane
    "check-plane-perp-line": lambda tex: same_plane_normal(tex, PERP_LINE_DIR, PERP_B),
    # section 3
    "ex-cartesian-point-normal": lambda tex: same_cartesian(tex, vec(3, -2, 5), vec(-1, 4, 2)),
    "ex-parallel-plane": lambda tex: same_cartesian(tex, normal_from_cartesian(2 * x - 5 * y + z, 7)[0], vec(3, 1, -4)),
    "check-read-normal": read_normal,
    "check-point-on-plane-k": point_on_plane_numeric,
    # section 4
    "ex-vector-to-cartesian": lambda tex: same_cartesian(tex, vec(1, 2, 0).cross(vec(3, -1, 1)), vec(2, 0, -1)),
    "ex-cartesian-to-vector": lambda tex: cartesian_to_vector(tex, x - 2 * y + 3 * z, 6),
    "check-vector-to-cartesian": lambda tex: same_cartesian(tex, vec(2, 0, 1).cross(vec(1, 1, -2)), vec(1, -1, 3)),
    "check-cartesian-to-vector": lambda tex: cartesian_to_vector(tex, 2 * x - y + z, 4),
    "ex-plane-gdc": plane_gdc,
}

NUMERIC = {
    "check-normal-constant": {"sf": 3},
    "check-point-on-plane-k": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
