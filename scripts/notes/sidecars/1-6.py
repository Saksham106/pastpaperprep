"""SymPy assertions for lesson 1.6 (elementary deductive proof). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Most answers in this lesson are proved statements written as a chain, `A = B` or `A \\equiv B`. `chain_is` cuts the
published text at every top-level `=` / `\\equiv`, parses each piece, and requires EVERY piece to equal the truth: the
expression built here from the question's own data (for example (x + 3)(x - 1) - (x + 1)(x - 3)). A wrong expansion
anywhere in the chain, or a chain about different numbers (one letter used for two numbers), raises AssertionError.
Where the result claims a form (odd, a multiple of 11), `form_is` also checks the last piece has that form with integer
coefficients, which is what the proof needs.
"""
import sys
from pathlib import Path

from sympy import Poly, Rational, expand, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import _split, _strip_decorations, _top_level_cuts, check_assignments, check_numeric, parse_answer  # noqa: E402

x, n, m, a, b, k, p, q = symbols("x n m a b k p q")


def pieces(tex):
    """Each side of a chain `A = B \\equiv C`, parsed. Unreadable text raises ValueError."""
    cleaned = _strip_decorations(tex)
    parts = _split(cleaned, _top_level_cuts(cleaned, r"\\equiv|="))
    if len(parts) < 2:
        raise ValueError(f"{tex!r} is not a statement with = or \\equiv")
    return [parse_answer(part) for part in parts]


def chain_is(tex, truth):
    """Every side of the published chain equals the truth for every value of the variables."""
    for side in pieces(tex):
        if simplify(side - truth) != 0:
            raise AssertionError(f"{side} is not identically equal to {truth}")
    return pieces(tex)[-1]


def form_is(expr, multiplier, remainder, variables):
    """(expr - remainder) / multiplier is a polynomial with integer coefficients, so expr = multiplier * integer + remainder."""
    inner = expand((expr - remainder) / multiplier)
    coeffs = Poly(inner, *variables).coeffs()
    if not all(c.is_integer for c in coeffs):
        raise AssertionError(f"{expr} is not {multiplier} x (an integer) + {remainder}")


def is_identity(tex):
    """A multiple-choice option that claims an identity: both sides must agree for every value."""
    sides = pieces(tex)
    if any(simplify(side - sides[0]) != 0 for side in sides[1:]):
        raise AssertionError(f"{tex!r} is not an identity")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


# --- before --------------------------------------------------------------------------------------------------------
def before_substitute(value, tolerance):
    check_numeric(value, (3 * x**2 - 5 * x).subs(x, -2), dp=0, tolerance=tolerance)


# --- equality and identity -----------------------------------------------------------------------------------------
def identity_constants(tex):
    difference = expand((x + a) * (x + 3) - (x**2 + b * x + 12))
    equations = Poly(difference, x).coeffs()
    (solution,) = solve(equations, [a, b], dict=True)
    check_assignments(tex, {"a": solution[a], "b": solution[b]})


def find_constant(value, tolerance):
    difference = expand((x + p) ** 2 - (x**2 + 10 * x + q))
    (solution,) = solve(Poly(difference, x).coeffs(), [p, q], dict=True)
    check_numeric(value, solution[q], dp=0, tolerance=tolerance)


# --- LHS to RHS ----------------------------------------------------------------------------------------------------
def fraction_constant(value, tolerance):
    difference = simplify((1 / x - 1 / (x + 5)) * x * (x + 5))  # k = LHS times the denominator x(x + 5)
    if difference.free_symbols:
        raise AssertionError(f"LHS times x(x + 5) is {difference}, not a constant")
    check_numeric(value, difference, dp=0, tolerance=tolerance)


def complete_chain(tex):
    same(tex, expand((x + 5) ** 2 - (x + 1) ** 2))


# --- proofs about numbers ------------------------------------------------------------------------------------------
def odd_product(tex):
    last = chain_is(tex, (2 * m + 1) * (2 * n + 1))
    form_is(last, 2, 1, (m, n))


def digits_reversed(tex):
    last = chain_is(tex, (10 * a + b) + (10 * b + a))
    form_is(last, 11, 0, (a, b))


def even_plus_odd(tex):
    last = chain_is(tex, 2 * m + (2 * n + 1))
    form_is(last, 2, 1, (m, n))


def square_constant(value, tolerance):
    difference = expand(n * (n + 6) + 9 - (n + k) ** 2)
    roots = solve(Poly(difference, n).coeffs(), [k], dict=True)
    if len(roots) != 1:
        raise AssertionError(f"no single k makes the identity hold: {roots}")
    check_numeric(value, roots[0][k], dp=0, tolerance=tolerance)


# --- checking ------------------------------------------------------------------------------------------------------
def check_equation(tex):
    (truth,) = solve(4 * (x - 3) - (x + 9), x)
    same(tex, truth)


# The student's working in check-find-wrong-line, as written in the question (data, not the answer).
WRONG_LINE_START = (x - 5) ** 2 - x * (x - 4)
WRONG_LINE_LINES = [x**2 - 10 * x + 25 - x * (x - 4), x**2 - 10 * x + 25 - x**2 - 4 * x, -14 * x + 25]


def find_wrong_line(text):
    words = text.strip()
    if words == "There is no mistake":
        chosen = None
    elif words.startswith("Line ") and words[5:].isdigit():
        chosen = int(words[5:])
    else:
        raise ValueError(f"cannot read option {text!r}")
    first_wrong = next(
        (number for number, line in enumerate(WRONG_LINE_LINES, start=1) if simplify(line - WRONG_LINE_START) != 0),
        None,
    )
    if chosen != first_wrong:
        raise AssertionError(f"option {text!r}, but the first wrong line is {first_wrong}")


CHECKS = {
    "before-expand-square": lambda tex: same(tex, expand((x - 6) ** 2)),
    "before-add-fractions": lambda tex: same(tex, Rational(1, 4) + Rational(1, 6)),
    "before-substitute": before_substitute,
    "ex-identity-expand": lambda tex: chain_is(tex, (2 * x + 1) * (x - 3)),
    "ex-identity-constants": identity_constants,
    "check-which-identity": is_identity,
    "check-find-constant": find_constant,
    "ex-lhs-brackets": lambda tex: chain_is(tex, (x + 3) * (x - 1) - (x + 1) * (x - 3)),
    "ex-rhs-to-lhs": lambda tex: chain_is(tex, 1 / (x - 1) - 1 / (x + 1)),
    "check-fraction-constant": fraction_constant,
    "check-complete-chain": complete_chain,
    "ex-numbers-then-algebra": lambda tex: chain_is(tex, (n - 1) * (n + 1)),
    "ex-odd-product": odd_product,
    "ex-digits-reversed": digits_reversed,
    "check-even-plus-odd": even_plus_odd,
    "check-square-constant": square_constant,
    "ex-check-expansion": lambda tex: chain_is(tex, (3 * x - 2) ** 2),
    "ex-check-equation": check_equation,
    "check-pick-expansion": lambda tex: same(tex, expand((x + 4) * (x - 3))),
    "check-find-wrong-line": find_wrong_line,
}

# Required precision of every numeric check: all are exact integers, so 0 decimal places and tolerance 0.
NUMERIC = {
    "before-substitute": {"dp": 0},
    "check-find-constant": {"dp": 0},
    "check-fraction-constant": {"dp": 0},
    "check-square-constant": {"dp": 0},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
