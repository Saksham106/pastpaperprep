"""SymPy assertions for lesson 2.16 (Modulus and related graph transformations). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Exact solution sets come from SymPy's solveset on the question's own equation or inequality. Turning points come from
the zeros of the derivative, classified by the sign of the derivative either side. The two Paper 2 items have
transcendental end points: each is split into the two cases of the modulus, SymPy proves the monotonicity that makes
each case a single interval, and bisection finds the end point.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Abs, Eq, Interval, Rational, S, Symbol, diff, exp, limit, log, nsolve, oo, simplify, solve, solveset, symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_same_equation, check_same_set, parse_answer, parse_list, parse_point,
    round_half_up,
)

x = Symbol("x", real=True)
y, p = symbols("y p")
X = Symbol("x")  # the plain symbol the parsers return


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(a - b) != 0 for a, b in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def same_values(tex, truth):
    try:
        published = parse_list(tex)
    except ValueError:
        published = [parse_answer(tex)]  # a single answer such as `x = 5`; unreadable text still raises ValueError
    published = sorted(published, key=lambda v: float(v))
    truth = sorted(truth, key=lambda v: float(v))
    if len(published) != len(truth) or any(simplify(a - b) != 0 for a, b in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def set_is(tex, relation):
    check_same_set(tex, solveset(relation.subs(x, X), X, S.Reals))


def turning_points(h):
    """[(x0, kind)] for every zero of h' where h' changes sign: kind is 'max' or 'min'."""
    d = diff(h, x)
    points = []
    for x0 in sorted(solveset(d, x, S.Reals), key=lambda v: float(v)):
        left, right = d.subs(x, x0 - Rational(1, 1000)), d.subs(x, x0 + Rational(1, 1000))
        if left > 0 > right:
            points.append((x0, "max"))
        elif left < 0 < right:
            points.append((x0, "min"))
    return points


def only_max(h):
    maxima = [(x0, simplify(h.subs(x, x0))) for x0, kind in turning_points(h) if kind == "max"]
    assert len(maxima) == 1, maxima
    return maxima[0]


# ---- modulus graphs
F1 = x**2 - 2 * x - 3


def modulus_quadratic_max():
    """The local maximum of |f| lies where f < 0, so |f| = -f there: the maximum of -f on the interval between the roots."""
    x0, value = only_max(-F1)
    assert F1.subs(x, x0) < 0
    return (x0, Abs(F1).subs(x, x0))


def horizontal_asymptote_of_abs():
    f = (1 - 3 * x) / (x + 2)
    left, right = limit(Abs(f), x, -oo), limit(Abs(f), x, oo)
    assert left == right
    return Eq(y, right)


def range_of_f_abs_x():
    """f(|x|) is even, so its range is the range of f on [0, oo). f' = 12/(x + 2)^2 > 0, so f increases from f(0)
    towards its limit, which it never reaches."""
    f = (3 * x - 6) / (x + 2)
    assert simplify(diff(f, x) - 12 / (x + 2) ** 2) == 0
    return Interval.Ropen(f.subs(x, 0), limit(f, x, oo))


def count_f_abs_x_roots():
    f = (x - 1) * (x + 2) * (x - 4)
    return len(solveset(f.subs(x, Abs(x)), x, S.Reals))


# ---- reciprocal and square
def reciprocal_asymptotes():
    """Vertical asymptote of 1/f where f = 0 (and 1/f is unbounded there); horizontal asymptote is the limit at infinity."""
    f = (4 * x - 2) / (x - 3)
    zeros = list(solveset(f, x, S.Reals))
    assert len(zeros) == 1 and limit(Abs(1 / f), x, zeros[0]) == oo
    h = limit(1 / f, x, oo)
    assert h == limit(1 / f, x, -oo)
    return {"x": zeros[0], "y": h}


def count_turning_points_of_square():
    return len(turning_points((x**3 - 3 * x) ** 2))


# ---- f(ax + b)
def point_under(a, b, px, py):
    return (solve(Eq(a * x + b, px), x)[0], py)


def maps_correctly(tex):
    """Read the published sequence ('Translate $h$ units right' / 'stretch horizontally with scale factor $k$', joined
    by ', then'), apply it to a general point p on y = f(x), and compare with the true image: solve 3x - 6 = p."""
    image = p
    for part in re.split(r",\s*then\s+", tex.strip()):
        shift = re.fullmatch(r"[Tt]ranslate \$(.+?)\$ units? right", part.strip())
        stretch = re.fullmatch(r"[Ss]tretch horizontally with scale factor \$(.+?)\$", part.strip())
        if shift:
            image = image + parse_answer(shift.group(1))
        elif stretch:
            image = image * parse_answer(stretch.group(1))
        else:
            raise ValueError(f"cannot read the step {part!r}")
    truth = solve(Eq(3 * x - 6, p), x)[0]
    if simplify(image - truth) != 0:
        raise AssertionError(f"the sequence sends x = p to {image}, not {truth}")


# ---- Paper 2 modulus inequalities
def exp_modulus_set():
    """|e^x - 4| < x + 1. For x < ln 4 it reads 4 - e^x < x + 1, i.e. h1 = e^x + x - 3 > 0, and h1 is increasing.
    For x >= ln 4 it reads h2 = e^x - x - 5 < 0, and h2' = e^x - 1 > 0 there, so h2 is increasing. Each case is one
    interval cut at the single root inside its piece; the two pieces join at ln 4 (h2(ln 4) < 0 and h1(ln 4) > 0)."""
    t = Symbol("t", real=True)
    h1, h2 = exp(x) + x - 3, exp(x) - x - 5
    assert diff(h1, x).subs(x, t).is_positive  # e^t + 1 > 0 for every real t
    assert solveset(diff(h2, x) > 0, x, S.Reals) == Interval.open(0, oo) and log(4) > 0  # h2' > 0 for x > 0
    assert h1.subs(x, log(4)) > 0 and h2.subs(x, log(4)) < 0
    r1 = nsolve(h1, x, (0, 1), solver="bisect", prec=40)
    r2 = nsolve(h2, x, (log(4).evalf(40), 3), solver="bisect", prec=40)
    assert r1 < log(4) < r2
    return r1, r2


def rounded_open_set(tex, low, high):
    lo, hi = Rational(str(round_half_up(low, 3))), Rational(str(round_half_up(high, 3)))
    check_same_set(tex, Interval.open(lo, hi))
    for end in (lo, hi):
        if not re.search(r"(?<![\d.])" + re.escape(str(round_half_up(end, 3))) + r"(?!\d)", tex):
            raise AssertionError(f"{tex!r} does not show {end} at 3 s.f.")


def log_modulus_left_end():
    """|ln x| < 3 - x on 0 < x < 1 reads -ln x < 3 - x, i.e. g = ln x - x + 3 > 0. g' = 1/x - 1 > 0 on (0, 1), so g
    is increasing there and the solution starts at its single root a."""
    g = log(x) - x + 3
    assert simplify(diff(g, x) - (1 - x) / x) == 0  # (1 - x)/x > 0 for 0 < x < 1
    assert g.subs(x, Rational(1, 100)) < 0 < g.subs(x, Rational(1, 2))
    return nsolve(g, x, (Rational(1, 100), Rational(1, 2)), solver="bisect", prec=40)


CHECKS = {
    "before-horizontal-stretch": lambda tex: same_point(tex, (solve(Eq(3 * x, 6), x)[0], 5)),
    "before-quadratic-inequality": lambda tex: set_is(tex, x**2 < 2 * x + 8),
    "ex-modulus-quadratic": lambda tex: same_point(tex, modulus_quadratic_max()),
    "ex-f-modulus-x": lambda tex: same_values(tex, list(solveset(F1.subs(x, Abs(x)), x, S.Reals))),
    "check-modulus-asymptote": lambda tex: check_same_equation(tex, horizontal_asymptote_of_abs()),
    "ex-f-modulus-rational": lambda tex: check_same_set(tex, range_of_f_abs_x(), var="y"),
    "check-roots-f-modulus": lambda v, tolerance: check_numeric(v, count_f_abs_x_roots(), dp=0, tolerance=tolerance),
    "ex-reciprocal-quadratic": lambda tex: same_point(tex, only_max(1 / (2 * x**2 - 8 * x + 6))),
    "ex-reciprocal-rational": lambda tex: check_assignments(tex, reciprocal_asymptotes()),
    "check-reciprocal-turning": lambda tex: same_point(tex, only_max(1 / (x**2 - 6 * x + 13))),
    "ex-square-quadratic": lambda tex: same_point(tex, only_max((x**2 - 4) ** 2)),
    "check-square-turning": lambda v, tolerance: check_numeric(v, count_turning_points_of_square(), dp=0, tolerance=tolerance),
    "ex-bracket-point": lambda tex: same_point(tex, point_under(2, -6, 4, 7)),
    "ex-bracket-describe": lambda tex: same_point(tex, point_under(Rational(1, 2), 1, -2, -3)),
    "check-bracket-order": maps_correctly,
    "check-bracket-intercept": lambda v, tolerance: check_numeric(v, solve(Eq(4 * x + 2, 10), x)[0], dp=0, tolerance=tolerance),
    "ex-modulus-linear": lambda tex: same_values(tex, list(solveset(Eq(Abs(2 * x - 5), 7), x, S.Reals))),
    "check-modulus-linear": lambda tex: same_values(tex, list(solveset(Eq(Abs(3 * x + 2), 8), x, S.Reals))),
    "ex-modulus-false-root": lambda tex: same_values(tex, list(solveset(Eq(Abs(x + 1), 2 * x - 4), x, S.Reals))),
    "ex-modulus-square": lambda tex: set_is(tex, Abs(x - 3) > Abs(2 * x + 1)),
    "check-modulus-inequality": lambda tex: set_is(tex, Abs(2 * x - 1) <= 5),
    "ex-gdc-modulus": lambda tex: rounded_open_set(tex, *exp_modulus_set()),
    "check-gdc-log-modulus": lambda v, tolerance: check_numeric(v, log_modulus_left_end(), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "check-roots-f-modulus": {"dp": 0},
    "check-square-turning": {"dp": 0},
    "check-bracket-intercept": {"dp": 0},
    "check-gdc-log-modulus": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
