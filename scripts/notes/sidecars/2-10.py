"""SymPy assertions for lesson 2.10 (Solving equations graphically and analytically). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import sys
from pathlib import Path

from sympy import (
    Interval, Poly, Rational, S, Symbol, ceiling, exp, limit, log, nsolve, oo, real_roots, simplify, solveset, sqrt,
    symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded, check_rounded_list, check_same_equation, parse_answer, parse_list,
)

x = symbols("x")  # mathparse returns plain symbols
y = symbols("y")
r = symbols("r", real=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def values_are(tex, truths):
    """Several exact values of one unknown (parse_list), or a single one (parse_answer), compared as sorted lists."""
    try:
        published = parse_list(tex)
    except ValueError:
        published = [parse_answer(tex)]
    published = sorted(published, key=lambda v: float(v))
    truth = sorted(truths, key=lambda v: float(v))
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def real_solutions(expr, domain=S.Reals):
    """Exact real solutions of expr = 0 on the domain, as a sorted list (solveset must return a finite set)."""
    solutions = solveset(expr, r, domain)
    if not solutions.is_FiniteSet:
        raise AssertionError(f"solveset did not return a finite set for {expr}: {solutions}")
    return sorted(solutions, key=lambda v: float(v))


def roots_in(h, a, b, steps=4000):
    """Every zero of the continuous function h(r) on [a, b]: a dense sign scan finds the brackets, each bisected to
    40 digits. Callers prove separately that no zero lies outside [a, b] and that no bracket can hide two zeros."""
    grid = [a + (b - a) * Rational(k, steps) for k in range(steps + 1)]
    values = [h.subs(r, p).evalf(30) for p in grid]
    if any(v == 0 for v in values):
        raise AssertionError("a grid point is an exact zero; shift the interval")
    brackets = [(grid[k], grid[k + 1]) for k in range(steps) if values[k] * values[k + 1] < 0]
    return [nsolve(h, r, (p.evalf(30), q.evalf(30)), solver="bisect", prec=40) for p, q in brackets]


# --- prerequisites ---------------------------------------------------------------------------------------------------

def asymptote(tex):
    """Horizontal asymptote of y = 5 - 2e^(-x): the limit as x -> oo (as x -> -oo the curve is unbounded)."""
    level = limit(5 - 2 * exp(-r), r, oo)
    check_same_equation(tex, y - level)


# --- graphs ----------------------------------------------------------------------------------------------------------

def same_zeros_graph(tex):
    """The published graph y = h(x) must have exactly the solutions of ln x = 2 - x as its zeros: h is the difference
    of the two sides, up to a non-zero constant factor."""
    published = parse_answer(tex)
    truth = log(x) - (2 - x)
    ratio = simplify(published / truth)
    if ratio.free_symbols or ratio == 0:
        raise AssertionError(f"y = {published} is not a non-zero multiple of {truth}")


def count_exp_parabola():
    """e^x = 4 - x^2. Outside [-2, 2] the parabola is negative and e^x positive, so every zero lies in [-2, 2]."""
    h = exp(r) - (4 - r**2)
    if not all(h.subs(r, end).evalf() > 0 for end in (-2, 2)):
        raise AssertionError("end-point argument fails")
    return len(roots_in(h, -2, 2))


def count_cubic_line():
    """x^3 - 3x = 1: the number of distinct real roots of the cubic x^3 - 3x - 1."""
    return len(real_roots(Poly(r**3 - 3 * r - 1, r)))


# --- algebra ---------------------------------------------------------------------------------------------------------

def power_quadratic():
    """4^x - 2^(x+1) - 15 = 0, solved over the reals."""
    return real_solutions(4**r - 2 ** (r + 1) - 15)


# --- technology ------------------------------------------------------------------------------------------------------

def exp_line_roots():
    """e^x = x + 3. h = e^x - x - 3 is convex (h'' = e^x > 0), so it has at most two zeros. h(-10) > 0, h(5) > 0, and
    the scan finds two sign changes in between, so these are all of them."""
    h = exp(r) - r - 3
    roots = roots_in(h, -10, 5)
    if len(roots) != 2:
        raise AssertionError(f"expected two roots, found {roots}")
    return roots


def quintic_roots():
    """x^5 - 3x + 1 = 0: every real root of the polynomial."""
    return [root.evalf(40) for root in real_roots(Poly(r**5 - 3 * r + 1, r))]


def ln_line_root():
    """ln x = 3 - x: h = ln x + x - 3 is increasing on x > 0 (h' = 1/x + 1 > 0), so it has one zero, inside [1, 5]."""
    roots = roots_in(log(r) + r - 3, 1, 5)
    if len(roots) != 1:
        raise AssertionError(f"expected one root, found {roots}")
    return roots[0]


def cube_power_other_root():
    """x^3 = 2^x for x > 0. For x >= 30, 2^x > x^3 (true at 30, and the ratio 2^x / x^3 increases for x > 3/ln 2).
    Scan (0, 30] for both positive roots; the published one is the root that is not about 1.37."""
    h = r**3 - 2**r
    if not (2**30 > 30**3):
        raise AssertionError("end argument fails")
    roots = roots_in(h, Rational(1, 100), 30)
    if len(roots) != 2:
        raise AssertionError(f"expected two positive roots, found {roots}")
    small, large = sorted(roots)
    if round(float(small), 2) != 1.37:
        raise AssertionError(f"the given root is not {small}")
    return large


# --- models ----------------------------------------------------------------------------------------------------------

def town_n(tex):
    """Smallest whole n with 12000 e^(0.025 n) > 18000."""
    P = 12000 * exp(Rational(1, 40) * r)
    boundary = real_solutions(P - 18000)[0]
    n = ceiling(boundary)
    if not (P.subs(r, n - 1) <= 18000 < P.subs(r, n)):
        raise AssertionError("ceiling argument fails")
    check_assignments(tex, {"n": n})


def car_k_and_t(tex):
    """V = 32000 e^(-kt), V(2) = 24000: solve for k > 0, then V(t) = 18000 for t."""
    k = Symbol("k", positive=True)
    k_value = real_solutions((32000 * exp(-2 * k) - 24000).subs(k, r), Interval(0, oo))
    if len(k_value) != 1:
        raise AssertionError(f"expected one k, found {k_value}")
    t_value = real_solutions(32000 * exp(-k_value[0] * r) - 18000)
    check_assignments(tex, {"k": k_value[0], "t": t_value[0]})


def bacteria_time():
    return real_solutions(250 * exp(Rational(2, 5) * r) - 1000)[0]


def doubling_time(tex):
    """A(t) = 500 e^(0.05t) doubles when A(t) = 1000."""
    same(tex, real_solutions(500 * exp(Rational(1, 20) * r) - 1000)[0])


def medicine_length(tex):
    """C(t) = 20 t e^(-0.4t) = 12. C' = 20 e^(-0.4t)(1 - 0.4t): C rises on [0, 2.5] and falls after, so C = 12 has at
    most two solutions; C(0) = 0 and C(20) < 12 bracket both, and the scan finds two. Length = later - earlier."""
    C = 20 * r * exp(-Rational(2, 5) * r)
    if not (C.subs(r, 20).evalf() < 12):
        raise AssertionError("end argument fails")
    roots = roots_in(C - 12, Rational(1, 1000), 20)
    if len(roots) != 2:
        raise AssertionError(f"expected two times, found {roots}")
    check_rounded(tex, max(roots) - min(roots), sf=3, unit="hours")


CHECKS = {
    "before-quadratic": lambda tex: values_are(tex, real_solutions(r**2 + 2 * r - 15)),
    "before-ln": lambda tex: same(tex, real_solutions(exp(r) - 6)[0]),
    "before-asymptote": asymptote,
    "ex-graph-read": lambda tex: values_are(tex, real_solutions((r**2 - 2 * r) - (r + 4))),
    "check-graph-zeros": same_zeros_graph,
    "ex-graph-count": lambda tex: same(tex, count_exp_parabola()),
    "check-graph-count": lambda v, tolerance: check_numeric(v, count_cubic_line(), dp=0, tolerance=tolerance),
    "ex-exp-quadratic": lambda tex: values_are(tex, real_solutions(exp(2 * r) - 7 * exp(r) + 12)),
    "ex-exp-reciprocal": lambda tex: values_are(tex, real_solutions(exp(r) - 8 * exp(-r) - 2)),
    "ex-exp-formula": lambda tex: values_are(tex, real_solutions(exp(2 * r) - 2 * exp(r) - 4)),
    "check-ln-quadratic": lambda tex: values_are(
        tex, real_solutions(log(r) ** 2 - log(r) - 6, Interval.open(0, oo))),
    "check-power-quadratic": lambda v, tolerance: check_numeric(v, power_quadratic()[0], sf=3, tolerance=tolerance),
    "ex-gdc-intersect": lambda tex: check_rounded_list(tex, exp_line_roots(), sf=3),
    "ex-gdc-poly": lambda tex: check_rounded_list(tex, quintic_roots(), sf=3),
    "check-gdc-one": lambda v, tolerance: check_numeric(v, ln_line_root(), sf=3, tolerance=tolerance),
    "check-gdc-hidden": lambda v, tolerance: check_numeric(v, cube_power_other_root(), sf=3, tolerance=tolerance),
    "ex-model-growth": town_n,
    "ex-model-find-k": car_k_and_t,
    "check-model-time": lambda v, tolerance: check_numeric(v, bacteria_time(), sf=3, tolerance=tolerance),
    "check-model-double": doubling_time,
    "ex-model-gdc": medicine_length,
}

# Required precision of every numeric check. check-graph-count is an exact count of solutions (an integer), so its
# tolerance must be 0: {"dp": 0} holds it to a whole number.
NUMERIC = {
    "check-graph-count": {"dp": 0},
    "check-power-quadratic": {"sf": 3},
    "check-gdc-one": {"sf": 3},
    "check-gdc-hidden": {"sf": 3},
    "check-model-time": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
