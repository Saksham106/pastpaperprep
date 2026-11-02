"""SymPy assertions for lesson 3.15 (Relationships between lines). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed from the question's own lines. The relationship of two lines comes from linear algebra:
the rank of the two directions (parallel or not), the rank of the joining vector with a direction (coincident or
not), and SymPy's solve on all three component equations (intersecting or skew). Points of intersection and unknown
constants come from solving the component equations. Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, S, Symbol, diff, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, parse_point, parse_vector, parse_vector_line,
)

x, y, z, lam, mu, k = symbols("x y z lambda mu k")


def vec(*entries):
    return Matrix([S(e) for e in entries])


def relationship(a1, b1, a2, b2):
    """'coincident', 'parallel', 'intersecting' or 'skew' for r = a1 + lam b1 and r = a2 + mu b2."""
    a1, b1, a2, b2 = (Matrix(v) for v in (a1, b1, a2, b2))
    if Matrix.hstack(b1, b2).rank(simplify=True) == 1:
        return "coincident" if Matrix.hstack(a2 - a1, b1).rank(simplify=True) <= 1 else "parallel"
    solutions = solve(list(a1 + lam * b1 - a2 - mu * b2), [lam, mu], dict=True)
    return "intersecting" if solutions else "skew"


def intersection(a1, b1, a2, b2):
    a1, b1, a2, b2 = (Matrix(v) for v in (a1, b1, a2, b2))
    solutions = solve(list(a1 + lam * b1 - a2 - mu * b2), [lam, mu], dict=True)
    if len(solutions) != 1:
        raise RuntimeError("the set-up does not give one point of intersection")
    return list(a1 + solutions[0][lam] * b1)


KEYWORDS = {"coincident": "coincident", "parallel": "parallel", "intersect": "intersecting", "skew": "skew"}


def read_relationship(text):
    """The one relationship named in an option ('Skew') or an answer ('$L_1 \\text{ and } L_2 \\text{ are skew}$')."""
    words = re.sub(r"\\text\{([^}]*)\}", r" \1 ", text).replace("$", " ").lower()
    found = {name for key, name in KEYWORDS.items() if key in words}
    if len(found) != 1:
        raise ValueError(f"cannot read {text!r} as one relationship between two lines")
    return found.pop()


def relationship_is(text, a1, b1, a2, b2):
    published, truth = read_relationship(text), relationship(a1, b1, a2, b2)
    if published != truth:
        raise AssertionError(f"published {published}, but the lines are {truth}")


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published} is not {list(truth)}")


def point_on_line(tex, a, b):
    published = Matrix(parse_point(tex))
    if Matrix.hstack(published - Matrix(a), Matrix(b)).rank(simplify=True) > 1:
        raise AssertionError(f"{list(published)} is not on the line through {list(a)}")


def parallel_vector(tex, truth):
    published = Matrix(parse_vector(tex))
    if published.shape != Matrix(truth).shape or all(simplify(e) == 0 for e in published):
        raise AssertionError(f"{published.T} is not a non-zero vector of the right size")
    if Matrix.hstack(published, Matrix(truth)).rank(simplify=True) != 1:
        raise AssertionError(f"{published.T} is not parallel to {list(truth)}")


def cartesian_line(parts):
    """Set each Cartesian part equal to lambda and solve for its coordinate: (point, direction)."""
    coords = [solve(part - lam, var)[0] for part, var in zip(parts, (x, y, z))]
    return [c.subs(lam, 0) for c in coords], [diff(c, lam) for c in coords]


def unknown_for_intersection(a1, b1, a2, b2, unknown):
    """Value of the unknown constant for which the three component equations have a common solution."""
    a1, b1, a2, b2 = (Matrix(v) for v in (a1, b1, a2, b2))
    solutions = solve(list(a1 + lam * b1 - a2 - mu * b2), [lam, mu, unknown], dict=True)
    if len(solutions) != 1:
        raise RuntimeError("the set-up does not fix the unknown")
    return solutions[0][unknown]


def parallel_not_coincident(tex, a, b):
    point, direction = parse_vector_line(tex)
    truth = relationship(a, b, point, direction)
    if truth != "parallel":
        raise AssertionError(f"the published line is {truth} with L, not parallel to it")


a_sym, c_sym, p_sym, q_sym, h_sym = (Symbol(name) for name in ("a", "c", "p", "q", "h"))

# --- the data of each question -------------------------------------------------------------------------------------
SEC1_L1 = (vec(1, 3, -2), vec(2, -1, 4))
PAR_L2 = (vec(0, 5, 3), vec(-6, 3, -12))
COIN_L2 = (vec(5, a_sym, 6), vec(-4, 2, -8))
PARALLEL_CHECK_L = (vec(2, 0, -1), vec(3, -6, 9))
WORD_COIN = (vec(1, -1, 4), vec(2, 1, -1), vec(5, 1, 2), vec(-4, -2, 2))
INT_2D = (vec(1, 2), vec(3, 1), vec(9, 1), vec(2, -3))
INT_3D = (vec(-1, 5, 1), vec(2, -3, 2), vec(6, 1, 4), vec(3, 2, -1))
INT_C = (vec(2, 0, 1), vec(1, 1, -2), vec(c_sym, 3, -4), vec(2, -1, 1))
INT_CHECK = (vec(0, 1, 2), vec(1, 2, -1), vec(5, 2, 3), vec(1, -1, 1))
INT_P = (vec(1, -2, 3), vec(2, 1, 0), vec(4, 0, p_sym), vec(1, 1, -1))
SKEW_VEC = (vec(1, 0, 2), vec(1, 2, 1), vec(2, -1, 4), vec(1, 1, -2))
SKEW_CART_L1 = cartesian_line([(x - 2) / 3, (y + 1) / -1, (z - 4) / 2])
SKEW_CART = (Matrix(SKEW_CART_L1[0]), Matrix(SKEW_CART_L1[1]), vec(1, 2, 0), vec(1, 0, 1))
SKEW_CHECK = (vec(0, 2, 1), vec(1, -1, 3), vec(4, 0, 2), vec(1, 1, -1))
NO_COMMON = (vec(1, 0, 2), vec(2, -1, 3), vec(0, 4, 1), vec(-4, 2, -6))
FIND_Q = (vec(3, 1, -2), vec(1, -2, 2), vec(6, q_sym, 1), vec(2, -1, 1))
GDC = (vec(4, -2, 7), vec(3, 5, -2), vec(-6, 10, 3), vec(4, -3, 1))
CART_COIN_L1 = cartesian_line([(x - 5) / 2, (y + 3) / 4, (2 - z) / 2])
CART_COIN = (Matrix(CART_COIN_L1[0]), Matrix(CART_COIN_L1[1]), vec(7, 1, 0), vec(-1, -2, 1))
FIND_H = (vec(2, 1, -1), vec(1, 3, 2), vec(0, -4, 5), vec(1, 1, h_sym))
BEFORE_LINE = (vec(2, -1, 3), vec(1, 4, -2))
BEFORE_DIRECTION = cartesian_line([(x - 3) / 2, (4 - y) / 5, z + 1])[1]


def coincident_value_of_a(tex):
    # Coincident: (5, a, 6) lies on L1, i.e. it equals a1 + lam b1 for some lam. Solve for lam and a together.
    a1, b1 = SEC1_L1
    solutions = solve(list(a1 + lam * b1 - COIN_L2[0]), [lam, a_sym], dict=True)
    assert len(solutions) == 1 and relationship(a1, b1, COIN_L2[0].subs(solutions[0]), COIN_L2[1]) == "coincident"
    check_assignments(tex, {"a": solutions[0][a_sym]})


def before_multiple(value, tolerance):
    solutions = solve(list(vec(-4, 6, -2) - k * vec(2, -3, 1)), k, dict=True)
    check_numeric(value, solutions[0][k], sf=3, tolerance=tolerance)


def find_q(tex):
    # Published form: `$q = -2 \text{; for every other } q \text{ the lines are skew}$`.
    pieces = tex.split(r"\text{;", 1)
    if len(pieces) != 2:
        raise ValueError(f"{tex!r} does not give both the value of q and the other case")
    value_tex, other_text = pieces[0] + "$", r"\text{" + pieces[1]
    q_value = unknown_for_intersection(*FIND_Q, q_sym)
    check_assignments(value_tex, {"q": q_value})
    # Exactly one q makes the three equations consistent (unknown_for_intersection), and the directions do not involve
    # q, so every other q gives the same relationship. Compute it at two other values and require them to agree.
    others = {relationship(FIND_Q[0], FIND_Q[1], FIND_Q[2].subs(q_sym, q_value + d), FIND_Q[3]) for d in (1, -3)}
    if len(others) != 1:
        raise RuntimeError("other values of q do not give one relationship")
    published, truth = read_relationship(other_text), others.pop()
    if published != truth:
        raise AssertionError(f"published {published} for every other q, but the lines are {truth}")


def find_c(tex):
    # Published form: `$c = 2, \; (4, 2, -3)$`: the value of c, then the point of intersection.
    body = tex.strip().strip("$")
    start = body.find("(")
    if start < 0:
        raise ValueError(f"{tex!r} has no point of intersection")
    value_tex = "$" + body[:start].rstrip().removesuffix(r"\;").rstrip().removesuffix(",") + "$"
    c_value = unknown_for_intersection(*INT_C, c_sym)
    check_assignments(value_tex, {"c": c_value})
    same_point("$" + body[start:] + "$", intersection(*(v.subs(c_sym, c_value) for v in INT_C)))


CHECKS = {
    "before-point-on-line": lambda tex: point_on_line(tex, *BEFORE_LINE),
    "before-read-direction": lambda tex: parallel_vector(tex, BEFORE_DIRECTION),
    "before-multiple": before_multiple,
    "ex-parallel-not-coincident": lambda tex: relationship_is(tex, *SEC1_L1, *PAR_L2),
    "ex-coincident-find-a": coincident_value_of_a,
    "check-parallel-line": lambda tex: parallel_not_coincident(tex, *PARALLEL_CHECK_L),
    "check-coincident-word": lambda tex: relationship_is(tex, *WORD_COIN),
    "ex-intersect-2d": lambda tex: same_point(tex, intersection(*INT_2D)),
    "ex-intersect-3d": lambda tex: same_point(tex, intersection(*INT_3D)),
    "ex-intersect-unknown": find_c,
    "check-intersection-point": lambda tex: same_point(tex, intersection(*INT_CHECK)),
    "check-intersect-p": lambda v, tolerance: check_numeric(
        v, unknown_for_intersection(*INT_P, p_sym), sf=3, tolerance=tolerance),
    "ex-skew-vector": lambda tex: relationship_is(tex, *SKEW_VEC),
    "ex-skew-cartesian": lambda tex: relationship_is(tex, *SKEW_CART),
    "check-skew-classify": lambda tex: relationship_is(tex, *SKEW_CHECK),
    "check-no-common-point": lambda tex: relationship_is(tex, *NO_COMMON),
    "ex-find-q-intersect": find_q,
    "ex-gdc-skew": lambda tex: relationship_is(tex, *GDC),
    "check-classify-cartesian": lambda tex: relationship_is(tex, *CART_COIN),
    "check-h-intersect": lambda v, tolerance: check_numeric(
        v, unknown_for_intersection(*FIND_H, h_sym), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; all three answers are exact integers, entered with tolerance 0.
NUMERIC = {"before-multiple": {"sf": 3}, "check-intersect-p": {"sf": 3}, "check-h-intersect": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
