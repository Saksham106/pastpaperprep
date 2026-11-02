"""SymPy assertions for lesson 3.16 (vector product). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data with SymPy's Matrix.cross, never typed in. Answers written
in terms of a x b are checked with general symbolic vectors a = (a1, a2, a3), b = (b1, b2, b3): the published multiple
of a x b must equal the true expansion for every a and b.
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, Rational, Symbol, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded, parse_answer, parse_list, parse_vector,
)

k, p, q, t = symbols("k p q t")


def vec(*entries):
    return Matrix(entries)


def dot(a, b):
    return (a.T * b)[0]


def mag(a):
    return sqrt(dot(a, a))


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_vector(tex, truth):
    published = Matrix(parse_vector(tex))
    if published.shape != truth.shape or any(simplify(x) != 0 for x in published - truth):
        raise AssertionError(f"published {list(published)} is not {list(truth)}")


def unit_normal(tex, v, w):
    """Either unit normal is right (the question says "a unit vector"), so assert the properties only the right
    answers have: length 1 and a zero scalar product with both given vectors."""
    published = Matrix(parse_vector(tex))
    if published.shape != v.shape:
        raise AssertionError("wrong number of components")
    if simplify(dot(published, v)) != 0 or simplify(dot(published, w)) != 0:
        raise AssertionError(f"{list(published)} is not perpendicular to both vectors")
    if simplify(mag(published) - 1) != 0:
        raise AssertionError(f"{list(published)} has length {mag(published)}, not 1")
    # Independent cross-check: it must be parallel to the SymPy vector product.
    assert all(simplify(x) == 0 for x in published.cross(v.cross(w)))


def perpendicular_to(tex, v):
    published = Matrix(parse_vector(tex))
    if all(simplify(x) == 0 for x in published):
        raise AssertionError("the zero vector has no direction")
    if simplify(dot(published, v)) != 0:
        raise AssertionError(f"{list(published)} has scalar product {dot(published, v)} with {list(v)}")


# --- answers written as a multiple of a x b --------------------------------------------------------------------------

a1, a2, a3, b1, b2, b3 = symbols("a1 a2 a3 b1 b2 b3")
GA, GB = vec(a1, a2, a3), vec(b1, b2, b3)
AXB_TEX = re.compile(r"\\boldsymbol\{a\}\s*\\times\s*\\boldsymbol\{b\}")
C = Symbol("c")


def multiple_of_axb(tex, truth_vector):
    """Read `... = m a x b` as m*c, then require m*(a x b) to equal the true expansion for general a, b."""
    rhs = tex.strip().strip("$")
    if AXB_TEX.search(rhs) is None:
        raise ValueError(f"no a x b in {tex!r}")
    # Keep only what follows the last top-level '=' (the expression asked for may itself contain x signs).
    rhs = rhs.split("=")[-1]
    replaced = AXB_TEX.sub("c", rhs)
    if "\\times" in replaced or "boldsymbol" in replaced:
        raise ValueError(f"cannot read {tex!r} as a multiple of a x b")
    published = parse_answer(replaced)
    m = simplify(published / C)
    if m.free_symbols:
        raise ValueError(f"{tex!r} is not a constant multiple of a x b")
    if any(simplify(x) != 0 for x in m * GA.cross(GB) - truth_vector):
        raise AssertionError(f"published {m} a x b, truth {list(truth_vector)}")


def given_cross_truth():
    """ex-given-cross: p x q = (1, -2, 4). Build p = (2, 1, 0), which is perpendicular to (1, -2, 4), and solve for
    every q with p x q = (1, -2, 4) (a one-parameter family). (2q) x (p + q) must be the same for all of them."""
    pv = vec(2, 1, 0)
    target = vec(1, -2, 4)
    assert dot(pv, target) == 0
    q1, q2, q3 = symbols("q1 q2 q3")
    qv = vec(q1, q2, q3)
    sol = solve(list(pv.cross(qv) - target), [q1, q2, q3], dict=True)
    assert len(sol) == 1, sol
    qv = qv.subs(sol[0])
    assert all(simplify(x) == 0 for x in pv.cross(qv) - target)
    result = (2 * qv).cross(pv + qv).applyfunc(simplify)
    assert not result.free_symbols, result
    return result


def parallel_unknowns(tex):
    cross = vec(p, 2, -3).cross(vec(4, -1, q))
    sol = solve(list(cross), [p, q], dict=True)
    assert len(sol) == 1, sol
    check_assignments(tex, sol[0])


def single_k(value, tolerance):
    cross = vec(k, 4, -2).cross(vec(3, 6, -3))
    sol = solve(list(cross), k, dict=True)
    assert len(sol) == 1, sol
    check_numeric(value, sol[0][k], sf=3, tolerance=tolerance)


def collinear_words(tex):
    """Word answer: compute AB x AC; zero means collinear. An option claiming the other case is wrong."""
    A, B, Cpt = vec(2, 0, -1), vec(3, 2, 1), vec(5, 6, 5)
    collinear = all(x == 0 for x in (B - A).cross(Cpt - A))
    lowered = tex.lower()
    if "collinear" not in lowered:
        raise ValueError(f"cannot read {tex!r}")
    claims_collinear = " not " not in f" {lowered} "
    if claims_collinear != collinear:
        raise AssertionError(f"{tex!r} is wrong: collinear is {collinear}")


def area_unknown(tex):
    cross = vec(1, 0, 2).cross(vec(0, k, 1))
    truth = solve(Rational(1, 2) * mag(cross) - 3, k)
    published = sorted(parse_list(tex), key=float)
    truth = sorted(truth, key=float)
    if len(published) != len(truth) or any(simplify(x - y) != 0 for x, y in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


P_, Q_, R_ = vec(1, -2, 3), vec(4, 0, 1), vec(-1, 3, 2)
PA, PB, PD = vec(0, 1, 1), vec(2, 1, 0), vec(1, 3, 1)

CHECKS = {
    "before-magnitude": lambda v, tolerance: check_numeric(v, mag(vec(4, -4, 7)), sf=3, tolerance=tolerance),
    "before-displacement": lambda tex: same_vector(tex, vec(1, 2, 5) - vec(3, -1, 2)),
    "before-perpendicular": lambda tex: perpendicular_to(tex, vec(1, 2, -2)),
    "ex-cross-components": lambda tex: same_vector(tex, vec(2, -1, 3).cross(vec(1, 4, -2))),
    "check-cross-ijk": lambda tex: same_vector(tex, vec(1, 3, -2).cross(vec(4, 0, 1))),
    "ex-unit-normal": lambda tex: unit_normal(tex, vec(3, 0, -1), vec(0, 2, -1)),
    # |a x b| = |a||b| sin(theta) is the definition's length; theta = 150 degrees = 5 pi / 6.
    "check-cross-magnitude": lambda v, tolerance: check_numeric(
        v, mag(vec(5, 0, 0).cross(4 * vec(-sqrt(3) / 2, Rational(1, 2), 0))), sf=3, tolerance=tolerance),
    "ex-expand-cross": lambda tex: multiple_of_axb(tex, (GA + 2 * GB).cross(GA - GB)),
    "check-expand-cross": lambda tex: multiple_of_axb(tex, (2 * GA + GB).cross(GA - 3 * GB)),
    "ex-given-cross": lambda tex: same_vector(tex, given_cross_truth()),
    "ex-parallel-test": lambda tex: same_vector(tex, vec(5, -1, 3).cross(vec(-10, 2, -6))),
    "ex-parallel-unknowns": parallel_unknowns,
    "check-parallel-k": single_k,
    "check-collinear": collinear_words,
    "ex-area-parallelogram": lambda tex: same(tex, mag(vec(2, 1, -1).cross(vec(1, -1, 3)))),
    "ex-area-triangle-p2": lambda tex: check_rounded(tex, mag((Q_ - P_).cross(R_ - P_)) / 2, sf=3),
    "check-triangle-area": lambda v, tolerance: check_numeric(
        v, mag(vec(3, 0, 4).cross(vec(0, 2, 1))) / 2, sf=3, tolerance=tolerance),
    "ex-area-unknown": area_unknown,
    "check-parallelogram-area": lambda tex: same(tex, mag((PB - PA).cross(PD - PA))),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-magnitude": {"sf": 3},
    "check-cross-magnitude": {"sf": 3},
    "check-parallel-k": {"sf": 3},
    "check-triangle-area": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
