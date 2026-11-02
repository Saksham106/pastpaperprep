"""SymPy assertions for lesson 2.4 (Key features of graphs). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed from the question's own functions: intercepts from f(0) and solve(f = 0), extreme values
from the critical points and the end points of the domain, asymptotes from the zero of the denominator and limits
as x -> +/- infinity, and intersections from solving f(x) = g(x). Where the equation has no algebraic solution
(GDC questions), the roots are bracketed by sign changes on a fine grid, the number of roots is bounded by the sign
of the second derivative (a concave or convex function minus a line has at most two zeros), and each root is
found by bisection inside its bracket. Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import (
    FiniteSet, Interval, Rational, S, cos, diff, exp, limit, log, nsolve, oo, real_roots, simplify, solve, solveset,
    symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded_list, check_same_equation, check_same_set, parse_answer,
    parse_approx, parse_point, round_half_up,
)
from sympy.calculus.util import function_range  # noqa: E402

x, y = symbols("x y")  # mathparse returns plain symbols


# ------------------------------------------------------------------------------------------------ reading answers

POINT = re.compile(r"\(([^()]*)\)")


def points_in(tex):
    """Every coordinate pair in `(a, b), \\; (c, d)` or `(a, b) \\text{ and } (c, d)`, as raw TeX strings."""
    body = tex.strip().strip("$")
    found = POINT.findall(body)
    rest = POINT.sub("", body)
    rest = re.sub(r"\\text\{\s*and\s*\}|\\;|,|\s", "", rest)
    if not found or rest:
        raise ValueError(f"cannot read a list of points in {tex!r}")
    return found


def same_point(published, truth):
    if len(published) != 2 or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {list(truth)}")


def exact_points(tex, truths):
    """An exact list of points, in any order, equal to the true list."""
    published = [parse_point(f"$({p})$") for p in points_in(tex)]
    if len(published) != len(truths):
        raise AssertionError(f"published {len(published)} points, truth has {len(truths)}: {truths}")
    remaining = list(truths)
    for point in published:
        match = [t for t in remaining if all(simplify(a - b) == 0 for a, b in zip(point, t))]
        if len(point) != 2 or not match:
            raise AssertionError(f"point {point} is not one of {remaining}")
        remaining.remove(match[0])


def rounded_coordinate(text, truth, sf=3):
    value, figures, _, _ = parse_approx(f"${text}$")
    if figures != sf:
        raise AssertionError(f"{text!r} shows {figures} significant figures, {sf} required")
    if value != round_half_up(truth, sf):
        raise AssertionError(f"{text!r} is not {truth} rounded to {sf} s.f. ({round_half_up(truth, sf)})")


def rounded_points(tex, truths, sf=3):
    """Points whose coordinates are each rounded to `sf` significant figures, compared in order of x."""
    pieces = []
    for p in points_in(tex):
        coords = [c.strip() for c in p.split(",")]
        if len(coords) != 2:
            raise ValueError(f"cannot read the point ({p})")
        pieces.append(coords)
    if len(pieces) != len(truths):
        raise AssertionError(f"published {len(pieces)} points, truth has {len(truths)}")
    pieces.sort(key=lambda c: float(parse_approx(f"${c[0]}$")[0]))
    for (px, py), (tx, ty) in zip(pieces, sorted(truths, key=lambda t: float(t[0]))):
        rounded_coordinate(px, tx, sf)
        rounded_coordinate(py, ty, sf)


def labelled(text, pattern):
    """The maths of an answer like `Label $a$; label $b$`, one TeX string per group of `pattern` (whole text)."""
    match = re.fullmatch(pattern, text.strip())
    if not match:
        raise ValueError(f"cannot read {text!r} as {pattern!r}")
    return [f"${m}$" for m in match.groups()]


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


# ------------------------------------------------------------------------------------------------ numerical roots

def roots_on(h, a, b, steps=4000):
    """Real roots of h in ]a, b[, bracketed by sign changes on a grid and refined by bisection."""
    roots = []
    xs = [a + (b - a) * Rational(i, steps) for i in range(1, steps)]
    values = [h.subs(x, p).evalf(30) for p in xs]
    for (p, hp), (q, hq) in zip(zip(xs, values), zip(xs[1:], values[1:])):
        if hp == 0:
            roots.append(p)
        elif hp * hq < 0:
            roots.append(nsolve(h, x, (p, q), solver="bisect", prec=30))
    return roots


# ------------------------------------------------------------------------------------------------ truths

def intercepts(f):
    return [(S(0), f.subs(x, 0))] + [(r, S(0)) for r in solve(f, x)]


def max_on(f, a, b):
    """Largest value of f on [a, b]: the critical points inside and the two end points."""
    candidates = [S(a), S(b)] + list(solveset(diff(f, x), x, Interval(a, b)))
    return max((f.subs(x, c) for c in candidates), key=lambda v: float(v))


def local_max_point(f):
    """The one critical point where f'' < 0."""
    found = [c for c in solve(diff(f, x), x) if diff(f, x, 2).subs(x, c) < 0]
    if len(found) != 1:
        raise AssertionError(f"expected one local maximum, found {found}")
    return (found[0], f.subs(x, found[0]))


def max_on_domain(text):
    point, value = labelled(text, r"Local maximum \$([^$]*)\$; maximum value \$([^$]*)\$")
    rounded_points(point, [local_max_point(F_DOMAIN)])
    same(value, max_on(F_DOMAIN, -2, 4))


def asymptote_and_range(text):
    g = 3 - 2 * exp(-x)
    asymptote, rng = labelled(text, r"Asymptote \$([^$]*)\$; range \$([^$]*)\$")
    check_same_equation(asymptote, y - horizontal_right_only(g))
    if not re.fullmatch(r"\$\s*g\(x\)[^$]*\$", rng):
        raise ValueError(f"the range {rng!r} should be written in terms of g(x)")
    check_same_set(rng.replace("g(x)", "y"), function_range(g, x, S.Reals), var="y")


def parabola_vertex(f):
    (xv,) = solve(diff(f, x), x)
    return (xv, f.subs(x, xv))


def vertical_asymptotes(num, den):
    """x = a where the denominator is 0, the numerator is not, and the function is unbounded there."""
    found = []
    for a in solve(den, x):
        if num.subs(x, a) != 0 and abs(limit(num / den, x, a, "+")) == oo:
            found.append(a)
    return found


def horizontal_asymptote(f):
    right, left = limit(f, x, oo), limit(f, x, -oo)
    if right != left or not right.is_finite:
        raise AssertionError(f"limits {left}, {right} do not give one horizontal asymptote")
    return right


def horizontal_right_only(f):
    right, left = limit(f, x, oo), limit(f, x, -oo)
    if not right.is_finite or left.is_finite:
        raise AssertionError(f"expected an asymptote only on the right, limits {left}, {right}")
    return right


def one_vertical(num, den):
    found = vertical_asymptotes(num, den)
    if len(found) != 1:
        raise AssertionError(f"expected one vertical asymptote, found {found}")
    return found[0]


def zero_gdc_truth():
    # g(x) = 2^x - x - 3 is convex (g'' = 2^x ln(2)^2 > 0), so it has at most two zeros; the positive one lies in ]0, 5[.
    g = 2**x - x - 3
    assert simplify(diff(g, x, 2) - 2**x * log(2) ** 2) == 0
    positive = roots_on(g, 0, 5)
    if len(positive) != 1:
        raise AssertionError(f"expected one positive zero, found {positive}")
    return positive[0]


def min_gdc_truth():
    h = x**2 - 4 * log(x)
    crit = solveset(diff(h, x), x, Interval.open(0, oo))
    if not isinstance(crit, FiniteSet) or len(crit) != 1:
        raise AssertionError(f"expected one critical point, found {crit}")
    (c,) = crit
    if not diff(h, x, 2).subs(x, c) > 0:
        raise AssertionError("the critical point is not a minimum")
    return h.subs(x, c)  # one critical point on ]0, oo[ with h'' > 0, and h -> oo at both ends: the global minimum


def intersect_gdc_truth():
    # h = ln(x+2) - (x^2 - 3) has h'' = -1/(x+2)^2 - 2 < 0 on ]-2, oo[, so at most two zeros. For x >= 4,
    # ln(x+2) <= x + 1 < x^2 - 3 (as x^2 - x - 4 > 0 there), so every zero lies in ]-2, 4[.
    h = log(x + 2) - (x**2 - 3)
    roots = roots_on(h, -2, 4)
    if len(roots) != 2:
        raise AssertionError(f"expected two intersections, found {roots}")
    return [(r, log(r + 2)) for r in roots]


def intersection_count_truth():
    # h = e^x - x - 2 is convex (h'' = e^x > 0), so at most two zeros, all inside ]-10, 10[ (h > 0 outside there).
    h = exp(x) - x - 2
    if h.subs(x, -10) <= 0 or h.subs(x, 10) <= 0:
        raise AssertionError("bracket too narrow")
    return len(roots_on(h, -10, 10))


def trig_truth():
    # 3cos x <= 3 < x for x > 3, so every positive solution of 3cos x = x lies in ]0, 3].
    h = 3 * cos(x) - x
    roots = roots_on(h, 0, 3)
    if len(roots) != 1:
        raise AssertionError(f"expected one positive solution, found {roots}")
    return roots[0]


def on_line_5_minus_2x(tex):
    a, b = parse_point(tex)
    if simplify(b - (5 - 2 * a)) != 0:
        raise AssertionError(f"({a}, {b}) is not on y = 5 - 2x")


# ------------------------------------------------------------------------------------------------ assertions

F_INTERCEPTS = x**2 + 2 * x - 15
F_ZEROS = x**3 - 5 * x + 1
F_DOMAIN = x**3 - 2 * x**2 - 4 * x + 3
F_VERTEX = x**2 - 8 * x + 7
PARABOLA_AXIS = (x + 6) * (x - 2)  # any parabola with zeros -6 and 2 has this axis

CHECKS = {
    "before-point-on-graph": on_line_5_minus_2x,
    "before-missing-coordinate": lambda v, tolerance: check_numeric(
        v, solve(3 * x - 4 - 11, x)[0], dp=0, tolerance=tolerance),
    "ex-intercepts-quadratic": lambda tex: exact_points(tex, intercepts(F_INTERCEPTS)),
    "ex-zeros-gdc": lambda tex: check_rounded_list(tex, real_roots(F_ZEROS), sf=3),
    "check-y-intercept": lambda tex: same_point(parse_point(tex), (0, ((x - 4) * (2 * x + 3)).subs(x, 0))),
    "check-zero-gdc": lambda v, tolerance: check_numeric(v, zero_gdc_truth(), sf=3, tolerance=tolerance),
    "ex-max-on-domain": max_on_domain,
    "ex-vertex-symmetry": lambda tex: same_point(parse_point(tex), parabola_vertex(F_VERTEX)),
    "check-axis-symmetry": lambda tex: check_same_equation(tex, x - parabola_vertex(PARABOLA_AXIS)[0]),
    "check-min-gdc": lambda v, tolerance: check_numeric(v, min_gdc_truth(), sf=3, tolerance=tolerance),
    "ex-asymptotes-rational": lambda tex: check_assignments(
        tex, {"x": one_vertical(4 * x - 1, x + 2), "y": horizontal_asymptote((4 * x - 1) / (x + 2))}),
    "ex-asymptote-exponential": asymptote_and_range,
    "check-vertical-asymptote": lambda tex: check_same_equation(tex, x - one_vertical(S(5), 2 * x - 6)),
    "check-horizontal-asymptote": lambda tex: check_same_equation(tex, y - horizontal_asymptote(5 + 2 / (x - 1))),
    "ex-line-parabola": lambda tex: exact_points(
        tex, [(s[x], s[y]) for s in solve([y - (2 * x - 3), y - (x**2 - 3 * x + 1)], [x, y], dict=True)]),
    "ex-intersect-gdc": lambda tex: rounded_points(tex, intersect_gdc_truth()),
    "check-intersection-count": lambda tex: same(tex, intersection_count_truth()),
    "check-intersect-trig": lambda v, tolerance: check_numeric(v, trig_truth(), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-missing-coordinate": {"dp": 0},
    "check-zero-gdc": {"sf": 3},
    "check-min-gdc": {"sf": 3},
    "check-intersect-trig": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
