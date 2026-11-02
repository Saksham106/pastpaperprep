"""SymPy assertions for lesson 1.16 (systems of linear equations). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the system's own coefficients with SymPy: linsolve() for the solution set (a point,
the empty set, or a family with free symbols), Matrix.det() for the parameter values with no unique solution, and
Matrix.rank() to classify a reduced augmented matrix. A published general solution is checked by substituting it into
every equation (it must hold for every value of its parameter) and by confirming that the true solution set is
one-dimensional, so a non-constant line inside it is the whole set.
"""
import re
import sys
from pathlib import Path

from sympy import EmptySet, Matrix, Rational, diff, expand, linsolve, oo, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments,
    check_numeric,
    check_rounded,
    check_same_equation,
    parse_answer,
    parse_assignments,
)

x, y, z = symbols("x y z")
XYZ = (x, y, z)


def equations(rows, unknowns=XYZ):
    """Each row (a, b, c, d) is the equation a x + b y + c z = d, returned as lhs - rhs."""
    return [sum(coeff * var for coeff, var in zip(r[:-1], unknowns)) - r[-1] for r in rows]


def solution_set(rows, unknowns=XYZ):
    return linsolve(equations(rows, unknowns), *unknowns)


def unique_solution(rows, unknowns=XYZ):
    solutions = solution_set(rows, unknowns)
    assert len(solutions) == 1, solutions
    (point,) = solutions
    assert all(not value.free_symbols for value in point), f"not unique: {point}"
    return dict(zip((str(u) for u in unknowns), point))


def count_word(tex, rows, unknowns=XYZ):
    """Word answer for the number of solutions ("None", "Exactly one", "Infinitely many"), from linsolve."""
    solutions = solution_set(rows, unknowns)
    if solutions == EmptySet:
        truth = "none"
    else:
        (point,) = solutions
        truth = "many" if any(value.free_symbols for value in point) else "one"
    text = tex.lower()
    published = "many" if "infinitely" in text else ("none" if "none" in text or "no solution" in text else ("one" if "one" in text else None))
    if published is None:
        raise ValueError(f"cannot read a number of solutions in {tex!r}")
    if published != truth:
        raise AssertionError(f"{tex!r} says {published}; the system has {truth}")


def number_of_solutions(tex, rows):
    """`\\text{number of solutions} = 0`: the count of the true solution set (0, 1, or oo for a family)."""
    solutions = solution_set(rows)
    if solutions == EmptySet:
        truth = 0
    else:
        (point,) = solutions
        truth = oo if any(value.free_symbols for value in point) else 1
    if parse_answer(tex) != truth:
        raise AssertionError(f"published {tex!r}, truth {truth}")


def rounded_named(tex, truth):
    """`x \\approx 1.80, \\; y \\approx 2.69, \\; z \\approx 0.200`: each named value rounded to 3 s.f."""
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


def coefficient_matrix(rows):
    return Matrix([list(r[:-1]) for r in rows])


def parameter_values(rows, parameter, kind):
    """Values of the parameter where the determinant vanishes and the system has `kind` ("none" or "many") solutions."""
    found = []
    for value in solve(coefficient_matrix(rows).det(), parameter):
        substituted = [[entry.subs(parameter, value) if hasattr(entry, "subs") else entry for entry in r] for r in rows]
        solutions = solution_set(substituted)
        if kind == "none" and solutions == EmptySet:
            found.append(value)
        if kind == "many" and solutions != EmptySet and any(v.free_symbols for v in next(iter(solutions))):
            found.append(value)
    assert len(found) == 1, f"expected exactly one value of {parameter}, found {found}"
    return found[0]


def general_solution(tex, rows, extra=None):
    """A published general solution: names x, y, z (plus any named parameter value in `extra`), one free parameter,
    satisfying every equation identically, and not constant. The true solution set must be one-dimensional."""
    extra = extra or {}
    published = parse_assignments(tex)
    expected_names = {"x", "y", "z"} | set(extra)
    if set(published) != expected_names:
        raise AssertionError(f"published names {sorted(published)} are not {sorted(expected_names)}")
    for name, value in extra.items():
        if expand(published[name] - value) != 0:
            raise AssertionError(f"published {name} = {published[name]} is not {value}")
    substitution = {symbols(name): value for name, value in extra.items()}
    rows = [[entry.subs(substitution) if hasattr(entry, "subs") else entry for entry in r] for r in rows]
    family = [published[name] for name in ("x", "y", "z")]
    parameters = set().union(*(value.free_symbols for value in family))
    if len(parameters) != 1:
        raise AssertionError(f"expected one parameter, found {parameters}")
    (lam,) = parameters
    point = dict(zip(XYZ, family))
    for equation in equations(rows):
        residual = expand(equation.subs(point, simultaneous=True))
        if residual != 0:
            raise AssertionError(f"{family} leaves {residual} in the equation {equation} = 0")
    direction = [diff(value, lam) for value in family]
    if all(d == 0 for d in direction) or any(diff(d, lam) != 0 for d in direction):
        raise AssertionError(f"{family} is not a line in its parameter")
    (true_point,) = solution_set(rows)
    free = set().union(*(value.free_symbols for value in true_point))
    assert len(free) == 1, f"true solution set is not a line: {true_point}"


