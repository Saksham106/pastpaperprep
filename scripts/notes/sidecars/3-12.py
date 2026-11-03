"""SymPy assertions for lesson 3.12 (Vectors in 2D and 3D). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built here from the question's own data: column vectors as SymPy matrices, points as coordinate
lists, and the letter-only proofs with commuting symbols a, b, u, w standing for the base vectors (every expression
involved is a linear combination of them, so ordinary algebra gives the true coefficients).
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, Rational, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded_list, parse_answer, parse_point, parse_vector,
)

t, k, s = symbols("t k s")
a, b, u, w = symbols("a b u w")

I3, J3, K3 = Matrix([1, 0, 0]), Matrix([0, 1, 0]), Matrix([0, 0, 1])


def vector_is(tex, truth):
    """The published column vector equals `truth` component by component (and has the same dimension)."""
    published = parse_vector(tex)
    truth = list(truth)
    if len(published) != len(truth):
        raise AssertionError(f"published {published} has {len(published)} components, truth {truth} has {len(truth)}")
    if any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published} is not {truth}")


def point_is(tex, truth):
    published = parse_point(tex)
    truth = list(truth)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def letters(tex):
    """`\\boldsymbol{a}` -> `a`, so a combination of named vectors reads as an expression in the symbols a, b, u, w."""
    return re.sub(r"\\boldsymbol\{([a-z])\}", r"\1", tex)


def combination_is(tex, truth):
    published = parse_answer(letters(tex))
    if not published.free_symbols <= {a, b, u, w}:
        raise ValueError(f"{tex!r} uses letters other than the base vectors")
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def parallel_to(tex, direction):
    """check-parallel-which: the published vector is non-zero and a scalar multiple of `direction`."""
    published = Matrix(parse_vector(tex))
    direction = Matrix(direction)
    if published.shape != direction.shape:
        raise AssertionError("wrong dimension")
    if all(simplify(x) == 0 for x in published):
        raise AssertionError("zero vector")
    if Matrix.hstack(published, direction).rank(simplify=True) != 1:
        raise AssertionError(f"{list(published)} is not parallel to {list(direction)}")


# ---------------------------------------------------------------------------------------------------- truths

def distance(p, q):
    return sqrt(sum((x - y) ** 2 for x, y in zip(p, q)))


def parallel_values():
    """ex-parallel-find: (6, s, -9) = k (-4, 2, t). Solve the three component equations for k, s, t."""
    tt = symbols("tt")
    sol = solve([6 + 4 * k, s - 2 * k, -9 - k * tt], [k, s, tt], dict=True)
    assert len(sol) == 1
    return {"s": sol[0][s], "t": sol[0][tt]}


def collinear_t():
    """ex-collinear-t: AC = k AB with A(2,-1,3), B(5,1,2), C(11,t,0). Solve all three components for k and t."""
    A, B, C = Matrix([2, -1, 3]), Matrix([5, 1, 2]), Matrix([11, t, 0])
    eqs = list((C - A) - k * (B - A))
    sol = solve(eqs, [k, t], dict=True)
    assert len(sol) == 1
    return sol[0][t]


def collinear_k_2d():
    """check-collinear-k: PR = m PQ with P(1,4), Q(3,1), R(k,-8)."""
    m = symbols("m")
    P, Q, R = Matrix([1, 4]), Matrix([3, 1]), Matrix([k, -8])
    sol = solve(list((R - P) - m * (Q - P)), [m, k], dict=True)
    assert len(sol) == 1
    return sol[0][k]


def gdc_roots():
    """ex-gdc-distance: P(2,-1,3), Q(t,2t,1-t), |PQ| = 7. Solve |PQ|^2 = 49 exactly; both roots are real."""
    PQ = Matrix([t, 2 * t, 1 - t]) - Matrix([2, -1, 3])
    roots = solve(PQ.dot(PQ) - 49, t)
    assert len(roots) == 2 and all(r.is_real for r in roots)
    return roots


def collinear_proof(tex):
    """check-collinear-proof: OC = 3b - 2a. The truth is AC = k AB with k computed from the coefficients of a and b.
    An option of the form `AC = c AB` passes only if c = k; the option saying C is off line (AB) is wrong because
    such a k exists (a and b are not parallel, so matching the coefficients of a and b decides it)."""
    OA, OB, OC = a, b, 3 * b - 2 * a
    AC, AB_ = (OC - OA).expand(), (OB - OA).expand()
    diff_ = (AC - k * AB_).expand()
    sol = solve([diff_.coeff(a), diff_.coeff(b)], k, dict=True)
    assert len(sol) == 1
    truth_k = sol[0][k]
    text = tex.replace("$", "")
    match = re.match(r"\s*\\overrightarrow\{AC\}\s*=\s*(.*?)\\overrightarrow\{AB\}\s*,\s*so collinear\s*$", text)
    if match:
        coefficient = match.group(1).strip() or "1"
        published = parse_answer(coefficient)
        if simplify(published - truth_k) != 0:
            raise AssertionError(f"AC = {published} AB, but truly AC = {truth_k} AB")
        return
    if re.fullmatch(r"\s*C is not on the line \(AB\)\s*", text):
        raise AssertionError(f"C is on line (AB): AC = {truth_k} AB")
    raise ValueError(f"cannot read option {tex!r}")


# --------------------------------------------------------------------------------------------------- checks

u_add, v_add, w_add = Matrix([3, -1, 4]), Matrix([-2, 5, 1]), 2 * J3 - 6 * K3
a_comb, b_comb = 2 * I3 - 3 * J3 + K3, -I3 + 4 * J3
v_unit = 4 * I3 - 4 * J3 + 7 * K3
v_opp = Matrix([2, -1, 2])
u_mag, v_mag = Matrix([1, -2, 4]), Matrix([-1, 1, 2])

CHECKS = {
    "before-distance-3d": lambda tex: same(tex, distance([2, -1, 3], [-2, 1, 7])),
    "before-midpoint-3d": lambda tex: point_is(tex, [Rational(x + y, 2) for x, y in zip([3, -5, 2], [-1, 1, 8])]),
    # U - T from the grid coordinates T(9, 6), U(6, 2) drawn in figure 3-12-grid-arrows.
    "ex-grid-tu": lambda tex: vector_is(tex, Matrix([6, 2]) - Matrix([9, 6])),
    # OE = E - O with E(-3, 0, 4) and O the origin.
    "check-position-vector": lambda tex: vector_is(tex, Matrix([-3, 0, 4]) - Matrix([0, 0, 0])),
    "ex-ijk-to-column": lambda tex: vector_is(tex, 6 * I3 - K3),
    "check-ijk-column": lambda tex: vector_is(tex, 3 * J3 - 2 * K3),
    "ex-add-subtract": lambda tex: vector_is(tex, u_add - v_add + w_add),
    "ex-ab-from-points": lambda tex: vector_is(tex, Matrix([1, 3, -5]) - Matrix([4, -1, 2])),
    "check-find-point": lambda tex: point_is(tex, Matrix([-1, 4, 3]) + Matrix([2, -6, 1])),
    # Parallelogram PQRS with P as origin: Q = u, S = w, so QS = S - Q.
    "check-parallelogram-diagonal": lambda tex: combination_is(tex, w - u),
    "ex-combination": lambda tex: vector_is(tex, 3 * a_comb - 2 * b_comb),
    "ex-parallel-find": lambda tex: check_assignments(tex, parallel_values()),
    "check-parallel-which": lambda tex: parallel_to(tex, [3, -6, 2]),
    "ex-collinear-t": lambda tex: same(tex, collinear_t()),
    "check-collinear-k": lambda v, tolerance: check_numeric(v, collinear_k_2d(), sf=3, tolerance=tolerance),
    "ex-unit-vector": lambda tex: vector_is(tex, v_unit / v_unit.norm()),
    "check-length-opposite": lambda tex: vector_is(tex, -12 * v_opp / v_opp.norm()),
    "ex-distance-exact": lambda tex: same(tex, (Matrix([4, 2, -5]) - Matrix([1, -2, 0])).norm()),
    "ex-gdc-distance": lambda tex: check_rounded_list(tex, gdc_roots(), sf=3),
    "check-magnitude-combo": lambda v, tolerance: check_numeric(v, (2 * u_mag - v_mag).norm(), sf=3, tolerance=tolerance),
    # Triangle OAB, O as origin: M = a/2, N = b/2, so MN = N - M.
    "ex-midpoint-theorem": lambda tex: combination_is(tex, b / 2 - a / 2),
    # Parallelogram ABCD, A as origin: B = u, D = w, X = B + (D - B)/2.
    "ex-diagonals-bisect": lambda tex: combination_is(tex, u + (w - u) / 2),
    # G = (2/3) M with M = (a + b)/2 the midpoint of [AB].
    "check-centroid": lambda tex: combination_is(tex, Rational(2, 3) * (a + b) / 2),
    "check-collinear-proof": collinear_proof,
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-collinear-k": {"sf": 3}, "check-magnitude-combo": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
