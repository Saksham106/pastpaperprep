"""SymPy assertions for lesson 5.7 (Second derivative and concavity). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import re
import sys
from pathlib import Path

from sympy import Interval, Rational, diff, exp, log, nsolve, oo, simplify, solve, symbols
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_same_set, parse_answer, round_half_up  # noqa: E402

x = symbols("x", real=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published.subs(symbols("x"), x) - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def where(expr, positive):
    """The set of real x where expr > 0 (positive=True) or expr < 0, solved by SymPy."""
    relation = expr > 0 if positive else expr < 0
    return solve_univariate_inequality(relation, x, relational=False)


def set_is(tex, truth):
    check_same_set(tex, truth, var="x")


def second(f):
    return diff(f, x, 2)


# ex-concave-at-point: "Concave-up/down, because $f''(a) = v < 0$" (or "> 0"). The word must name the sign of
# f''(a), the point must be a, the value must be f''(a), and the inequality must match the value's sign.
CONCAVE_ANSWER = re.compile(r"\s*(Concave-up|Concave-down), because \$f''\((.+?)\) = (.+?) ([<>]) 0\$\s*")


def concave_answer_is(text, f, at):
    match = CONCAVE_ANSWER.fullmatch(text)
    if not match:
        raise ValueError(f"cannot read answer {text!r}")
    word, point, value, relation = match.groups()
    if simplify(parse_answer(point) - at) != 0:
        raise AssertionError(f"answer is about x = {point}, not x = {at}")
    truth = second(f).subs(x, at)
    same(value, truth)
    if (relation == "<") != (truth < 0):
        raise AssertionError(f"f''({at}) = {truth}, so '{relation} 0' is wrong")
    if (word == "Concave-down") != (truth < 0):
        raise AssertionError(f"f''({at}) = {truth}, so the graph is not {word}")


# check-concave-word: each option names a direction (sign of f') and a bend (sign of f'') at the point.
DIRECTION = {"Increasing": 1, "Decreasing": -1}
BEND = {"concave-up": 1, "concave-down": -1}


def describe_is(text, f, at):
    match = re.fullmatch(r"\s*(Increasing|Decreasing) and (concave-up|concave-down)\s*", text)
    if not match:
        raise ValueError(f"cannot read option {text!r}")
    slope, bend = diff(f, x).subs(x, at), second(f).subs(x, at)
    if slope == 0 or bend == 0:
        raise AssertionError("the point is stationary or has f'' = 0; the options do not apply")
    if DIRECTION[match.group(1)] != (1 if slope > 0 else -1):
        raise AssertionError(f"f'({at}) = {slope}, so not {match.group(1)}")
    if BEND[match.group(2)] != (1 if bend > 0 else -1):
        raise AssertionError(f"f''({at}) = {bend}, so not {match.group(2)}")


def bisect_root(expr, a, b):
    if (expr.subs(x, a) * expr.subs(x, b)).evalf() >= 0:
        raise AssertionError(f"no sign change of {expr} on [{a}, {b}]")
    return nsolve(expr, x, (a, b), solver="bisect", prec=40)


def gdc_concave_down(tex):
    """f(x) = e^x - x^3, so f''(x) = e^x - 6x. Its derivative of order two, e^x, is positive, so f'' is strictly
    convex and has at most two zeros; bisection finds two, so these are all of them. f'' < 0 exactly between them
    (checked at their midpoint), and the published end points must be those zeros rounded half-up to 3 s.f."""
    f = exp(x) - x**3
    f2 = second(f)
    if simplify(diff(f2, x, 2) - exp(x)) != 0:
        raise AssertionError("f'''' is not e^x; the two-zero argument does not hold")
    low, high = bisect_root(f2, 0, 1), bisect_root(f2, 2, 3)
    if f2.subs(x, (low + high) / 2).evalf() >= 0:
        raise AssertionError("f'' is not negative between its zeros")
    ends = [Rational(str(round_half_up(r, 3))) for r in (low, high)]
    set_is(tex, Interval.open(*ends))


def gdc_concave_up_start(value, tolerance):
    """g(x) = e^x + x^3, so g''(x) = e^x + 6x and g'''(x) = e^x + 6 > 0: g'' is strictly increasing, so it has one
    zero and is positive exactly to its right. a is that zero."""
    g2 = second(exp(x) + x**3)
    if simplify(diff(g2, x) - (exp(x) + 6)) != 0:
        raise AssertionError("g''' is not e^x + 6")
    check_numeric(value, bisect_root(g2, -1, 0), sf=3, tolerance=tolerance)


# The curve drawn in figures/5-7-fprime-parabola.svg and described in ex-fprime-graph: crosses at -1 and 3,
# lowest point (1, -4).
graph_fprime = (x + 1) * (x - 3)
assert sorted(solve(graph_fprime, x)) == [-1, 3]
assert solve(diff(graph_fprime, x), x) == [1] and graph_fprime.subs(x, 1) == -4

CHECKS = {
    "before-differentiate": lambda tex: same(tex, diff(x**3 - 6 * x**2 + 5 * x, x)),
    "before-chain": lambda tex: same(tex, diff(exp(-3 * x), x)),
    "before-decreasing": lambda tex: set_is(tex, where(x**2 - 4, False)),
    "ex-second-poly": lambda tex: same(tex, second(2 * x**4 - 3 * x**3 + x - 7)),
    "ex-second-product": lambda tex: same(tex, second(x * exp(2 * x))),
    "check-second-power": lambda tex: same(tex, second(x**3 + 4 / x)),
    "check-second-value": lambda v, tolerance: check_numeric(v, second(log(2 * x + 1)).subs(x, 1), sf=3, tolerance=tolerance),
    "ex-concave-at-point": lambda text: concave_answer_is(text, x**3 - 6 * x**2 + 4, 1),
    "ex-concave-down-interval": lambda tex: set_is(tex, where(second(x**4 - 6 * x**2 + 2 * x), False)),
    "check-concave-exp": lambda tex: set_is(tex, where(second((x - 1) * exp(x)), True)),
    "check-concave-word": lambda text: describe_is(text, x**3 - 3 * x**2 - 9 * x + 1, 2),
    # f'' is the gradient of the drawn f' graph: concave-up where that graph rises.
    "ex-fprime-graph": lambda tex: set_is(tex, where(diff(graph_fprime, x), True)),
    # Decreasing (f' < 0) and concave-up (f'' > 0) together.
    "check-fprime-graph": lambda tex: set_is(tex, where(graph_fprime, False).intersect(where(diff(graph_fprime, x), True))),
    "ex-gdc-concave-down": gdc_concave_down,
    "check-gdc-concave-up": gdc_concave_up_start,
}

NUMERIC = {"check-second-value": {"sf": 3}, "check-gdc-concave-up": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
