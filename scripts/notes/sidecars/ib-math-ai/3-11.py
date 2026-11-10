"""SymPy assertions for IB Maths AI lesson 3.11 (vector equations of lines). Not shipped to the browser.

Why a sidecar: no declarative verify kind reads a vector equation of a line, r = (point) + lambda (direction). A line
answer is right when its direction is a non-zero multiple of the true direction and its point lies on the true line
(mathparse.check_same_line), unless the question fixes the start point and direction, in which case both must match
exactly. Every truth is built from the question's own data: directions are differences of the given points, and a
parametric form is turned back into a line by collecting constants (lambda = 0) and coefficients of lambda.
Examples and checks with a plain numeric, point or rounded answer use their own `verify` blocks; only the ids in
CHECKS come here.
"""
import sys
from pathlib import Path

from sympy import Matrix, S, diff, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import check_same_line, keep_constant, parse_answer, parse_vector, parse_vector_line  # noqa: E402

lam = symbols("lambda")


def vec(*entries):
    return Matrix([S(e) for e in entries])


def two_parts(tex):
    """Split `first, \\; second` at its one top-level comma (outside any bracket or brace)."""
    body = tex.strip().strip("$")
    depth, cuts = 0, []
    for i, ch in enumerate(body):
        depth += ch in "{(["
        depth -= ch in "})]"
        if ch == "," and depth == 0:
            cuts.append(i)
    if len(cuts) != 1:
        raise ValueError(f"{tex!r} should hold exactly two parts separated by one top-level comma")
    return body[: cuts[0]].strip(), body[cuts[0] + 1:].replace("\\;", " ").strip()


def parallel_vector(tex, truth):
    """A non-zero vector that is a scalar multiple of `truth`."""
    published = Matrix(parse_vector(tex))
    if published.shape != Matrix(truth).shape or all(simplify(e) == 0 for e in published):
        raise AssertionError(f"{published.T} is not a non-zero vector of the right size")
    if Matrix.hstack(published, Matrix(truth)).rank(simplify=True) != 1:
        raise AssertionError(f"{published.T} is not parallel to {list(truth)}")


def exact_line(tex, point, direction):
    """The question fixes the start point and the direction: both must be exactly these."""
    p, d = parse_vector_line(tex)
    if len(p) != len(point) or any(simplify(a - b) != 0 for a, b in zip(p, point)):
        raise AssertionError(f"start point {p} is not {list(point)}")
    if len(d) != len(direction) or any(simplify(a - b) != 0 for a, b in zip(d, direction)):
        raise AssertionError(f"direction {d} is not {list(direction)}")


def line_from_parametric(coords):
    """(point, direction) of x_i = c_i + lambda * k_i: constants at lambda = 0, coefficients of lambda."""
    return [c.subs(lam, 0) for c in coords], [diff(c, lam) for c in coords]


# --- the data of each question -------------------------------------------------------------------------------------
CAFE, GATE = vec(-20, 50), vec(60, -10)
BOTTOM, TOP, TOWER = vec(120, 40, 15), vec(-80, 290, 515), vec(40, 140, 215)
P, Q = vec(3, -1, 2), vec(5, 2, -2)
PARAMETRIC = [1 - 4 * lam, S(6), 3 + 2 * lam]  # x = 1 - 4 lambda, y = 6, z = 3 + 2 lambda
M, C = S(3), S(-2)  # y = 3x - 2


def ski_lift(tex):
    line, value = two_parts(tex)
    direction = TOP - BOTTOM
    exact_line(f"${line}$", list(BOTTOM), list(direction))
    if not value.replace(" ", "").startswith("\\lambda="):
        raise AssertionError(f"second part {value!r} should give lambda")
    lam_x = solve(BOTTOM[0] + lam * direction[0] - TOWER[0], lam)[0]
    if any(simplify(BOTTOM[i] + lam_x * direction[i] - TOWER[i]) != 0 for i in range(3)):
        raise AssertionError("the tower top is not on the cable for one lambda")
    if simplify(parse_answer(f"${value}$") - lam_x) != 0:
        raise AssertionError(f"published {value} is not lambda = {lam_x}")


def gradient_form(tex):
    # y = mx + c passes through (0, c); one step across (1) is m up
    point = [S(0), M * 0 + C]
    other = [S(1), M * 1 + C]
    check_same_line(tex, point, [other[0] - point[0], other[1] - point[1]])


CHECKS = {
    "before-parallel": lambda tex: parallel_vector(tex, vec(2, -1, 3)),
    "ex-cycle-path": lambda tex: check_same_line(tex, list(CAFE), list(GATE - CAFE)),
    "ex-ski-lift": ski_lift,
    "check-line-two-points": lambda tex: check_same_line(tex, list(P), list(Q - P)),
    "check-parametric-to-vector": lambda tex: check_same_line(tex, *line_from_parametric(PARAMETRIC)),
    "check-gradient-form": gradient_form,
}

NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    with keep_constant():  # nothing here is an antiderivative: a trailing + C is part of the answer
        CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
