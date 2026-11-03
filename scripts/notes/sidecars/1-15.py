"""SymPy assertions for lesson 1.15 (proof by induction, contradiction and counterexample). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

A proof's "answer" is the key result line it reaches. Each assertion rebuilds that line from the question's own data:
- induction formulas are checked against SymPy's closed-form sum (or repeated derivative), AND the inductive step itself
  is checked symbolically (formula at k, plus the next term or one more derivative, equals the formula at k + 1);
- divisibility steps substitute the assumption into the k + 1 expression and must give the published multiple of d;
- contradiction steps substitute p = 3m (or 5m) into the squared (cubed) equation;
- counterexamples must satisfy the hypothesis and break the conclusion, computed with isprime / exact comparison.
"""
import sys
from pathlib import Path

from sympy import (
    E, I, Rational, Symbol, conjugate, diff, exp, expand, factorial, gammasimp, isprime, simplify, summation, symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    _split, _strip_decorations, _top_level_cuts, check_numeric, check_same_equation, parse_answer, proves_zero,
)

x = symbols("x")
n, k, r, m = symbols("n k r m", integer=True, positive=True)
a, b = symbols("a b", real=True)
p, q, s = symbols("p q s")


def free(expr):
    """Swap the parser's plain symbols for the assumption-carrying ones used here."""
    swaps = {Symbol("n"): n, Symbol("k"): k, Symbol("r"): r, Symbol("m"): m, Symbol("a"): a, Symbol("b"): b}
    return expr.subs(swaps)


def same(tex, truth):
    published = free(parse_answer(tex))
    if simplify(gammasimp(published - truth)) != 0:
        raise AssertionError(f"published {published} is not {truth}")
    return published


def chain_is(tex, truth):
    """Every side of a published chain `A = B` equals the truth."""
    cleaned = _strip_decorations(tex)
    parts = _split(cleaned, _top_level_cuts(cleaned, r"="))
    if len(parts) < 2:
        raise ValueError(f"{tex!r} is not a statement with =")
    sides = [free(parse_answer(part)) for part in parts]
    for side in sides:
        if simplify(side - truth) != 0:
            raise AssertionError(f"{side} is not identically equal to {truth}")
    return sides[-1]


def integer_multiple(expr, d, variables):
    """expr / d expands to integer coefficients times the given integer-valued terms."""
    inner = expand(expr / d)
    coeffs = inner.as_coefficients_dict()
    if any(term not in variables and term != 1 for term in coeffs) or not all(c.is_integer for c in coeffs.values()):
        raise AssertionError(f"{expr} is not {d} x (an integer)")


# --- before --------------------------------------------------------------------------------------------------------
def sigma_value(value, tolerance):
    check_numeric(value, summation(3 * r - 1, (r, 1, 4)), dp=0, tolerance=tolerance)


def multiple_of_three(tex):
    last = chain_is(tex, 6 * n + 15)
    integer_multiple(last, 3, {n})


def odd_square(tex):
    last = chain_is(tex, (2 * n + 1) ** 2)
    integer_multiple(last - 1, 2, {n, n**2})


# --- induction -----------------------------------------------------------------------------------------------------
def sum_formula(tex, term):
    """The published closed form equals SymPy's sum, and the inductive step S(k) + u(k+1) = S(k+1) holds."""
    published = same(tex, summation(term, (r, 1, n)))
    step = published.subs(n, k) + term.subs(r, k + 1) - published.subs(n, k + 1)
    if simplify(step) != 0:
        raise AssertionError(f"inductive step fails for {published}")


def next_term(tex):
    same(tex, (1 / (r * (r + 1))).subs(r, k + 1))


def simplify_step(tex):
    truth = k / (k + 1) + 1 / ((k + 1) * (k + 2))
    published = same(tex, truth)
    # It must also be the claimed formula n/(n + 1) at n = k + 1.
    if simplify(published - summation(1 / (r * (r + 1)), (r, 1, k + 1))) != 0:
        raise AssertionError(f"{published} is not the sum of k + 1 terms")


def divisible_step(tex):
    # Assumption 4^k + 6k - 1 = 9m, so 4^k = 9m - 6k + 1. The k + 1 case is 4 * 4^k + 6(k + 1) - 1.
    cleaned = _strip_decorations(tex)
    parts = _split(cleaned, _top_level_cuts(cleaned, r"="))
    if len(parts) != 2:
        raise ValueError(f"{tex!r} is not one equation")
    lhs, rhs = (free(parse_answer(part)) for part in parts)
    if simplify(lhs - (4 ** (k + 1) + 6 * (k + 1) - 1)) != 0:
        raise AssertionError(f"LHS {lhs} is not the n = k + 1 case")
    truth = 4 * (9 * m - 6 * k + 1) + 6 * (k + 1) - 1
    if simplify(rhs - truth) != 0:
        raise AssertionError(f"published {rhs} is not {expand(truth)}")
    integer_multiple(rhs, 9, {m, k})
    # Independent check: with m = (4^k + 6k - 1)/9 the published form really is the k + 1 expression.
    if simplify(rhs.subs(m, (4**k + 6 * k - 1) / 9) - lhs) != 0:
        raise AssertionError("published step does not equal the k + 1 expression")


def eight_step(tex):
    truth = 9 * (8 * m + 1) - 1
    published = same(tex, truth)
    integer_multiple(published, 8, {m})


