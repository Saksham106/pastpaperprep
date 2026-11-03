"""SymPy assertions for lesson 4.5 (probability foundations and expected value). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every probability here is computed independently by building the sample space with itertools and counting the
outcomes in the event (or, for experimental data, by dividing the frequency by the number of trials), using exact
SymPy rationals. Published decimals are read back as exact rationals from their decimal digits before comparing.
"""
import sys
from itertools import product
from pathlib import Path

from sympy import Float, Rational, isprime, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402


def exact(value):
    """A parsed SymPy number, with a Float turned into the exact rational its printed digits show."""
    if isinstance(value, Float):
        return Rational(str(value))
    return value


def same(tex, truth):
    published = exact(parse_answer(tex))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def prob(space, event):
    """n(A)/n(U) for a list of equally likely outcomes and a predicate."""
    space = list(space)
    return Rational(sum(1 for o in space if event(o)), len(space))


COIN = ["H", "T"]
SPINNER_4 = [1, 2, 3, 4]
SPINNER_3 = [1, 2, 3]
TWO_SPINNERS = list(product(SPINNER_3, SPINNER_4))  # ordered pairs (first, second)
THREE_COINS = list(product(COIN, repeat=3))
WORD = "PARALLELOGRAM"


def n_outcomes(tex, space):
    same(tex, len(list(space)))


def n_event(tex, space, event):
    same(tex, sum(1 for o in space if event(o)))


def relative_frequency(count, trials):
    return Rational(count, trials)


# ex-train: P(T) = 5 P(T') and P(T) + P(T') = 1.
p_t, p_not = symbols("p_t p_not")
TRAIN = solve([p_t - 5 * p_not, p_t + p_not - 1], [p_t, p_not])[p_t]

# check-expected-reverse: n * P(B) = 18 with n = 120.
p_b = symbols("p_b")
REVERSE = solve(120 * p_b - 18, p_b)[0]

CHECKS = {
    "before-fraction-decimal": lambda v, tolerance: check_numeric(v, Rational(7, 20), sf=3, tolerance=tolerance),
    "before-percent-of": lambda v, tolerance: check_numeric(v, Rational(15, 100) * 240, sf=3, tolerance=tolerance),
    "before-one-minus": lambda v, tolerance: check_numeric(v, 1 - Rational(27, 100), sf=3, tolerance=tolerance),
    # Section 1: sample spaces.
    "ex-coin-spinner": lambda tex: n_outcomes(tex, product(COIN, SPINNER_4)),
    "ex-spinner-table": lambda tex: n_event(tex, TWO_SPINNERS, lambda o: sum(o) == 5),
    "check-three-coins": lambda v, tolerance: check_numeric(v, len(THREE_COINS), sf=3, tolerance=tolerance),
    "check-even-total": lambda v, tolerance: check_numeric(
        v, sum(1 for o in TWO_SPINNERS if sum(o) % 2 == 0), sf=3, tolerance=tolerance),
    # Section 2: theoretical and experimental probability.
    "ex-letters": lambda tex: same(tex, prob(WORD, lambda c: c in "AEIOU")),
    "ex-spinner-prime": lambda tex: same(tex, prob(TWO_SPINNERS, lambda o: isprime(sum(o)))),
    "ex-cup": lambda tex: same(tex, relative_frequency(172, 172 + 51 + 27)),
    "ex-compare-die": lambda tex: check_rounded(tex, relative_frequency(104, 600), sf=3),
    "check-two-coins": lambda tex: same(tex, prob(product(COIN, COIN), lambda o: o == ("H", "H"))),
    "check-free-throws": lambda v, tolerance: check_numeric(v, relative_frequency(39, 52), sf=3, tolerance=tolerance),
    # Section 3: complementary events. Each truth counts A' directly, independent of the 1 - P(A) rule in the lesson.
    "ex-multiple-seven": lambda tex: same(tex, prob(range(1, 31), lambda k: k % 7 != 0)),
    "ex-at-least-one-tail": lambda tex: same(tex, prob(THREE_COINS, lambda o: "T" in o)),
    "ex-train": lambda tex: same(tex, TRAIN),
    "check-at-least-one-five": lambda tex: same(tex, prob(product(range(1, 6), range(1, 6)), lambda o: 5 in o)),
    "check-tombola": lambda v, tolerance: check_numeric(
        v, prob(range(1, 201), lambda k: str(k)[-1] not in "05"), sf=3, tolerance=tolerance),
    # Section 4: expected number = n * P(A).
    "ex-parcels": lambda tex: same(tex, 420 * (1 - Rational("0.035"))),
    "ex-bulbs": lambda tex: same(tex, 1500 * relative_frequency(23, 400)),
    "check-expected-prime": lambda tex: same(tex, 84 * prob(TWO_SPINNERS, lambda o: isprime(sum(o)))),
    "check-expected-reverse": lambda v, tolerance: check_numeric(v, REVERSE, sf=3, tolerance=tolerance),
}

NUMERIC = {
    "before-fraction-decimal": {"sf": 3},
    "before-percent-of": {"sf": 3},
    "before-one-minus": {"sf": 3},
    "check-three-coins": {"sf": 3},
    "check-even-total": {"sf": 3},
    "check-free-throws": {"sf": 3},
    "check-tombola": {"sf": 3},
    "check-expected-reverse": {"sf": 3},
}

def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
