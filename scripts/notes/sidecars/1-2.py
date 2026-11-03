"""SymPy assertions for lesson 1.2 (arithmetic sequences and series). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are built from each question's own data, never typed in: common differences from the listed terms, sums by
adding the terms one by one (independent of the S_n formula the lesson teaches), unknowns with sympy.solve, and the
"greatest n" and "first year" answers by stepping through n until the condition fails or holds.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, S, Symbol, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, check_rounded, parse_answer, parse_assignments  # noqa: E402

n, a, d, u1 = symbols("n a d u1")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def term(first, diff, k):
    """k-th term, found by adding the difference k - 1 times (not by the booklet formula)."""
    value = S(first)
    for _ in range(k - 1):
        value += S(diff)
    return value


def series(first, diff, count):
    return sum((term(first, diff, k) for k in range(1, count + 1)), S(0))


def positive_integer_root(equation):
    roots = [r for r in solve(equation, n) if r.is_integer and r > 0]
    if len(roots) != 1:
        raise AssertionError(f"expected one positive integer root, got {roots}")
    return roots[0]


def subscript_is(tex, letter, index):
    match = re.search(rf"{letter}_\{{(\d+)\}}", tex)
    if not match or int(match.group(1)) != index:
        raise AssertionError(f"{tex!r} should name {letter}_{{{index}}}")


# --- before -------------------------------------------------------------------------------------------------------------
def before_simultaneous(tex):
    sol = solve([a + 2 * d - 17, a + 7 * d - 2], [a, d], dict=True)[0]
    check_assignments(tex, {"a": sol[a], "d": sol[d]})


def before_quadratic(tex):
    (truth,) = [r for r in solve(n**2 + 4 * n - 96, n) if r > 0]
    same(tex, truth)


# --- nth term -----------------------------------------------------------------------------------------------------------
def nth_term_basic(tex):
    listed = [23, 17, 11, 5]
    diffs = {listed[i + 1] - listed[i] for i in range(3)}
    assert len(diffs) == 1
    subscript_is(tex, "u", 20)
    same(tex, term(listed[0], diffs.pop(), 20))


def which_term():
    first, second = Rational(9, 2), Rational(25, 4)
    step = second - first
    assert Rational(8) - second == step  # the third listed term confirms d
    (truth,) = solve(first + (n - 1) * step - Rational(305, 4), n)
    assert truth.is_integer and truth > 0
    assert term(first, step, int(truth)) == Rational(305, 4)
    return truth


def two_terms(tex):
    sol = solve([u1 + 3 * d - 19, u1 + 10 * d + 9], [u1, d], dict=True)[0]
    assert term(sol[u1], sol[d], 4) == 19 and term(sol[u1], sol[d], 11) == -9
    check_assignments(tex, {"u_{1}": sol[u1], "d": sol[d]})


_NUMBER = r"-?\d+(?:\.\d+)?"


def is_arithmetic_option(tex):
    """The option names a sequence; the right one is the option whose listed terms have one constant gap."""
    values = [S(v) for v in re.findall(_NUMBER, tex.replace("\\ldots", ""))]
    if len(values) < 3:
        raise ValueError(f"cannot read a sequence in {tex!r}")
    gaps = {values[i + 1] - values[i] for i in range(len(values) - 1)}
    if len(gaps) != 1:
        raise AssertionError(f"{tex!r} has gaps {sorted(gaps)}: not arithmetic")


def two_terms_d(tex):
    sol = solve([u1 + 2 * d - 14, u1 + 7 * d - 39], [u1, d], dict=True)[0]
    published = parse_assignments(tex)
    if set(published) != {"d"}:
        raise AssertionError(f"{tex!r} should give d")
    if simplify(published["d"] - sol[d]) != 0:
        raise AssertionError(f"published d = {published['d']}, truth {sol[d]}")


# --- sums ---------------------------------------------------------------------------------------------------------------
def sum_last_term(tex):
    count = positive_integer_root(3 + 7 * (n - 1) - 213)
    subscript_is(tex, "S", int(count))
    total = series(3, 7, int(count))
    assert term(3, 7, int(count)) == 213
    same(tex, total)


def find_n(tex):
    # Truth by stepping: the n whose running total first reaches 230 (and equals it exactly).
    running, k = S(0), 0
    while running < 230:
        k += 1
        running += term(5, 4, k)
    assert running == 230
    same(tex, k)


# --- sigma --------------------------------------------------------------------------------------------------------------
def sigma_value(lo, hi, expr, var):
    return sum((expr.subs(var, value) for value in range(lo, hi + 1)), S(0))


r, k = symbols("r k")


def sigma_write(tex):
    """`7 + 11 + ... + 87 = \\sum_{r=1}^{21}(4r + 3) = 987`: the sigma must generate exactly the listed terms, and the
    value must be their sum."""
    first, step, last = 7, 4, 87
    truth_terms = list(range(first, last + 1, step))
    match = re.search(r"\\sum_\{\s*([a-z])\s*=\s*(-?\d+)\s*\}\^\{\s*(-?\d+)\s*\}\s*\((.*?)\)\s*=", tex)
    if not match:
        raise ValueError(f"no sigma sum followed by its value in {tex!r}")
    name, lo, hi, body = match.group(1), int(match.group(2)), int(match.group(3)), match.group(4)
    general = parse_answer(f"${body}$")
    var = Symbol(name)
    if general.free_symbols - {var}:
        raise AssertionError(f"general term {general} uses letters other than {name}")
    published_terms = [general.subs(var, value) for value in range(lo, hi + 1)]
    if published_terms != truth_terms:
        raise AssertionError(f"sigma gives {published_terms[:3]}... ({len(published_terms)} terms), not {truth_terms[:3]}... ({len(truth_terms)} terms)")
    same(tex, sum(truth_terms))


# --- contexts -----------------------------------------------------------------------------------------------------------
def simple_interest(tex):
    interest = 2400 * Rational(35, 10) / 100
    subscript_is(tex, "u", 9)
    same(tex, term(2400 + interest, interest, 9))


def rows(tex):
    # Greatest number of complete rows whose seat total stays within 1000, found by adding rows one at a time.
    total, count = S(0), 0
    while total + term(18, 3, count + 1) <= 1000:
        count += 1
        total += term(18, 3, count)
    same(tex, count)


def first_year_over(start, rate, limit):
    interest = S(start) * rate
    year = 0
    while S(start) + year * interest <= limit:
        year += 1
    return year


# --- rough data ---------------------------------------------------------------------------------------------------------
def mean_gap(values):
    gaps = [values[i + 1] - values[i] for i in range(len(values) - 1)]
    return sum(gaps, S(0)) / len(gaps)


SEEDLING = [Rational(41, 10), Rational(6), Rational(78, 10), Rational(99, 10), Rational(117, 10)]
CLUB = [S(v) for v in (212, 230, 245, 266, 281, 299)]
BIKES = [S(v) for v in (50, 57, 65, 71, 80)]


def seedling(tex):
    subscript_is(tex, "u", 9)
    check_rounded(tex, term(SEEDLING[0], mean_gap(SEEDLING), 9), sf=3)


def club(tex):
    subscript_is(tex, "u", 12)
    check_rounded(tex, term(CLUB[0], mean_gap(CLUB), 12), sf=3)


CHECKS = {
    "before-solve-linear": lambda tex: same(tex, solve(7 + 3 * (n - 1) - 52, n)[0]),
    "before-simultaneous": before_simultaneous,
    "before-quadratic-positive": before_quadratic,
    "ex-nth-term-basic": nth_term_basic,
    "check-which-term": lambda v, tolerance: check_numeric(v, which_term(), sf=3, tolerance=tolerance),
    "check-recognise": is_arithmetic_option,
    "check-nth-term": lambda v, tolerance: check_numeric(v, term(7, Rational(5, 2), 30), sf=3, tolerance=tolerance),
    "ex-two-terms": two_terms,
    "check-two-terms": two_terms_d,
    "ex-sum-last-term": sum_last_term,
    "ex-find-n": find_n,
    "check-sum-formula": lambda tex: same(tex, series(-7, 3, 16)),
    "check-sum-first-last": lambda v, tolerance: check_numeric(
        v, series(12, solve(12 + 19 * d - 69, d)[0], 20), sf=3, tolerance=tolerance
    ),
    "ex-sigma-evaluate": lambda tex: same(tex, sigma_value(1, 20, 3 * r + 2, r)),
    "ex-sigma-write": sigma_write,
    "check-sigma-count": lambda tex: same(tex, len(range(4, 15 + 1))),
    "check-sigma-lower-limit": lambda v, tolerance: check_numeric(v, sigma_value(5, 30, 40 - 2 * k, k), sf=3, tolerance=tolerance),
    "ex-simple-interest": simple_interest,
    "check-spreadsheet": lambda tex: same(tex, term(150, 12, 40)),
    "check-simple-interest-years": lambda v, tolerance: check_numeric(
        v, first_year_over(800, Rational(45, 1000), 1100), sf=3, tolerance=tolerance
    ),
    "ex-rows-gdc": rows,
    "ex-approx-d": seedling,
    "ex-club-members": club,
    "check-approx-d": lambda tex: check_rounded(tex, mean_gap(BIKES), sf=3),
    "check-predict": lambda v, tolerance: check_numeric(v, term(BIKES[0], mean_gap(BIKES), 9), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check. All are exact values; 3 s.f. covers each at its own size.
NUMERIC = {
    "check-which-term": {"sf": 3},
    "check-nth-term": {"sf": 3},
    "check-sum-first-last": {"sf": 3},
    "check-sigma-lower-limit": {"sf": 3},
    "check-simple-interest-years": {"sf": 3},
    "check-predict": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
