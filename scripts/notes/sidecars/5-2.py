"""SymPy assertions for lesson 5.2 (Increasing and decreasing functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import re
import sys
from pathlib import Path

from sympy import EmptySet, Interval, Poly, Rational, S, Union, diff, exp, nsolve, oo, real_roots, simplify, solve, symbols
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_same_set, parse_answer, parse_list, round_half_up  # noqa: E402

x, t = symbols("x t", real=True)
X = symbols("x")  # mathparse returns plain (non-real) symbols


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def where(expr, positive, var=x):
    """The set of real var where expr > 0 (positive=True) or expr < 0, solved by SymPy."""
    relation = expr > 0 if positive else expr < 0
    return solve_univariate_inequality(relation, var, relational=False)


def set_is(tex, truth, var="x"):
    check_same_set(tex, truth, var=var)


def roots_are(tex, expr):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truth = sorted(solve(expr.subs(x, X), X), key=lambda r: float(r))
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def numeric_roots(expr, brackets):
    """Roots of a transcendental expression, by bisection inside brackets where the sign changes."""
    roots = []
    for a, b in brackets:
        if (expr.subs(x, a) * expr.subs(x, b)).evalf() >= 0:
            raise AssertionError(f"no sign change of {expr} on [{a}, {b}]")
        roots.append(nsolve(expr, x, (a, b), solver="bisect", prec=40))
    return roots


def rounded_set_is(tex, poly, brackets, positive, sf=3):
    """The published set is where the polynomial `poly` has the asked-for sign, with every end point the true root
    rounded to sf. The roots are bisected inside `brackets`; SymPy's exact real-root count proves none is missed. Each
    piece between (and beyond) the roots is kept or dropped by the sign SymPy evaluates at a point inside it."""
    if len(real_roots(Poly(poly, x))) != len(brackets):
        raise AssertionError(f"{poly} has a different number of real roots from the brackets given")
    roots = numeric_roots(poly, brackets)
    edges = [-oo] + roots + [oo]
    pieces = []
    for low, high in zip(edges, edges[1:]):
        inside = high - 1 if low == -oo else low + 1 if high == oo else (low + high) / 2
        value = poly.subs(x, inside).evalf()
        if (value > 0) == positive and value != 0:
            ends = [e if e in (-oo, oo) else Rational(str(round_half_up(e, sf))) for e in (low, high)]
            pieces.append(Interval.open(*ends))
    set_is(tex, Union(*pieces))


# check-sign-word: the word option must name the sign of f'(2) for f'(x) = x^2 - 5x + 4.
WORDS = {"increasing": 1, "decreasing": -1, "stationary": 0}


def word_is(text, derivative, at):
    word = text.strip().lower()
    if word not in WORDS:
        raise ValueError(f"cannot read option {text!r}")
    value = derivative.subs(x, at)
    truth = 1 if value > 0 else -1 if value < 0 else 0
    if WORDS[word] != truth:
        raise AssertionError(f"f'({at}) = {value}, so the answer is not {word}")


# ex-sign-at-point: "<Word>, because $f'(a) = v < 0$" (or "> 0"). The word must name the sign of f'(a), the value
# must be f'(a), and the inequality must match that value's sign.
SIGN_ANSWER = re.compile(r"\s*([A-Za-z]+), because \$f'\((.+?)\) = (.+?) ([<>]) 0\$\s*")


def sign_answer_is(text, derivative, at):
    match = SIGN_ANSWER.fullmatch(text)
    if not match:
        raise ValueError(f"cannot read answer {text!r}")
    word, point, value, relation = match.groups()
    if simplify(parse_answer(point) - at) != 0:
        raise AssertionError(f"answer is about x = {point}, not x = {at}")
    truth = derivative.subs(x, at)
    same(value, truth)
    if (relation == "<") != (truth < 0):
        raise AssertionError(f"f'({at}) = {truth}, so '{relation} 0' is wrong")
    word_is(word, derivative, at)


# check-everywhere-word: each statement claims a set where f is increasing; compare with where f'(x) > 0.
EVERYWHERE = {
    "$f$ is increasing for all $x$": S.Reals,
    "$f$ is decreasing for $x < 2$ and increasing for $x > 2$": Interval.open(2, oo),
    "$f$ is decreasing for all $x$": EmptySet,
}


def statement_is(text, derivative):
    if text not in EVERYWHERE:
        raise ValueError(f"cannot read option {text!r}")
    claimed, truth = EVERYWHERE[text], where(derivative, True)
    if claimed != truth:
        raise AssertionError(f"{text!r} claims increasing on {claimed}, truth {truth}")


def falling_rate(tex, speed):
    """A quantity falling at `speed` units per minute has rate of change -speed: decreasing means a negative
    derivative, and its size is the stated speed. The distractors are +speed (sign slip) and 3 * -speed."""
    same(tex, -speed)


f_cubic = Rational(1, 3) * x**3 - x**2 - 8 * x + 5
graph_fprime = -Rational(1, 2) * (x + 1) * (x - 4)  # the curve drawn in figures/5-2-derivative-graph.svg

CHECKS = {
    "before-gradient": lambda tex: same(tex, diff(5 - 3 * x, x)),
    "before-quadratic-inequality": lambda tex: set_is(tex, where(x**2 - x - 6, False)),
    "ex-sign-at-point": lambda text: sign_answer_is(text, x**2 - 9, 2),
    "ex-rate-context": lambda tex: set_is(tex, where(12 - 3 * t, True, t).intersect(Interval(0, 6)), var="t"),
    "check-sign-word": lambda text: word_is(text, x**2 - 5 * x + 4, 2),
    "check-rate-sign": lambda tex: falling_rate(tex, Rational(3, 2)),
    "ex-graph-increasing": lambda tex: set_is(tex, where(graph_fprime, True)),
    "ex-graph-stationary": lambda tex: roots_are(tex, graph_fprime),
    "check-graph-decreasing": lambda tex: set_is(tex, where(graph_fprime, False)),
    # The lesson states f'(x) = x^2 - 2x - 8; the truth differentiates f itself.
    "ex-intervals-quadratic": lambda tex: set_is(tex, where(diff(f_cubic, x), False)),
    "check-intervals-factor": lambda tex: set_is(tex, where((6 - 2 * x) * exp(x), True)),
    "check-everywhere-word": lambda text: statement_is(text, x**2 - 4 * x + 7),
    "ex-intervals-gdc": lambda tex: rounded_set_is(tex, x**3 - 5 * x + 1, [(-3, -2), (0, 1), (2, 3)], positive=True),
    "check-gdc-endpoint": lambda v, tolerance: upper_end_of_decreasing(v, tolerance),
}


def upper_end_of_decreasing(value, tolerance):
    """g'(x) = x^4 - 4x - 1 has exactly two real roots (SymPy's exact count); g is decreasing between them (g' < 0 at
    their midpoint), so b is the larger root."""
    derivative = x**4 - 4 * x - 1
    if len(real_roots(Poly(derivative, x))) != 2:
        raise AssertionError("g' does not have exactly two real roots")
    low, high = numeric_roots(derivative, [(-1, 0), (1, 2)])
    if derivative.subs(x, (low + high) / 2).evalf() >= 0:
        raise AssertionError("g is not decreasing between the roots")
    check_numeric(value, high, sf=3, tolerance=tolerance)


NUMERIC = {"check-gdc-endpoint": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