def parabola_through(tex, points):
    a, b, c = symbols("a b c")
    (coefficients,) = linsolve([a * px**2 + b * px + c - py for px, py in points], a, b, c)
    check_same_equation(tex, y - (coefficients[0] * x**2 + coefficients[1] * x + coefficients[2]))
    return coefficients


m, a, p, lam = symbols("m a p lambda")
R = Rational

SYSTEM_ELIMINATION = [(1, 1, 1, 4), (2, -1, 1, 8), (1, 3, -2, -7)]
SYSTEM_ROW_REDUCE = [(2, 1, -1, 3), (1, -1, 2, 7), (3, 2, 1, 6)]
SYSTEM_CHECK_Z = [(1, 2, 1, 3), (2, -1, 3, 3), (3, 1, -1, -4)]
SYSTEM_GDC = [(R(12, 10), R(5, 10), -2, R(31, 10)), (R(8, 10), R(-15, 10), 1, R(-24, 10)), (R(25, 10), 1, R(6, 10), R(73, 10))]
SYSTEM_SHOP = [(3, 2, 1, R(1280, 100)), (1, 1, 2, R(885, 100)), (2, 3, 4, R(2095, 100))]
SYSTEM_INCONSISTENT = [(1, 2, -1, 3), (2, -1, 3, 1), (3, 1, 2, 7)]
SYSTEM_M = [(1, 2, 1, 4), (2, 5, 3, 7), (1, 3, m, 5)]
SYSTEM_A = [(1, 1, 1, 3), (1, 2, 3, 5), (2, 3, a, 9)]
SYSTEM_TWO_EQ = [(1, 1, -1, 3), (2, -1, 4, 0)]
SYSTEM_P = [(1, 2, -1, 3), (3, p, 1, 5), (1, -2, 3, -1)]
SYSTEM_CHECK_GENERAL = [(1, 1, 1, 2), (1, -1, 3, 4)]
REDUCED_MATRIX = [(1, -2, 3, 4), (0, 1, -1, 2), (0, 0, 0, 5)]


def row_operation(tex):
    """(2) - 3 x (1) for x + 2y - z = 4 and 3x + y + 2z = 5, as an equation equal up to a constant factor."""
    eq1, eq2 = equations([(1, 2, -1, 4), (3, 1, 2, 5)])
    check_same_equation(tex, expand(eq2 - 3 * eq1))


def x_equals_y_z(v, tolerance):
    family = {x: 2 + lam, y: 1 - 3 * lam, z: 2 * lam}
    (value,) = solve(family[x] - family[y], lam)
    check_numeric(v, family[z].subs(lam, value), sf=3, tolerance=tolerance)


CHECKS = {
    "before-two-by-two": lambda tex: check_assignments(tex, unique_solution([(3, 2, 7), (1, -1, 4)], (x, y))),
    "before-parallel-lines": lambda tex: count_word(tex, [(-2, 1, 1), (4, -2, 6)], (x, y)),
    "ex-elimination-unique": lambda tex: check_assignments(tex, unique_solution(SYSTEM_ELIMINATION)),
    "ex-row-reduce-unique": lambda tex: check_assignments(tex, unique_solution(SYSTEM_ROW_REDUCE)),
    "check-row-operation": row_operation,
    "check-unique-z": lambda v, tolerance: check_numeric(v, unique_solution(SYSTEM_CHECK_Z)["z"], sf=3, tolerance=tolerance),
    "ex-gdc-unique": lambda tex: rounded_named(tex, unique_solution(SYSTEM_GDC)),
    "ex-parabola-points": lambda tex: parabola_through(tex, [(-1, 8), (2, -1), (4, 13)]),
    "check-shop-price": lambda v, tolerance: check_numeric(v, unique_solution(SYSTEM_SHOP)["y"], dp=2, tolerance=tolerance),
    "check-parabola-a": lambda v, tolerance: check_numeric(
        v, next(iter(linsolve([c0 * px**2 + c1 * px + c2 - py for px, py in [(0, 3), (1, 2), (2, 5)]], c0, c1, c2)))[0],
        sf=3, tolerance=tolerance),
    "ex-inconsistent-show": lambda tex: number_of_solutions(tex, SYSTEM_INCONSISTENT),
    "ex-param-no-solution": lambda tex: check_assignments(tex, {"m": parameter_values(SYSTEM_M, m, "none")}),
    "check-reduced-row-meaning": lambda tex: count_word(tex, REDUCED_MATRIX),
    "check-param-a": lambda v, tolerance: check_numeric(v, parameter_values(SYSTEM_A, a, "none"), sf=3, tolerance=tolerance),
    "ex-general-two-eq": lambda tex: general_solution(tex, SYSTEM_TWO_EQ),
    "ex-general-param": lambda tex: general_solution(tex, SYSTEM_P, {"p": parameter_values(SYSTEM_P, p, "many")}),
    "check-general-solution": lambda tex: general_solution(tex, SYSTEM_CHECK_GENERAL),
    "check-x-equals-y": x_equals_y_z,
}

c0, c1, c2 = symbols("c0 c1 c2")

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "check-unique-z": {"sf": 3},
    "check-shop-price": {"dp": 2},
    "check-parabola-a": {"sf": 3},
    "check-param-a": {"sf": 3},
    "check-x-equals-y": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
