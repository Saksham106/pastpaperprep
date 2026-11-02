"""SymPy assertions for lesson 1.10 (counting principles and the extended binomial theorem). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Counting truths are computed by brute-force enumeration of the actual outcomes with itertools (every arrangement or
selection is generated and tested against the question's condition), so no formula of the lesson is trusted to check
itself. Binomial truths come from SymPy's own `series` of the original function, not from the binomial formula.
"""
import re
import sys
from itertools import combinations, permutations, product
from pathlib import Path

from sympy import Abs, Interval, Rational, binomial, factorial, expand, series, simplify, solve, sqrt, symbols
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_same_set, parse_answer  # noqa: E402

x, n, a = symbols("x n a")

# A published series ends "+ \ldots" (the terms go on). Strip only that tail before parsing.
_TAIL = re.compile(r"\s*[+-]\s*\\(?:l|c)?dots\s*\$?\s*$")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def series_is(tex, f, order):
    published = parse_answer(_TAIL.sub("", tex.strip().rstrip("$")))
    truth = series(f, x, 0, order + 1).removeO()
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def after_last_equals(tex, truth):
    """`a \\approx b = c`: read c, the exact value of the estimate, and compare it with the truth."""
    same(tex.split("=")[-1], truth)


def count(iterable, condition=lambda item: True):
    return sum(1 for item in iterable if condition(item))


# ---- counting truths, by enumeration ----

def meal_deals():
    mains = [f"M{i}" for i in range(6)]
    seconds = [f"S{i}" for i in range(4)] + [f"D{i}" for i in range(3)]  # one starter OR one dessert
    return count(product(mains, seconds))


def odd_above_4000():
    return count(permutations("1234567", 4), lambda p: int("".join(p)) > 4000 and int(p[-1]) % 2 == 1)


def even_three_digit():
    return count(product(range(1, 8), repeat=3), lambda p: p[-1] % 2 == 0)


def paintings():
    return count(permutations(range(9), 4))


def polygon_sides():
    """Number of sides n > 2 with C(n,2) - n = 54. Solve, keep positive integers, and confirm by counting
    vertex pairs that are not neighbours on an n-gon."""
    roots = [r for r in solve(binomial(n, 2).expand(func=True) - n - 54, n) if r.is_integer and r > 2]
    assert len(roots) == 1
    m = int(roots[0])
    diagonals = count(combinations(range(m), 2), lambda p: (p[1] - p[0]) % m not in (1, m - 1))
    assert diagonals == 54
    return roots[0]


def faulty_samples():
    # batteries 0-4 faulty, 5-19 working; samples of 6 with exactly 2 faulty
    return count(combinations(range(20), 6), lambda c: sum(1 for b in c if b < 5) == 2)


def squads():
    # players 0-6 forwards, 7-12 defenders; squads of 5 with at least 3 forwards
    return count(combinations(range(13), 5), lambda c: sum(1 for p in c if p < 7) >= 3)


def apart(order, pair):
    i, j = order.index(pair[0]), order.index(pair[1])
    return abs(i - j) != 1


def photo_apart():
    return count(permutations("LOABCD"), lambda p: apart(p, "LO"))


def parade():
    # floats F0-F4, bands B0-B2; no two bands next to each other
    items = [f"F{i}" for i in range(5)] + [f"B{i}" for i in range(3)]
    return count(permutations(items), lambda p: all(not (p[k][0] == "B" and p[k + 1][0] == "B") for k in range(7)))


def cars_apart():
    return count(permutations("RSabcde"), lambda p: apart(p, "RS"))


def panels_with_a_man():
    # people 0-5 women, 6-10 men
    return count(combinations(range(11), 4), lambda c: any(p >= 6 for p in c))


# ---- binomial truths ----

def validity_set():
    return solve_univariate_inequality(Abs(5 * x / 2) < 1, x, relational=False)


def cube_root_estimate():
    """Quadratic truncation of (8 - x)^(1/3) from SymPy's series, at the x that makes 8 - x = 7.9."""
    quadratic = series((8 - x) ** Rational(1, 3), x, 0, 3).removeO()
    x0 = solve(8 - x - Rational(79, 10), x)[0]
    return quadratic.subs(x, x0)


def find_a_then_x2():
    expansion = series((1 + a * x) ** -3, x, 0, 3).removeO()
    a_value = solve(expansion.coeff(x, 1) + 12, a)
    assert len(a_value) == 1
    return expansion.coeff(x, 2).subs(a, a_value[0])


CHECKS = {
    "before-ncr-value": lambda v, tolerance: check_numeric(v, count(combinations(range(7), 3)), dp=0, tolerance=tolerance),
    "before-binomial-term": lambda tex: same(tex, expand((2 + x) ** 5).coeff(x, 2)),
    "before-factorial-ratio": lambda v, tolerance: check_numeric(v, factorial(8) / factorial(6), dp=0, tolerance=tolerance),
    "ex-meal-deal": lambda tex: same(tex, meal_deals()),
    "ex-odd-above-4000": lambda tex: same(tex, odd_above_4000()),
    "check-even-three-digit": lambda v, tolerance: check_numeric(v, even_three_digit(), dp=0, tolerance=tolerance),
    "check-paintings": lambda tex: same(tex, paintings()),
    "ex-polygon-diagonals": lambda tex: same(tex, polygon_sides()),
    "ex-faulty-sample": lambda tex: same(tex, faulty_samples()),
    "check-squad-at-least": lambda v, tolerance: check_numeric(v, squads(), dp=0, tolerance=tolerance),
    "ex-photo-apart": lambda tex: same(tex, photo_apart()),
    "ex-parade-gaps": lambda tex: same(tex, parade()),
    "check-cars-apart": lambda v, tolerance: check_numeric(v, cars_apart(), dp=0, tolerance=tolerance),
    "check-at-least-one-man": lambda tex: same(tex, panels_with_a_man()),
    "ex-expand-neg3": lambda tex: series_is(tex, (1 - 2 * x) ** -3, 3),
    "check-validity": lambda tex: check_same_set(tex, validity_set()),
    "ex-cube-root": lambda tex: after_last_equals(tex, cube_root_estimate()),
    "check-coefficient-x3": lambda v, tolerance: check_numeric(
        v, series((1 + x / 2) ** -3, x, 0, 4).removeO().coeff(x, 3), dp=2, tolerance=tolerance),
    "ex-coefficient-product": lambda tex: same(tex, series((3 - x) / sqrt(1 + 4 * x), x, 0, 3).removeO().coeff(x, 2)),
    "check-find-a": lambda tex: same(tex, find_a_then_x2()),
}

# Counts are exact whole numbers (dp 0); the x^3 coefficient is an exact decimal (dp 2).
NUMERIC = {
    "before-ncr-value": {"dp": 0},
    "before-factorial-ratio": {"dp": 0},
    "check-even-three-digit": {"dp": 0},
    "check-squad-at-least": {"dp": 0},
    "check-cars-apart": {"dp": 0},
    "check-coefficient-x3": {"dp": 2},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
