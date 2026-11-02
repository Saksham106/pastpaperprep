"""SymPy assertions for lesson 2.6 (Quadratic functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed from the question's own data: vertices from f'(x) = 0, axes from the vertex, intercepts from
f(0) and solve(f = 0), unknown coefficients by solving the conditions the question states (points, axis, vertex) for
a general quadratic, and ranges from the vertex and the sign of the leading coefficient. Answers that must be in a
given form (vertex form, factorised form) are checked for that shape as well as for equality with the truth.
Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import Interval, Poly, Rational, S, diff, nsimplify, oo, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded_list, check_same_equation, check_same_set, parse_answer,
    parse_list, parse_point,
)

x, y = symbols("x y")
a, b, c = symbols("a b c")

# ------------------------------------------------------------------------------------------------ truths


def vertex(f):
    (xv,) = solve(diff(f, x), x)
    return (xv, simplify(f.subs(x, xv)))


def general_quadratic(conditions):
    """Solve for a, b, c in ax^2 + bx + c from conditions written in terms of q = ax^2 + bx + c."""
    q = a * x**2 + b * x + c
    eqs = conditions(q)
    (sol,) = solve(eqs, [a, b, c], dict=True)
    return q.subs(sol)


def range_set(f):
    """Range of a quadratic on R: from the vertex, up or down by the sign of the leading coefficient."""
    _, k = vertex(f)
    lead = Poly(f, x).LC()
    return Interval(k, oo) if lead > 0 else Interval(-oo, k)


# ------------------------------------------------------------------------------------------------ reading answers

POINT = re.compile(r"\(([^()]*)\)")


def points_in(tex):
    """Every coordinate pair in `(a, b) \\text{ and } (c, d)`, as raw TeX strings."""
    body = tex.strip().strip("$")
    found = POINT.findall(body)
    rest = re.sub(r"\\text\{\s*and\s*\}|\\;|,|\s", "", POINT.sub("", body))
    if not found or rest:
        raise ValueError(f"cannot read a list of points in {tex!r}")
    return found


def exact_points(tex, truths):
    published = [parse_point(f"$({p})$") for p in points_in(tex)]
    if len(published) != len(truths):
        raise AssertionError(f"published {len(published)} points, truth has {len(truths)}: {truths}")
    remaining = list(truths)
    for point in published:
        match = [t for t in remaining if len(point) == 2 and all(simplify(u - v) == 0 for u, v in zip(point, t))]
        if not match:
            raise AssertionError(f"point {point} is not one of {remaining}")
        remaining.remove(match[0])


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != 2 or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")
    return published


def is_linear(expr):
    return expr.has(x) and Poly(expr, x).degree() == 1


def in_vertex_form(tex, truth):
    """Equal to the truth, and written as a constant times (linear)^2 plus a constant."""
    published = same(tex, truth)
    _, term = published.as_independent(x, as_Add=True)
    _, core = term.as_independent(x, as_Add=False)
    if not (core.is_Pow and core.exp == 2 and is_linear(core.base)):
        raise AssertionError(f"{published} is not written in vertex form")


def in_factorised_form(tex, truth):
    """Equal to the truth, and written as a constant times a product of two linear factors."""
    published = same(tex, truth)
    _, core = published.as_independent(x, as_Add=False)
    factors = list(core.args) if core.is_Mul else [core]
    if len(factors) != 2 or not all(is_linear(f) for f in factors):
        raise AssertionError(f"{published} is not written in factorised form")


def zeros_are(tex, f):
    published = sorted(parse_list(tex), key=float)
    truth = sorted(solve(f, x), key=float)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def range_is(tex, name, f):
    """A range written `h(x) \\le 3`: read it as a set of y-values."""
    body = tex.replace(f"{name}(x)", "y")
    if body == tex:
        raise ValueError(f"expected the range in terms of {name}(x): {tex!r}")
    check_same_set(body, range_set(f), var="y")


FACTORED_ROUNDED = re.compile(
    r"(-?\d+(?:\.\d+)?)\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)\s*\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)")


def rounded_factorised_form(tex, f, name="f", sf=3):
    """`f(x) \\approx a(x - p)(x - q)`: a is the exact leading coefficient of f, and p, q are the zeros of f
    (solved from f = 0) rounded half-up to `sf` figures, in either order."""
    body = tex.strip().strip("$")
    parts = body.split("\\approx")
    if len(parts) != 2 or parts[0].strip() != f"{name}(x)":
        raise ValueError(f"expected {name}(x) \\approx a(x - p)(x - q): {tex!r}")
    match = FACTORED_ROUNDED.fullmatch(parts[1].strip())
    if not match:
        raise ValueError(f"cannot read a(x - p)(x - q) in {tex!r}")
    lead, s1, n1, s2, n2 = match.groups()
    if simplify(nsimplify(lead, rational=True) - Poly(f, x).LC()) != 0:
        raise AssertionError(f"leading coefficient {lead} is not {Poly(f, x).LC()}")
    roots = [("-" if s == "+" else "") + n for s, n in ((s1, n1), (s2, n2))]
    check_rounded_list(f"$x \\approx {roots[0]} \\text{{ or }} x \\approx {roots[1]}$", solve(f, x), sf=sf)


# ------------------------------------------------------------------------------------------------ the lesson's data

F_GENERAL = 2 * x**2 - 12 * x + 7
F_AXIS = 5 * x**2 + 20 * x - 3
F_MAX = -3 * x**2 + 12 * x - 5
F_FACTORISED = 2 * (x + 1) * (x - 5)
F_INTERCEPTS = 3 * (x - 4) * (x + 7)
F_READ_VERTEX = 3 * (x + 4) ** 2 - 7
F_VERTEX_CHECK = 5 * (x + 3) ** 2 - 8
G_RANGE = -4 * (x + 1) ** 2 + 3
F_GDC = Rational(3, 5) * (x - Rational(23, 10)) ** 2 - Rational(41, 10)


def find_coefficients():
    # y = a x^2 - 8x + c through (0, 5) with axis x = -2 (vertex where the derivative is 0).
    q = a * x**2 - 8 * x + c
    (sol,) = solve([q.subs(x, 0) - 5, diff(q, x).subs(x, -2)], [a, c], dict=True)
    return {"a": sol[a], "c": sol[c]}


def equation_from_intercepts():
    return general_quadratic(lambda q: [q.subs(x, -5), q.subs(x, 1), q.subs(x, 2) - 21])


def vertex_and_point():
    return general_quadratic(lambda q: [diff(q, x).subs(x, 4), q.subs(x, 4) - 6, q.subs(x, 0) + 2])


def find_a():
    (sol,) = solve((a * (x - 1) * (x - 7)).subs(x, 3) - 24, a)
    return sol


CHECKS = {
    "before-point-on-curve": lambda v, tolerance: check_numeric(
        v, (3 * x**2 - 5 * x + 1).subs(x, 2), dp=0, tolerance=tolerance),
    "before-zeros": lambda tex: zeros_are(tex, (x - 6) * (x + 1)),
    "before-axis-midpoint": lambda tex: check_same_equation(tex, x - vertex((x + 1) * (x - 7))[0]),
    "ex-general-features": lambda tex: same_point(tex, vertex(F_GENERAL)),
    "check-axis-formula": lambda tex: check_same_equation(tex, x - vertex(F_AXIS)[0]),
    "ex-find-coefficients": lambda tex: check_assignments(tex, find_coefficients()),
    "check-max-value": lambda v, tolerance: check_numeric(v, vertex(F_MAX)[1], dp=0, tolerance=tolerance),
    "ex-factorised-vertex": lambda tex: same_point(tex, vertex(F_FACTORISED)),
    "ex-equation-from-intercepts": lambda tex: check_same_equation(tex, y - equation_from_intercepts()),
    "check-read-intercepts": lambda tex: exact_points(tex, [(r, S(0)) for r in solve(F_INTERCEPTS, x)]),
    "check-find-a": lambda v, tolerance: check_numeric(v, find_a(), dp=0, tolerance=tolerance),
    "ex-read-vertex": lambda tex: same_point(tex, vertex(F_READ_VERTEX)),
    "ex-vertex-and-point": lambda tex: in_vertex_form(tex, vertex_and_point()),
    "check-vertex-read": lambda tex: same_point(tex, vertex(F_VERTEX_CHECK)),
    "check-range": lambda tex: range_is(tex, "g", G_RANGE),
    "ex-complete-square": lambda tex: in_vertex_form(tex, x**2 - 10 * x + 18),
    "ex-complete-square-negative-a": lambda tex: in_vertex_form(tex, -2 * x**2 + 4 * x + 30),
    "check-complete-square": lambda tex: in_vertex_form(tex, x**2 + 8 * x + 3),
    "check-factorise": lambda tex: in_factorised_form(tex, 2 * x**2 - 2 * x - 24),
    "ex-gdc-factorised": lambda tex: rounded_factorised_form(tex, F_GDC, sf=3),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-point-on-curve": {"dp": 0},
    "check-max-value": {"dp": 0},
    "check-find-a": {"dp": 0},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
