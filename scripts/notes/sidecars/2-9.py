"""SymPy assertions for lesson 2.9 (Exponential and logarithmic functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data: inverses by solving y = f(x) for x, domains and ranges with
SymPy's set tools, equations with solve over the reals, and money models from exact rational multipliers.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Eq, Interval, Matrix, Rational, S, exp, expand_log, log, oo, simplify, solve, solve_univariate_inequality, symbols,
)
from sympy.calculus.singularities import is_decreasing, is_strictly_decreasing
from sympy.calculus.util import function_range

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_same_set, parse_answer, parse_list, parse_point, proves_zero  # noqa: E402

x = symbols("x")  # mathparse returns plain symbols
t = symbols("t")
r = symbols("r", real=True)
p = symbols("p", positive=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_for_positive_x(tex, truth):
    """Compare an expression in x that is only defined for x > 0: substitute a positive symbol before simplifying."""
    published = parse_answer(tex).subs(x, p)
    difference = simplify(expand_log(published - truth.subs(x, p), force=True))
    if difference != 0:
        raise AssertionError(f"published {published} is not {truth}")


def point_is(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(a - b) != 0 for a, b in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {tuple(truth)}")


def roots_are(tex, expr):
    """Real solutions of expr = 0 (expr in the real symbol r), compared with the published list."""
    try:
        values = parse_list(tex)
    except ValueError:
        values = [parse_answer(tex)]  # parse_list refuses a single answer; read it as a list of one
    published = sorted(values, key=lambda v: float(v))
    truth = sorted(solve(expr, r), key=lambda v: float(v))
    if len(published) != len(truth) or any(simplify(a - b) != 0 for a, b in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def range_is(tex, name, f, domain):
    """A range written as `g(x) > 3`: read as a set of values y, compared with SymPy's function_range."""
    if not re.fullmatch(rf"\s*\${name}\(x\)\s*[^$]*\$\s*", tex):
        raise ValueError(f"cannot read range {tex!r}")
    check_same_set(tex.replace(f"{name}(x)", "y"), function_range(f, r, domain), var="y")


def log_domain(tex, inside):
    """Largest domain of ln(inside): inside > 0, solved as an inequality."""
    check_same_set(tex, solve_univariate_inequality(inside > 0, r, relational=False))


# --- before you start ---------------------------------------------------------------------------------------------------

def log_value():
    """log_3 81: the real power k with 3^k = 81."""
    powers = solve(Eq(3**r, 81), r)
    if len(powers) != 1:
        raise AssertionError(f"expected one real power, found {powers}")
    return powers[0]


def reflected_point(tex):
    """(3, 8) on y = f(x): reflection in y = x swaps the coordinates."""
    image = Matrix([[0, 1], [1, 0]]) * Matrix([3, 8])
    point_is(tex, list(image))


# --- exponential graphs ---------------------------------------------------------------------------------------------------

def decreasing_option(tex):
    """The option names a function y = a^x; only a decreasing one on R passes."""
    f = parse_answer(tex).subs(x, r)
    if not is_strictly_decreasing(f, S.Reals):  # strictly: a constant such as 0 is not decreasing
        raise AssertionError(f"{f} is not decreasing on R")


def exp_intercept(tex):
    """6 - 2e^x = 0 over the reals; the intercept is (root, 0)."""
    roots = solve(6 - 2 * exp(r), r)
    if len(roots) != 1:
        raise AssertionError(f"expected one x-intercept, found {roots}")
    point_is(tex, [roots[0], 0])


# --- logarithmic graphs -----------------------------------------------------------------------------------------------------

def log10_inverse_value(tex):
    """f = log_10 x. f^-1(-2) is the a > 0 with log_10(a) = -2."""
    values = solve(Eq(log(p, 10), -2), p)
    if len(values) != 1:
        raise AssertionError(f"expected one value, found {values}")
    same(tex, values[0])


def log_intercept(tex):
    """f = ln(10 - 2x): its zero, which must lie in the domain 10 - 2x > 0."""
    roots = solve(log(10 - 2 * r), r)
    if len(roots) != 1 or not (10 - 2 * roots[0]) > 0:
        raise AssertionError(f"unexpected roots {roots}")
    point_is(tex, [roots[0], 0])


INVERSE_WITH_DOMAIN = re.compile(r"\s*\$(.+),\s*\\;\s*x\s*(\\ne|\\ge|\\le|<|>)\s*([^$]+?)\s*\$\s*")


