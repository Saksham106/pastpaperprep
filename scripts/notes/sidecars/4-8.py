"""SymPy assertions for lesson 4.8 (Binomial distribution). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed independently of the lesson's formula: small cases by enumerating every sequence of trial
results with itertools and multiplying the probabilities along each sequence; larger cases with sympy.stats
Binomial (P, E, variance). Published decimals are read back as exact rationals from their printed digits.
"""
import sys
from itertools import product
from pathlib import Path

from sympy import Eq, Float, Rational, simplify, solve, symbols
from sympy.stats import E, P, Binomial, variance

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer, parse_assignments  # noqa: E402


def exact(value):
    """A parsed SymPy number, with a Float turned into the exact rational its printed digits show."""
    if isinstance(value, Float):
        return Rational(str(value))
    return value


def same(tex, truth):
    published = exact(parse_answer(tex))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def assignments(tex, truth):
    """Named values (n = 20, p = 1/3 or E(X) = 6, Var(X) = 5.28), each compared exactly with the truth."""
    published = {name: exact(value) for name, value in parse_assignments(tex).items()}
    if set(published) != set(truth):
        raise AssertionError(f"published names {sorted(published)} are not {sorted(truth)}")
    for name, value in truth.items():
        if simplify(published[name] - value) != 0:
            raise AssertionError(f"published {name} = {published[name]} is not {value}")


def enumerate_prob(n, p, event):
    """P(number of successes satisfies event), summing over all 2^n success/failure sequences."""
    total = Rational(0)
    for seq in product((True, False), repeat=n):
        weight = Rational(1)
        for success in seq:
            weight *= p if success else 1 - p
        if event(sum(seq)):
            total += weight
    return total


# ex-identify-die: success is a 1 or a 2 on a fair die.
DIE = range(1, 7)
P_ONE_OR_TWO = Rational(sum(1 for f in DIE if f in (1, 2)), len(DIE))

# ex-counters (a): 7 green, 3 yellow, with replacement.
P_GREEN = Rational(7, 7 + 3)

# check-hearts: count hearts in a 52-card pack.
PACK = list(product(["hearts", "diamonds", "clubs", "spades"], range(13)))
P_HEART = Rational(sum(1 for suit, _ in PACK if suit == "hearts"), len(PACK))


# check-which-fails: 12 lemon, 18 orange, 8 draws without replacement. Compute which condition actually fails.
def which_fails_truth():
    lemon, orange, draws = 12, 18, 8
    p_first = Rational(lemon, lemon + orange)
    p_second_given_lemon = Rational(lemon - 1, lemon + orange - 1)
    return {
        "changes": p_first != p_second_given_lemon,  # constant-p condition fails
        "not fixed": not isinstance(draws, int),  # the number of draws is set in advance
        "more than two": len({"lemon", "orange"}) > 2,  # each draw is lemon or not lemon
    }


def which_fails(text):
    truth = which_fails_truth()
    for key, fails in truth.items():
        if key in text:
            if not fails:
                raise AssertionError(f"{text!r} names a condition that holds")
            return
    raise ValueError(f"{text!r} matches no condition")


# ex-find-n-p and check-find-n.
n, p = symbols("n p", positive=True)
FIND_NP = solve([n * p - 12, n * p * (1 - p) - Rational("8.4")], [n, p], dict=True)
assert len(FIND_NP) == 1
FIND_N = solve(n * Rational(1, 6) - 14, n)
assert len(FIND_N) == 1



# check-least-n-lights: least n with P(at least one faulty) > 0.95 when each bulb is faulty with probability 0.06.
# Search n = 1, 2, ... with sympy.stats, so the truth does not come from the lesson's logarithm working.
def least_n_at_least_one(p, target):
    for trials in range(1, 1000):
        if P(Binomial("L", trials, p) >= 1) > target:
            return trials
    raise RuntimeError("no n found below 1000")


LEAST_N_LIGHTS = least_n_at_least_one(Rational("0.06"), Rational("0.95"))

