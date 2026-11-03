"""SymPy assertions for lesson 2.15 (Function inequalities). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every exact solution set is computed here by SymPy's solveset from the question's own inequality and compared with the
published set. A Paper 2 answer has rounded end points: its true set is built from roots SymPy finds (exactly where it
can, by bisection where it can't), each irrational end point rounded half-up to 3 s.f., and the published set must
match it piece by piece, including which ends are open.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Float, Interval, Rational, S, Symbol, Union, diff, exp, expand, log, nsolve, oo, simplify, solveset, symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_same_set, parse_answer, parse_set, round_half_up  # noqa: E402

x = symbols("x")
t = Symbol("t", positive=True)


def solved(relation):
    return solveset(relation, x, S.Reals)


def set_is(tex, relation):
    check_same_set(tex, solved(relation))


def round_end(end, sf=3):
    """An integer end point stays exact; any other end point is rounded half-up to sf significant figures."""
    if end in (-oo, oo) or end.is_integer:
        return end
    return Rational(str(round_half_up(end, sf)))


def rounded(truth, sf=3):
    """The true set with every non-integer end point rounded, keeping each end open or closed as it was."""
    pieces = truth.args if isinstance(truth, Union) else (truth,)
    return Union(*[
        Interval(round_end(p.start, sf), round_end(p.end, sf), left_open=p.left_open, right_open=p.right_open)
        for p in pieces
    ])


def exact_pieces(interval_set):
    """The intervals of a set, left to right, with every decimal (Float) end point turned into the exact Rational it
    is written as. parse_set reads -1.30 as a Float, and SymPy treats Float -1.3 and Rational -13/10 as different
    numbers, so a set comparison would let a single-point difference at a rounded end (open vs closed) slip through."""
    pieces = interval_set.args if isinstance(interval_set, Union) else (interval_set,)
    exact = lambda end: Rational(str(end)) if isinstance(end, Float) else end  # noqa: E731
    return sorted(
        ((exact(p.start), exact(p.end), bool(p.left_open), bool(p.right_open)) for p in pieces),
        key=lambda piece: float(piece[0]) if piece[0] != -oo else float("-inf"),
    )


def rounded_set_is(tex, truth, sf=3):
    """The published set is the rounded truth piece by piece: the same number of intervals, the same exact end
    points, and each end open or closed exactly as in the truth. Every rounded end point must also be written at
    exactly sf figures (so 2.3 for 2.30 fails: equal in value, but at the wrong precision)."""
    published, expected = exact_pieces(parse_set(tex)), exact_pieces(rounded(truth, sf))
    if len(published) != len(expected):
        raise AssertionError(f"published {published} has {len(published)} pieces, truth {expected}")
    for got, want in zip(published, expected):
        if any(g != w and simplify(g - w) != 0 for g, w in zip(got[:2], want[:2])) or got[2:] != want[2:]:
            raise AssertionError(f"published piece {got} is not {want} (start, end, left_open, right_open)")
    pieces = truth.args if isinstance(truth, Union) else (truth,)
    for end in [e for p in pieces for e in (p.start, p.end)]:
        if end in (-oo, oo) or end.is_integer:
            continue
        digits = str(abs(round_half_up(end, sf)))
        if not re.search(r"(?<![\d.])" + re.escape(digits) + r"(?![\d])", tex):
            raise AssertionError(f"{tex!r} does not show the end point {digits} at {sf} s.f.")


def same_expression(tex, truth):
    published = parse_answer(tex)
    if simplify(expand(published - truth)) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def log_quadratic_set():
    """ex-gdc-log-quadratic: ln(x + 3) > x^2 - 2x on the domain x > -3. h = ln(x + 3) - x^2 + 2x has
    h'' = -1/(x + 3)^2 - 2 < 0 on the whole domain, so h is concave and has at most two zeros. Bisection finds two
    inside brackets where h changes sign, and h > 0 strictly between them (tested at x = 0)."""
    h = log(x + 3) - (x**2 - 2 * x)
    assert diff(h, x, 2).subs(x, t - 3).is_negative  # x = t - 3 with t > 0 covers the domain x > -3
    roots = []
    for a, b in ((-1, 0), (2, 3)):
        assert (h.subs(x, a) * h.subs(x, b)).evalf() < 0
        roots.append(nsolve(h, x, (a, b), solver="bisect", prec=40))
    assert h.subs(x, 0).evalf() > 0
    return Interval.open(roots[0], roots[1])


def exp_line_root():
    """check-gdc-exp-line: e^(-x) >= x + 2. h = e^(-x) - x - 2 has h' = -e^(-x) - 1 < 0, so h is strictly
    decreasing with exactly one zero a, and h >= 0 exactly when x <= a. Bisection finds a."""
    h = exp(-x) - x - 2
    assert diff(h, x).subs(x, Symbol("s", real=True)).is_negative
    assert (h.subs(x, -1) * h.subs(x, 0)).evalf() < 0
    return nsolve(h, x, (-1, 0), solver="bisect", prec=40)


CHECKS = {
    "before-quadratic-inequality": lambda tex: set_is(tex, x**2 - 2 * x - 15 > 0),
    "before-factor-cubic": lambda tex: same_expression(tex, x**3 - 3 * x**2 - 4 * x + 12),
    "ex-graph-parabola-line": lambda tex: set_is(tex, 4 - x**2 >= x + 2),
    "check-parabola-line": lambda tex: set_is(tex, x**2 - 1 < x + 1),
    "ex-graph-reciprocal-line": lambda tex: set_is(tex, 6 / x < x + 1),
    "check-reciprocal-line": lambda tex: set_is(tex, 4 / x <= x),
    "ex-cubic-three-roots": lambda tex: set_is(tex, x**3 + 6 >= 2 * x**2 + 5 * x),
    "ex-cubic-repeated-root": lambda tex: set_is(tex, x**3 < 3 * x**2 - 4),
    "check-cubic-common-factor": lambda tex: set_is(tex, x**3 + x**2 <= 2 * x),
    "ex-rational-square": lambda tex: set_is(tex, 12 / x >= x + 4),
    "check-cubic-touch": lambda tex: set_is(tex, x**3 - 2 * x**2 > 4 * x - 8),
    "ex-gdc-log-quadratic": lambda tex: rounded_set_is(tex, log_quadratic_set()),
    "ex-gdc-rational": lambda tex: rounded_set_is(tex, solved((2 * x + 1) / (x - 1) <= x + 2)),
    "check-gdc-exp-line": lambda v, tolerance: check_numeric(v, exp_line_root(), sf=3, tolerance=tolerance),
    "check-asymptote-only": lambda tex: set_is(tex, 4 / (x + 1) > 2 - x),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-gdc-exp-line": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
