"""SymPy assertions for lesson 3.18 (Intersections and angles of lines and planes). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built from the question's own data. Intersections come from linsolve on the plane equations (never from
the lesson's vector-product shortcut), arrangements of planes from the solution set plus a parallel-normals test,
parameter values from the condition that the right coefficients or minors vanish, and angles from the scalar product
of the direction and normal vectors. Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import EmptySet, Matrix, S, asin, acos, linsolve, pi, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded, check_same_line, parse_degrees, parse_point, parse_vector,
)

x, y, z, lam, k, d, m, a = symbols("x y z lambda k d m a")
XYZ = (x, y, z)


def vec(*entries):
    return Matrix([S(e) for e in entries])


def plane_eq(row):
    """(a, b, c, rhs) -> a x + b y + c z - rhs."""
    return S(row[0]) * x + S(row[1]) * y + S(row[2]) * z - S(row[3])


def normal(row):
    return vec(*row[:3])


# --- comparison helpers ---------------------------------------------------------------------------------------------
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


def same_degrees(tex, truth):
    published = parse_degrees(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} degrees is not {truth}")


def rounded_named(tex, truth):
    """`x \\approx 0.678, \\; y \\approx 2.28, \\; z \\approx 2.48`: each named value rounded to 3 s.f."""
    pieces = [piece for piece in tex.replace("$", "").split(",") if piece.strip()]
    seen = {}
    for piece in pieces:
        match = re.match(r"\s*(?:\\;)?\s*([a-z])\s*\\approx", piece)
        if not match:
            raise ValueError(f"cannot read a named rounded value in {piece!r}")
        seen[match.group(1)] = piece
    if set(seen) != set(truth):
        raise AssertionError(f"published names {sorted(seen)} are not {sorted(truth)}")
    for name, piece in seen.items():
        check_rounded(piece, truth[name], sf=3)


def word_case(tex, truth, vocabulary):
    """Map an option's words to a case through `vocabulary` (ordered (phrase, case) pairs) and compare with truth."""
    text = tex.lower()
    for phrase, case in vocabulary:
        if phrase in text:
            if case != truth:
                raise AssertionError(f"{tex!r} describes {case}; the truth is {truth}")
            return
    raise ValueError(f"cannot read a case in {tex!r}")


# --- geometry from the data -----------------------------------------------------------------------------------------
def line_into_plane(point, direction, row):
    """Substitute the general point of the line into the plane: a linear expression in lambda that must equal 0."""
    general = dict(zip(XYZ, (vec(*point) + lam * vec(*direction))))
    return plane_eq(row).subs(general).expand()


def line_plane_case(point, direction, row):
    expr = line_into_plane(point, direction, row)
    coeff, const = expr.coeff(lam, 1), expr.coeff(lam, 0)
    if simplify(coeff) != 0:
        return "one"
    return "lies" if simplify(const) == 0 else "parallel"


def line_plane_point(point, direction, row):
    roots = solve(line_into_plane(point, direction, row), lam)
    assert len(roots) == 1, roots
    return list(vec(*point) + roots[0] * vec(*direction))


def two_planes_line(row1, row2):
    """(point, direction) of the common line, from linsolve with z left free (z = lambda)."""
    (solution,) = linsolve([plane_eq(row1), plane_eq(row2)], x, y)
    general = Matrix([solution[0], solution[1], z])
    point = list(general.subs(z, 0))
    direction = list(general.diff(z))
    assert any(simplify(e) != 0 for e in direction)
    return point, direction


def planes_case(rows):
    """'point', 'line', 'plane', 'parallel', 'prism' (or 'same' / 'parallel' / 'line' for two planes)."""
    solutions = linsolve([plane_eq(r) for r in rows], *XYZ)
    if solutions == EmptySet:
        normals = [normal(r) for r in rows]
        pairs = [(i, j) for i in range(len(normals)) for j in range(i + 1, len(normals))]
        if any(Matrix.hstack(normals[i], normals[j]).rank() == 1 for i, j in pairs):
            return "parallel"
        return "prism"
    (solution,) = solutions
    free = set().union(*(e.free_symbols for e in solution))
    return {0: "point", 1: "line", 2: "same" if len(rows) == 2 else "plane"}[len(free)]