def derivative_formula(tex):
    published = same(tex, 2 ** (n - 1) * (2 * x + n) * exp(2 * x))
    f = x * exp(2 * x)
    for order in range(1, 7):
        if simplify(diff(f, x, order) - published.subs(n, order)) != 0:
            raise AssertionError(f"formula wrong at n = {order}")
    if simplify(diff(published.subs(n, k), x) - published.subs(n, k + 1)) != 0:
        raise AssertionError("inductive step fails")


def derivative_step(tex):
    """The published derivative is PROVED equal to d/dx of (-1)^k k! / x^(k+1) for every positive whole k
    (gammasimp turns (k + 1)! into (k + 1) k!). Exact values at k = 0..6 and four x are a smoke check only."""
    truth = diff((-1) ** k * factorial(k) * x ** (-(k + 1)), x)
    published = free(parse_answer(tex))
    if not (proves_zero(gammasimp(published - truth)) or proves_zero(published - truth)):
        raise AssertionError(f"{published} could not be proved equal to {truth}")
    for kk in range(0, 7):
        for xx in (Rational(1, 2), 2, 3, Rational(-5, 3)):
            if simplify(published.subs({k: kk, x: xx}) - truth.subs({k: kk, x: xx})) != 0:
                raise AssertionError(f"{published} differs from {truth} at k = {kk}, x = {xx}")


def conjugate_power(tex):
    # Truth: the conjugate of z = a + bi is a - bi, so (z*)^n = (a - bi)^n; compare, then check (z^n)* directly for small n.
    published = same(tex, conjugate(a + b * I) ** n)
    for power in range(1, 6):
        if expand(published.subs(n, power) - conjugate(expand((a + b * I) ** power))) != 0:
            raise AssertionError(f"wrong at n = {power}")


# --- contradiction -------------------------------------------------------------------------------------------------
def no_integer_solution(tex):
    last = chain_is(tex, 6 * m + 9 * n)
    integer_multiple(last, 3, {m, n})
    if 100 % 3 == 0:
        raise AssertionError("100 is a multiple of 3, so there is no contradiction")


def root3_step(tex):
    # p^2 = 3 q^2 with p = 3m.
    check_same_equation(tex, (3 * Symbol("m")) ** 2 - 3 * Symbol("q") ** 2)


def cube_root_five_step(tex):
    check_same_equation(tex, (5 * Symbol("m")) ** 3 - 5 * Symbol("q") ** 3)


def rational_difference(tex):
    # b = (a + b) - a with a + b = r/s and a = p/q. Plain symbols, as the parser returns them.
    r_plain = Symbol("r")
    published = parse_answer(tex)
    if simplify(published - (r_plain / s - p / q)) != 0:
        raise AssertionError(f"published {published} is not r/s - p/q")


# --- counterexamples -----------------------------------------------------------------------------------------------
def prime_counter(tex, poly, lowest):
    value = parse_answer(tex)
    if not (value.is_integer and value >= lowest):
        raise AssertionError(f"{value} is outside the domain")
    if isprime(int(poly(value))):
        raise AssertionError(f"{poly(value)} is prime, so {value} is not a counterexample")


def exp_cubic_counter(tex):
    value = parse_answer(tex)
    if not value > 0:
        raise AssertionError(f"{value} is not positive")
    if E**value > value**3:
        raise AssertionError(f"e^{value} > {value}^3, so the statement holds there")


def square_counter(tex):
    value = parse_answer(tex)
    if not value**2 > 9:
        raise AssertionError(f"{value}^2 is not greater than 9: the hypothesis fails")
    if value > 3:
        raise AssertionError(f"{value} > 3: the conclusion holds")


CHECKS = {
    "before-sigma-value": sigma_value,
    "before-multiple-of-three": multiple_of_three,
    "before-odd-square": odd_square,
    "ex-induction-odd-sum": lambda tex: sum_formula(tex, 2 * r - 1),
    "ex-induction-sum-cubic": lambda tex: sum_formula(tex, r * (r + 3)),
    "check-induction-next-term": next_term,
    "check-induction-simplify": simplify_step,
    "ex-induction-divisible": divisible_step,
    "check-divisible-step": eight_step,
    "ex-induction-derivative": derivative_formula,
    "check-derivative-step": derivative_step,
    "ex-induction-conjugate": conjugate_power,
    "ex-contradiction-integers": no_integer_solution,
    "ex-contradiction-root3": root3_step,
    "check-cube-root-five": cube_root_five_step,
    "check-rational-plus-irrational": rational_difference,
    "check-euclid-remainder": lambda v, tolerance: check_numeric(v, (2 * 3 * 5 * 7 * 11 + 1) % 7, dp=0, tolerance=tolerance),
    "ex-counter-prime": lambda tex: prime_counter(tex, lambda v: v**2 + v + 17, 0),
    "ex-counter-gdc": exp_cubic_counter,
    "check-counter-prime": lambda tex: prime_counter(tex, lambda v: v**2 - v + 11, 1),
    "check-counter-square": square_counter,
}

# Required precision of every numeric check: all are exact integers, so 0 decimal places and tolerance 0.
NUMERIC = {"before-sigma-value": {"dp": 0}, "check-euclid-remainder": {"dp": 0}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
