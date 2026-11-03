"""SymPy assertions for lesson 1.9 (Binomial theorem). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data, not from the binomial formula the lesson teaches:
expansions come from SymPy's `expand` of the actual power, coefficients are read off that expansion, and nCr values
are counted by listing the subsets with itertools. Unknowns are found by solving the coefficient read off the expansion.
"""
import sys
from itertools import combinations
from pathlib import Path

from sympy import Poly, Rational, S, expand, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, parse_answer, parse_list  # noqa: E402

x, y, k, a, b, p, q = symbols("x y k a b p q")  # mathparse returns plain symbols


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def values(tex):
    """One value or several (`k = \\pm 2`, `r = 4 \\text{ or } r = 8`), as a sorted list."""
    try:
        found = parse_list(tex)
    except ValueError:
        found = [parse_answer(tex)]  # parse_list refuses a single answer; read it as a list of one
    return sorted(found, key=lambda v: float(v))


def same_values(tex, truth):
    published, truth = values(tex), sorted(truth, key=lambda v: float(v))
    if len(published) != len(truth) or any(simplify(u - v) != 0 for u, v in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def same_sequence(tex, truth):
    """An ordered list of numbers, such as a row of Pascal's triangle, compared in order."""
    published = parse_list(tex)
    if len(published) != len(truth) or any(simplify(u - v) != 0 for u, v in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def choose(n, r):
    """nCr by listing every r-element subset of n objects (the counting definition, not the factorial formula)."""
    return S(sum(1 for _ in combinations(range(n), r)))


# --- truths ---------------------------------------------------------------------------------------------------------

def row_of_power(n):
    """Coefficients of (a + b)^n read off the expanded power, in falling powers of a."""
    poly = Poly(expand((a + b) ** n), a, b)
    return [poly.coeff_monomial(a ** (n - j) * b ** j) for j in range(n + 1)]


def n_with_pairs(target):
    """Every whole n (2..200) for which the number of 2-element subsets of n objects is the target."""
    return [S(n) for n in range(2, 201) if choose(n, 2) == target]


def r_with_count(n, target):
    """Every r in 0..n with nCr equal to the target, found by tabulating the counts (the GDC-table method)."""
    return [S(r) for r in range(n + 1) if choose(n, r) == target]


def number_of_terms():
    return len(Poly(expand((3 * p + q) ** 14), p, q).terms())


def k_values(expr, power, target):
    """Real k for which the coefficient of x^power in the expanded expr equals the target."""
    coefficient = expand(expr).coeff(x, power)
    return [s for s in solve(coefficient - target, k) if s.is_real]


CHECKS = {
    # before you start
    "before-expand-square": lambda tex: same(tex, expand((x + 5) ** 2)),
    "before-power-of-product": lambda tex: same(tex, expand((3 * x) ** 4)),
    "before-negative-power": lambda v, tolerance: check_numeric(v, S(-2) ** 5, sf=3, tolerance=tolerance),
    # Pascal's triangle
    "ex-pascal-x-plus-3": lambda tex: same(tex, expand((x + 3) ** 4)),
    "check-pascal-row": lambda tex: same_sequence(tex, row_of_power(6)),
    "ex-pascal-3x-minus-2": lambda tex: same(tex, expand((3 * x - 2) ** 4)),
    "check-expand-y-minus-4": lambda tex: same(tex, expand((y - 4) ** 3)),
    # counting and nCr
    "ex-ncr-formula": lambda tex: same(tex, choose(9, 4)),
    "check-ncr-10-2": lambda v, tolerance: check_numeric(v, choose(10, 2), sf=3, tolerance=tolerance),
    "ex-ncr-find-n": lambda tex: same_values(tex, n_with_pairs(66)),
    "ex-ncr-table": lambda tex: same_values(tex, r_with_count(12, 495)),
    "check-ncr-table": lambda tex: same_values(tex, r_with_count(15, 455)),
    # the theorem
    "ex-theorem-1-plus-2x": lambda tex: same(tex, expand((1 + 2 * x) ** 5)),
    "check-theorem-half": lambda tex: same(tex, expand((1 + x / 2) ** 4)),
    "ex-theorem-x-minus-2-over-x": lambda tex: same(tex, expand((x - 2 / x) ** 4)),
    "check-number-of-terms": lambda v, tolerance: check_numeric(v, number_of_terms(), sf=3, tolerance=tolerance),
    # one term
    "ex-coefficient-x3": lambda tex: same(tex, expand((1 - 3 * x) ** 7).coeff(x, 3)),
    # expand of a Laurent polynomial: coeff(x, 0) is the part with no x
    "ex-constant-term": lambda tex: same(tex, expand((x**2 + 2 / x) ** 6).coeff(x, 0)),
    "check-coefficient-x4": lambda tex: same(tex, expand((3 * x + 2) ** 6).coeff(x, 4)),
    "ex-unknown-k": lambda tex: same_values(tex, k_values((3 + k * x) ** 5, 2, 1080)),
    "check-unknown-cube": lambda tex: same_values(tex, k_values((2 - k * x) ** 6, 3, -4320)),
}

NUMERIC = {
    "before-negative-power": {"sf": 3},
    "check-ncr-10-2": {"sf": 3},
    "check-number-of-terms": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