def case_from_matrix(rows):
    """The arrangement shown by an augmented matrix, by comparing the ranks of A and [A | b]."""
    aug = Matrix(rows)
    rank_a, rank_aug = aug[:, :3].rank(), aug.rank()
    if rank_a < rank_aug:
        return "none"
    return {3: "point", 2: "line", 1: "plane"}[rank_a]


def unique_point(rows):
    solutions = linsolve([plane_eq(r) for r in rows], *XYZ)
    (solution,) = solutions
    assert all(not e.free_symbols for e in solution), solution
    return dict(zip("xyz", solution))


def line_plane_angle(b, n):
    b, n = vec(*b), vec(*n)
    return asin(abs(b.dot(n)) / (b.norm() * n.norm())) * 180 / pi


def plane_plane_angle(n1, n2):
    n1, n2 = vec(*n1), vec(*n2)
    return acos(abs(n1.dot(n2)) / (n1.norm() * n2.norm())) * 180 / pi


LINE_PLANE_WORDS = [("lies in", "lies"), ("never meets", "parallel"), ("one point", "one")]
TWO_PLANE_WORDS = [("same plane", "same"), ("never meet", "parallel"), ("in a line", "line")]
THREE_PLANE_WORDS = [
    ("prism", "prism"), ("parallel", "parallel"), ("in a line", "line"), ("single point", "point"),
    ("same plane", "plane"), ("no point in common", "none"),
]


# --- question data and their truths ---------------------------------------------------------------------------------
def k_and_d_line_in_plane(tex):
    expr = line_into_plane((1, 0, 4), (2, -1, k), (3, 4, -1, d))
    sol = solve([expr.coeff(lam, 1), expr.coeff(lam, 0)], [k, d], dict=True)
    assert len(sol) == 1, sol
    check_assignments(tex, {"k": sol[0][k], "d": sol[0][d]})


def k_and_m_common_line(tex):
    rows = [(1, 1, 1, 2), (1, 2, -1, 1), (2, 3, k, m)]
    coeffs = Matrix([list(r[:3]) for r in rows])
    found = []
    for k_value in solve(coeffs.det(), k):
        aug = Matrix([[S(e).subs(k, k_value) for e in r] for r in rows])
        minors = [aug.extract([0, 1, 2], cols).det() for cols in ([0, 1, 3], [0, 2, 3], [1, 2, 3])]
        for m_value in solve([mi for mi in minors if mi != 0], m, dict=True):
            substituted = [tuple(S(e).subs({k: k_value, m: m_value[m]}) for e in r) for r in rows]
            if planes_case(substituted) == "line":
                found.append({"k": k_value, "m": m_value[m]})
    assert len(found) == 1, found
    check_assignments(tex, found[0])


def back_substitute_x(value, tolerance):
    rows = [(1, 2, -1, 3), (0, 1, 3, 7), (0, 0, 2, 4)]
    check_numeric(value, unique_point(rows)["x"], sf=3, tolerance=tolerance)


def a_for_common_line(value, tolerance):
    rows = [(1, 2, -1, 1), (2, 1, 1, 4), (1, -1, a, 3)]
    candidates = solve(Matrix([list(r[:3]) for r in rows]).det(), a)
    lines = [c for c in candidates if planes_case([tuple(S(e).subs(a, c) for e in r) for r in rows]) == "line"]
    assert len(lines) == 1, lines
    check_numeric(value, lines[0], sf=3, tolerance=tolerance)


def k_perpendicular(value, tolerance):
    roots = solve(vec(k, 2, -1).dot(vec(3, -1, 4)), k)
    assert len(roots) == 1, roots
    check_numeric(value, roots[0], sf=3, tolerance=tolerance)


