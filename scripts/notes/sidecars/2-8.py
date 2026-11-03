"""SymPy assertions for lesson 2.8 (Reciprocal and linear-over-linear rational functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed from each question's own function: inverses by solving y = f(x) for x, asymptotes as the zero of the
denominator and the limit as x -> oo, ranges as the outputs v for which f(x) = v has a solution, intercepts by
substitution and solving, self-inverse by composing f with itself, and the typing model's crossings by solving.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Interval, Rational, S, Symbol, denom, limit, numer, oo, simplify, solve, sqrt, symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded_list, check_same_equation, check_same_set, parse_answer,
    parse_point,
)

x, y, t, v, a, d = symbols("x y t v a d")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def inverse_of(f):
    """Solve y = f(x) for x (one solution for a one-to-one function), then rename y as x."""
    sols = solve(f - y, x)
    assert len(sols) == 1, sols
    return sols[0].subs(y, x)


def vertical_asymptote(f):
    """The zero of the denominator, confirmed not to be a zero of the numerator (so f really blows up there)."""
    f = simplify(f)
    roots = solve(denom(f), x)
    assert len(roots) == 1, roots
    assert simplify(numer(f).subs(x, roots[0])) != 0
    return roots[0]


def horizontal_asymptote(f):
    left, right = limit(f, x, -oo), limit(f, x, oo)
    assert left == right and left.is_finite
    return right


def excluded_output(f):
    """The one value v for which f(x) = v has no solution: solve f(x) = v for x and find where that formula breaks."""
    sols = solve(f - v, x)
    assert len(sols) == 1, sols
    missing = solve(denom(simplify(sols[0])), v)
    assert len(missing) == 1, missing
    assert solve(f - missing[0], x) == []
    return missing[0]


def range_is(tex, f):
    """Published range: `y \\ne k` (compared with the true excluded value) or an inequality / interval (compared as a set)."""
    truth_value = excluded_output(f)
    cleaned = tex.replace("$", "").strip()
    match = re.fullmatch(r"([A-Za-z])\s*\\neq?\s*(.+)", cleaned)
    if match:
        if match.group(1) != "y":
            raise AssertionError(f"range written for {match.group(1)}, not y")
        published = parse_answer(match.group(2))
        if simplify(published - truth_value) != 0:
            raise AssertionError(f"published excluded value {published} is not {truth_value}")
        return
    truth_set = Interval.open(-oo, truth_value).union(Interval.open(truth_value, oo))
    check_same_set(tex, truth_set, var="y")


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != 2 or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def intercept_points(tex, f):
    """`(0, k) \\text{ and } (m, 0)`: both axis intercepts, as a set of points."""
    pieces = [piece for piece in re.split(r"\\text\{\s*and\s*\}", tex.replace("$", "")) if piece.strip()]
    published = sorted((tuple(parse_point(piece)) for piece in pieces), key=lambda p: (float(p[0]), float(p[1])))
    roots = solve(numer(simplify(f)), x)
    truth = sorted([(S(0), f.subs(x, 0))] + [(r, S(0)) for r in roots], key=lambda p: (float(p[0]), float(p[1])))
    if len(published) != len(truth) or any(
        simplify(p[0] - q[0]) != 0 or simplify(p[1] - q[1]) != 0 for p, q in zip(published, truth)
    ):
        raise AssertionError(f"published intercepts {published}, truth {truth}")


def branch_regions(text, f):
    """Word answer. The right branch sits above or below the horizontal asymptote (test just right of the vertical one);
    the left branch is in the opposite vertical half. Compare the set of regions named."""
    va, ha = vertical_asymptote(f), horizontal_asymptote(f)
    right_high = f.subs(x, va + 1) > ha
    left_high = f.subs(x, va - 1) > ha
    assert right_high != left_high  # the branches lie in opposite regions
    truth = {("top" if right_high else "bottom") + "-right", ("top" if left_high else "bottom") + "-left"}
    named = set(re.findall(r"(top|bottom)-(left|right)", text.lower()))
    named = {f"{p}-{q}" for p, q in named}
    if len(named) != 2:
        raise ValueError(f"cannot read two regions in {text!r}")
    if named != truth:
        raise AssertionError(f"published regions {sorted(named)}, truth {sorted(truth)}")


def self_inverse(tex):
    """The published function must satisfy f(f(x)) = x."""
    f = parse_answer(tex)
    if simplify(f.subs(x, f) - x) != 0:
        raise AssertionError(f"{f} is not self-inverse")


def asymptote_unknowns(tex):
    """y = (a x + 3)/(2x + d) with asymptotes x = 4 and y = -3: solve for a and d from the zero of the bottom and the
    limit at infinity."""
    f = (a * x + 3) / (2 * x + d)
    va = solve(2 * x + d, x)[0]
    ha = limit(f, x, oo)
    sol = solve([va - 4, ha + 3], [a, d], dict=True)
    assert len(sol) == 1
    found = (sol[0][a] * x + 3) / (2 * x + sol[0][d])
    assert vertical_asymptote(found) == 4 and horizontal_asymptote(found) == -3
    check_assignments(tex, {a: sol[0][a], d: sol[0][d]})


def asymptote_pair(tex, f):
    check_assignments(tex, {x: vertical_asymptote(f), y: horizontal_asymptote(f)})


RECIP = 1 / x
NINE = 9 / x
SPEED = (60 * t + 20) / (t + 4)
BROTHER = 15 + 4 * t


def nine_over_x_distance():
    meets = solve(NINE - x, x)
    assert len(meets) == 2
    (x1, x2) = meets
    return sqrt((x1 - x2) ** 2 + (x1 - x2) ** 2)  # both points lie on y = x


def typing_crossings():
    roots = [r for r in solve(SPEED - BROTHER, t) if 0 <= r <= 10]
    assert len(roots) == 2
    return roots



def self_inverse_show(tex):
    """The published h^{-1}(x) must equal the inverse found by solving y = h(x); the "show" part (h(h(x)) = x)
    is asserted on the question's own h so the example's claim that h is self-inverse is checked too."""
    h = (3 * x + 4) / (2 * x - 3)
    assert simplify(h.subs(x, h) - x) == 0, "h o h is not the identity"
    same(tex, inverse_of(h))


CHECKS = {
    "before-undefined": lambda val, tolerance: check_numeric(
        val, solve(denom((x + 1) / (2 * x - 7)), x)[0], sf=3, tolerance=tolerance),
    "before-x-intercept": lambda tex: same_point(tex, [solve(12 - 3 * x, x)[0], 0]),
    "before-inverse-linear": lambda tex: same(tex, inverse_of(3 * x - 4)),
    "ex-reciprocal-inverse": lambda tex: same(tex, inverse_of(RECIP)),
    "ex-reciprocal-distance": lambda tex: same(tex, nine_over_x_distance()),
    "check-reciprocal-swap": lambda tex: same_point(tex, [RECIP.subs(x, 4), 4]),
    "check-reciprocal-range": lambda tex: range_is(tex, RECIP),
    "ex-asymptotes-basic": lambda tex: asymptote_pair(tex, (6 * x + 1) / (2 * x - 3)),
    "check-horizontal-asymptote": lambda tex: check_same_equation(
        tex, y - horizontal_asymptote((5 * x + 2) / (3 * x - 1))),
    "ex-asymptotes-unknowns": asymptote_unknowns,
    "check-vertical-asymptote": lambda val, tolerance: check_numeric(
        val, vertical_asymptote((x - 7) / (4 * x + 10)), sf=3, tolerance=tolerance),
    "ex-sketch-basic": lambda tex: intercept_points(tex, (3 * x - 6) / (x + 3)),
    "check-branch-regions": lambda text: branch_regions(text, (2 * x - 5) / (x - 1)),
    "ex-sketch-range": lambda tex: range_is(tex, (x + 6) / (8 - 2 * x)),
    "check-y-intercept": lambda val, tolerance: check_numeric(
        val, ((x - 9) / (3 * x - 4)).subs(x, 0), sf=3, tolerance=tolerance),
    "ex-inverse-rational": lambda tex: same(tex, inverse_of((4 * x - 3) / (x + 6))),
    "ex-self-inverse-show": self_inverse_show,
    "check-self-inverse-choice": self_inverse,
    "check-inverse-asymptote": lambda val, tolerance: check_numeric(
        val, vertical_asymptote(inverse_of((2 * x + 9) / (x - 7))), sf=3, tolerance=tolerance),
    "ex-typing-gdc": lambda tex: check_rounded_list(tex, typing_crossings(), sf=3),
    "check-typing-40": lambda val, tolerance: check_numeric(
        val, solve(SPEED - 40, t)[0], sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-undefined": {"sf": 3},
    "check-vertical-asymptote": {"sf": 3},
    "check-y-intercept": {"sf": 3},
    "check-inverse-asymptote": {"sf": 3},
    "check-typing-40": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
