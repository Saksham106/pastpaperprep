"""SymPy assertions for lesson 3.13 (scalar product and angles). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data with SymPy matrices: scalar products as v^T w, magnitudes
as sqrt(v^T v), angles as acos of the quotient. Questions given only lengths and scalar products (no components) are
computed through the Gram matrix of the two letter vectors, or by building concrete vectors with those lengths.
"""
import sys
from pathlib import Path

from sympy import Matrix, Symbol, acos, pi, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer, parse_degrees, parse_list, parse_vector  # noqa: E402

p, k, m, c = symbols("p k m c")


def vec(*entries):
    return Matrix(entries)


def dot(a, b):
    return (a.T * b)[0]


def mag(a):
    return sqrt(dot(a, a))


def angle_degrees(a, b):
    return acos(dot(a, b) / (mag(a) * mag(b))) * 180 / pi


def gram_value(gram, left, right):
    """Scalar product of (left[0] a + left[1] b) and (right[0] a + right[1] b), from the Gram matrix
    [[a.a, a.b], [a.b, b.b]]: bilinearity done by matrix algebra, not by the lesson's hand expansion."""
    return (Matrix([left]) * gram * Matrix(right))[0]


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_vector(tex, truth):
    published = Matrix(parse_vector(tex))
    if published.shape != truth.shape or any(simplify(x) != 0 for x in published - truth):
        raise AssertionError(f"published {list(published)} is not {list(truth)}")


def parallel_to(tex, direction):
    """The published vector is non-zero and a scalar multiple of `direction` (zero cross product)."""
    published = Matrix(parse_vector(tex))
    if published.shape != direction.shape:
        raise AssertionError(f"published {list(published)} has the wrong number of components")
    if all(simplify(x) == 0 for x in published):
        raise AssertionError("the zero vector has no direction")
    if any(simplify(x) != 0 for x in published.cross(direction)):
        raise AssertionError(f"published {list(published)} is not parallel to {list(direction)}")


def scalar(tex, truth):
    """A scalar product is a number: a column vector is the componentwise products left unadded (wrong)."""
    if "\\begin" in tex:
        entries = parse_vector(tex)  # must be readable; ValueError otherwise
        raise AssertionError(f"published a vector {entries}; a scalar product is a number")
    same(tex, truth)


def degrees(tex, truth):
    published = parse_degrees(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} degrees, truth {simplify(truth)} degrees")


def roots(tex, equation, var):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truth = sorted(solve(equation, var), key=lambda r: float(r))
    if len(published) != len(truth) or any(simplify(a - b) != 0 for a, b in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def single_root(tex, equation, var):
    truth = solve(equation, var)
    assert len(truth) == 1, truth
    same(tex, truth[0])


# --- truths built from each question's own data -------------------------------------------------------------------

A_TRI, B_TRI, C_TRI = vec(2, -1, 3), vec(5, 1, -2), vec(-1, 4, 0)


def self_expand_truth():
    """check-dot-self-expand: |u| = 2, u.v = 3, |v| unknown. u.(4u - v) must not depend on |v|."""
    vv = Symbol("vv")
    value = gram_value(Matrix([[2**2, 3], [3, vv]]), [1, 0], [4, -1])
    assert vv not in value.free_symbols
    return value


def length_reverse_truth():
    """ex-length-reverse: build a = (4, 0) and b = 7(c, sqrt(1 - c^2)) so |a| = 4 and |b| = 7 exactly,
    solve |a - b| = 9 for c, then a.b = 28c."""
    a = vec(4, 0)
    b = vec(7 * c, 7 * sqrt(1 - c**2))
    sols = solve(dot(a - b, a - b) - 81, c)
    assert len(sols) == 1 and -1 <= sols[0] <= 1, sols
    return dot(a, b).subs(c, sols[0])


def rhombus_truth():
    """ex-rhombus-proof: general 3D a, b with |b| = |a| imposed by choosing b3; (a + b).(a - b) must vanish."""
    a1, a2, a3, b1, b2 = symbols("a1 a2 a3 b1 b2", real=True)
    b3 = sqrt(a1**2 + a2**2 + a3**2 - b1**2 - b2**2)
    a, b = vec(a1, a2, a3), vec(b1, b2, b3)
    assert simplify(dot(a, a) - dot(b, b)) == 0
    return simplify(dot(a + b, a - b))


CHECKS = {
    "before-magnitude": lambda v, tolerance: check_numeric(v, mag(vec(2, -6, 3)), sf=3, tolerance=tolerance),
    "before-displacement": lambda tex: same_vector(tex, vec(3, -1, 5) - vec(1, 4, -2)),
    "before-parallel": lambda tex: parallel_to(tex, vec(2, -1, 3)),
    "ex-dot-3d": lambda tex: same(tex, dot(vec(3, -2, 5), vec(4, 6, -1))),
    "check-dot-ijk": lambda v, tolerance: check_numeric(v, dot(vec(2, -3, 1), vec(-4, -2, 6)), sf=3, tolerance=tolerance),
    "ex-dot-unknown": lambda tex: single_root(tex, dot(vec(p, 3, -2), vec(4, -1, p)) - 7, p),
    "check-dot-2d": lambda tex: scalar(tex, dot(vec(1, -4), vec(-3, 2))),
    "ex-expand-brackets": lambda tex: same(tex, gram_value(Matrix([[3**2, -4], [-4, 5**2]]), [2, 1], [1, -3])),
    "check-dot-self-expand": lambda v, tolerance: check_numeric(v, self_expand_truth(), sf=3, tolerance=tolerance),
    "ex-length-reverse": lambda tex: same(tex, length_reverse_truth()),
    "check-length-difference": lambda tex: same(tex, sqrt(gram_value(Matrix([[6**2, 5], [5, 2**2]]), [1, -1], [1, -1]))),
    "ex-angle-exact": lambda tex: degrees(tex, angle_degrees(vec(2, -1, 2), vec(1, 1, 4))),
    "check-cos-2d": lambda tex: same(tex, dot(vec(3, -1), vec(2, 4)) / (mag(vec(3, -1)) * mag(vec(2, 4)))),
    "ex-angle-triangle": lambda tex: check_rounded(tex, angle_degrees(A_TRI - B_TRI, C_TRI - B_TRI), sf=3, unit="°"),
    "check-angle-obtuse": lambda v, tolerance: check_numeric(v, angle_degrees(vec(4, 0, -3), vec(1, 2, 2)), sf=3, tolerance=tolerance),
    "ex-perp-quadratic": lambda tex: roots(tex, dot(vec(k, 2, 1), vec(k, k, -8)), k),
    "check-perp-m": lambda tex: single_root(tex, dot(vec(2, m, -3), vec(m, 5, 4)), m),
    "check-parallel-angle": lambda tex: degrees(tex, angle_degrees(vec(2, -4, 6), vec(-3, 6, -9))),
    "ex-rhombus-proof": lambda tex: same(tex, rhombus_truth()),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-magnitude": {"sf": 3},
    "check-dot-ijk": {"sf": 3},
    "check-dot-self-expand": {"sf": 3},
    "check-angle-obtuse": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