CHECKS = {
    # before
    "before-plane-normal": lambda tex: parallel_vector(tex, normal((4, -1, 3, 10))),
    "before-vector-product": lambda tex: same_vector(tex, list(vec(1, 2, 0).cross(vec(0, 1, 3)))),
    "before-back-substitute": back_substitute_x,
    # line meets plane
    "ex-line-meets-plane": lambda tex: same_point(tex, line_plane_point((2, -1, 3), (1, 3, -2), (1, 2, -1, 6))),
    "ex-line-in-plane-k-d": k_and_d_line_in_plane,
    "check-line-plane-point": lambda tex: same_point(tex, line_plane_point((0, 1, -2), (1, -1, 3), (2, 1, 1, 7))),
    "check-line-plane-case": lambda tex: word_case(
        tex, line_plane_case((1, 2, 0), (3, 1, -1), (1, -2, 1, -3)), LINE_PLANE_WORDS),
    # two planes
    "ex-two-planes-eliminate": lambda tex: check_same_line(tex, *two_planes_line((1, 1, 2, 5), (2, -1, 1, 1))),
    "ex-two-planes-cross": lambda tex: check_same_line(tex, *two_planes_line((3, -2, 1, 7), (1, 1, -2, -1))),
    "check-parallel-planes": lambda tex: word_case(
        tex, planes_case([(2, -4, 6, 3), (-1, 2, -3, 5)]), TWO_PLANE_WORDS),
    "check-two-planes-line": lambda tex: check_same_line(tex, *two_planes_line((1, -1, 1, 2), (2, 1, -1, 7))),
    # three planes
    "ex-three-planes-line-km": k_and_m_common_line,
    "ex-three-planes-gdc": lambda tex: rounded_named(
        tex, unique_point([("1.2", -1, 2, "3.5"), (1, 2, "-0.5", 4), (3, 1, 1, "6.8")])),
    "check-matrix-to-geometry": lambda tex: word_case(
        tex, case_from_matrix([[1, -1, 2, 3], [0, 1, -3, 1], [0, 0, 0, 0]]), THREE_PLANE_WORDS),
    "check-three-planes-a": a_for_common_line,
    "check-prism": lambda tex: word_case(
        tex, planes_case([(1, 1, 1, 1), (1, -1, 2, 3), (3, 1, 4, 2)]), THREE_PLANE_WORDS),
    # angle between a line and a plane
    "ex-angle-line-plane-exact": lambda tex: same_degrees(tex, line_plane_angle((1, -1, 2), (2, 1, 1))),
    "ex-angle-line-plane-gdc": lambda tex: check_rounded(
        tex, line_plane_angle(vec(4, 0, -1) - vec(1, -2, 3), (1, -3, 2)), sf=3, unit="°"),
    "check-angle-line-plane-mc": lambda tex: check_rounded(
        tex, line_plane_angle((1, -2, 2), (0, 3, 4)), sf=3, unit="°"),
    # (x - 1)/2 = y/(-2) = (z + 3)/1 has direction (2, -2, 1); the plane 4x + 4y - 7z = 0 has normal (4, 4, -7).
    "check-angle-line-plane-num": lambda v, tolerance: check_numeric(
        v, line_plane_angle((2, -2, 1), (4, 4, -7)), sf=3, tolerance=tolerance),
    # angle between two planes
    "ex-angle-planes-exact": lambda tex: same_degrees(tex, plane_plane_angle((2, 2, 1), (1, 4, -1))),
    "ex-angle-planes-obtuse": lambda tex: check_rounded(
        tex, plane_plane_angle((3, -1, 2), (1, 4, -3)), sf=3, unit="°"),
    "check-perpendicular-planes": k_perpendicular,
    "check-angle-planes-mc": lambda tex: check_rounded(
        tex, plane_plane_angle((1, 2, 2), (2, -1, -2)), sf=3, unit="°"),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-back-substitute": {"sf": 3},
    "check-three-planes-a": {"sf": 3},
    "check-angle-line-plane-num": {"sf": 3},
    "check-perpendicular-planes": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