def inverse_exp_with_domain(tex):
    """f = 3e^(2x) on R. The inverse solves 3e^(2y) = x for y (x > 0); its domain is the range of f."""
    match = INVERSE_WITH_DOMAIN.fullmatch(tex)
    if not match:
        raise ValueError(f"cannot read {tex!r} as a formula followed by its domain")
    formula, op, bound = match.groups()
    y = symbols("y", real=True)
    branches = solve(Eq(3 * exp(2 * y), p), y)
    if len(branches) != 1:
        raise AssertionError(f"expected one real inverse branch, found {branches}")
    same_for_positive_x(f"${formula}$", branches[0].subs(p, x))
    check_same_set(f"$x {op} {bound}$", function_range(3 * exp(2 * r), r, S.Reals))


def inverse_ln(tex):
    """g = ln(x + 2), x > -2. Solve ln(y + 2) = x for y."""
    y = symbols("y", real=True)
    branches = solve(Eq(log(y + 2), r), y)
    if len(branches) != 1:
        raise AssertionError(f"expected one inverse, found {branches}")
    same(tex, branches[0].subs(r, x))


# --- relationships -----------------------------------------------------------------------------------------------------------

def base_e_k(tex):
    """0.5^x = e^(kx) for all x: at x = 1, e^k = 1/2, so k is the real solution of that."""
    k = symbols("k", real=True)
    values = solve(Eq(exp(k), Rational(1, 2)), k)
    if len(values) != 1:
        raise AssertionError(f"expected one k, found {values}")
    same(tex, values[0])


def cancel_power(tex):
    """8^(log_2 x) for x > 0, built from the definition log_2 x = ln x / ln 2."""
    same_for_positive_x(tex, 8 ** (log(x) / log(2)))


def cancel_e(tex):
    """e^(3 ln x) for x > 0."""
    same_for_positive_x(tex, exp(3 * log(x)))


# --- models ------------------------------------------------------------------------------------------------------------------

def depreciation_k(tex):
    """30000 * 0.8^t = 30000 e^(kt) for all t: at t = 1, e^k = 4/5."""
    k = symbols("k", real=True)
    multiplier = 1 - Rational(20, 100)
    values = solve(Eq(exp(k), multiplier), k)
    if len(values) != 1:
        raise AssertionError(f"expected one k, found {values}")
    same(tex, values[0])


def interest_years(tex):
    """Smallest whole number of years n with 2400 * 1.035^n > 3000, found by stepping through the years exactly."""
    multiplier = 1 + Rational(35, 1000)
    n = 0
    while not 2400 * multiplier**n > 3000:
        n += 1
    same(tex, n)


def interest_model(tex):
    """V(t) for 500 at 6% compounded yearly is 500 * (106/100)^t. The published function (decimals read as exact
    fractions) must be PROVED equal to it for every t; agreement at t = 0, 1, 2, 5, 10 is a smoke check only."""
    truth = 500 * (1 + Rational(6, 100)) ** t
    published = parse_answer(tex)
    if published.free_symbols - {t}:
        raise ValueError(f"unexpected variables in {published}")
    exact = published.replace(lambda e: e.is_Float, lambda e: Rational(str(e)))
    if not proves_zero(exact - truth):
        raise AssertionError(f"published {published} could not be proved equal to {truth}")
    for when in (0, 1, 2, 5, 10):
        if abs((published.subs(t, when) - truth.subs(t, when)).evalf(30)) > 1e-9:
            raise AssertionError(f"published {published} differs from {truth} at t = {when}")


CHECKS = {
    "before-log-value": lambda v, tolerance: check_numeric(v, log_value(), sf=3, tolerance=tolerance),
    "before-power-law": lambda tex: same(tex, (5**x) ** 2),
    "before-reflect": reflected_point,
    "ex-exp-values": lambda tex: same(tex, Rational(1, 3) ** (-2)),
    "check-exp-decreasing": decreasing_option,
    "ex-exp-intercept": exp_intercept,
    "check-exp-range": lambda tex: range_is(tex, "g", 2**r + 3, S.Reals),
    "ex-log-inverse-value": log10_inverse_value,
    "ex-log-domain": log_intercept,
    "check-log-domain": lambda tex: log_domain(tex, 3 * r + 12),
    "ex-inverse-exp": inverse_exp_with_domain,
    "check-inverse-ln": inverse_ln,
    "ex-base-e": base_e_k,
    "ex-cancel-power": cancel_power,
    "check-cancel": cancel_e,
    "check-solve-exp": lambda tex: roots_are(tex, exp(2 * r) - 5 * exp(r)),
    "ex-depreciation-exact": depreciation_k,
    "ex-interest-years": interest_years,
    "check-depreciation-value": lambda v, tolerance: check_numeric(
        v, 900 * (1 - Rational(18, 100)) ** 4, sf=3, tolerance=tolerance),
    "check-interest-model": interest_model,
}

NUMERIC = {"before-log-value": {"sf": 3}, "check-depreciation-value": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