X_seeds = Binomial("X", 18, Rational("0.85"))
X_house = Binomial("X", 16, Rational("0.22"))
X_quiz = Binomial("X", 15, Rational(1, 4))
X_arch = Binomial("X", 20, Rational("0.65"))
X_ten = Binomial("X", 10, Rational("0.3"))
X_darts = Binomial("X", 10, Rational("0.15"))
X_mv = Binomial("X", 50, Rational("0.12"))
X_screens = Binomial("X", 250, Rational("0.04"))
X_var = Binomial("X", 80, Rational(1, 4))

CHECKS = {
    "before-ncr": lambda v, tolerance: check_numeric(
        v, sum(1 for pair in product(range(6), repeat=2) if pair[0] < pair[1]), sf=3, tolerance=tolerance),
    "before-expected-value": lambda v, tolerance: check_numeric(
        v, sum(y * q for y, q in zip((0, 1, 2), (Rational("0.5"), Rational("0.3"), Rational("0.2")))),
        sf=3, tolerance=tolerance),
    # Section 1: recognising a binomial model.
    "ex-identify-die": lambda tex: assignments(tex, {"n": 20, "p": P_ONE_OR_TWO}),
    "ex-counters": lambda tex: assignments(tex, {"n": 4, "p": P_GREEN}),
    "check-hearts": lambda tex: same(tex, P_HEART),
    "check-which-fails": which_fails,
    # Section 2: P(X = r), by enumerating sequences (small n) or sympy.stats.
    "ex-spinner-two-red": lambda tex: same(tex, enumerate_prob(4, Rational("0.3"), lambda s: s == 2)),
    "ex-seeds-gdc": lambda tex: check_rounded(tex, P(Eq(X_seeds, 15)), sf=3),
    "check-quarter-three": lambda tex: same(tex, enumerate_prob(4, Rational(1, 4), lambda s: s == 3)),
    "check-households": lambda v, tolerance: check_numeric(v, P(Eq(X_house, 4)), sf=3, tolerance=tolerance),
    # Section 3: cumulative probabilities.
    "ex-bus-late": lambda tex: same(tex, enumerate_prob(3, Rational("0.2"), lambda s: s >= 1)),
    "ex-quiz-guess": lambda tex: check_rounded(tex, P(X_quiz >= 6), sf=3),
    "check-fewer-than-four": lambda tex: check_rounded(tex, P(X_ten < 4), sf=3),
    "check-archer-between": lambda v, tolerance: check_numeric(
        v, P((X_arch >= 10) & (X_arch <= 15)), sf=3, tolerance=tolerance),
    "check-darts-given": lambda v, tolerance: check_numeric(
        v, P(Eq(X_darts, 1)) / P(X_darts >= 1), sf=3, tolerance=tolerance),
    "check-least-n-lights": lambda v, tolerance: check_numeric(v, LEAST_N_LIGHTS, sf=3, tolerance=tolerance),
    # Section 4: mean and variance from sympy.stats, not from np and np(1-p).
    "ex-mean-var": lambda tex: assignments(tex, {r"\mathrm{E}(X)": E(X_mv), r"\mathrm{Var}(X)": variance(X_mv)}),
    "ex-screens": lambda tex: check_rounded(tex, P(X_screens > E(X_screens)), sf=3),
    "ex-find-n-p": lambda tex: assignments(tex, {"n": FIND_NP[0][n], "p": FIND_NP[0][p]}),
    "check-variance": lambda tex: same(tex, variance(X_var)),
    "check-find-n": lambda v, tolerance: check_numeric(v, FIND_N[0], sf=3, tolerance=tolerance),
}

NUMERIC = {
    "before-ncr": {"sf": 3},
    "before-expected-value": {"sf": 3},
    "check-households": {"sf": 3},
    "check-archer-between": {"sf": 3},
    "check-darts-given": {"sf": 3},
    "check-least-n-lights": {"sf": 3},
    "check-find-n": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
