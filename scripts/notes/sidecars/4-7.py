"""SymPy assertions for lesson 4.7 (discrete random variables and expected value). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed from the question's own data with exact SymPy rationals: unknowns are solved from
sum P(X = x) = 1 or from the stated E(X) (keeping only roots that give a valid distribution), sample spaces are built
with itertools and counted, and E(X) is the sum of x P(X = x). Published decimals are read back as exact rationals.
"""
import sys
from itertools import combinations, product
from pathlib import Path

from sympy import Float, Rational, S, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

k, p = symbols("k p")


def exact(value):
    """A parsed SymPy number, with a Float turned into the exact rational its printed digits show."""
    if isinstance(value, Float):
        return Rational(str(value))
    return value


def same(tex, truth):
    published = exact(parse_answer(tex))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def valid_root(equation, unknown, probabilities):
    """The single root of `equation` for which every probability lies in [0, 1] and the total is 1."""
    good = []
    for root in solve(equation, unknown):
        values = [S(q).subs(unknown, root) for q in probabilities]
        if root.is_real and all(0 <= v <= 1 for v in values) and simplify(sum(values) - 1) == 0:
            good.append(root)
    if len(good) != 1:
        raise RuntimeError(f"expected one valid root, got {good}")
    return good[0]


def expectation(dist):
    return sum(S(x) * q for x, q in dist.items())


def prob(dist, event):
    return sum(q for x, q in dist.items() if event(x))


# ex-smaller-card: two of five cards picked together; X is the smaller number.
PAIRS = list(combinations(range(1, 6), 2))
CARDS = {x: Rational(sum(1 for pair in PAIRS if min(pair) == x), len(PAIRS)) for x in range(1, 5)}

# ex-goals-k: the probabilities 0.05, 0.3, 2k, k, 0.2 for x = 0..4.
GOALS_P = [Rational(5, 100), Rational(3, 10), 2 * k, k, Rational(2, 10)]
K_GOALS = valid_root(sum(GOALS_P) - 1, k, GOALS_P)
GOALS = {x: S(q).subs(k, K_GOALS) for x, q in zip(range(5), GOALS_P)}

# ex-quadratic-k: 0.3, 4k^2, k, 0.2.
QUAD_P = [Rational(3, 10), 4 * k**2, k, Rational(2, 10)]
K_QUAD = valid_root(sum(QUAD_P) - 1, k, QUAD_P)

# check-find-k-table: 0.1, k, 3k, 0.26.
TABLE_P = [Rational(1, 10), k, 3 * k, Rational(26, 100)]
K_TABLE = valid_root(sum(TABLE_P) - 1, k, TABLE_P)

# ex-formula-reciprocal: P(X = x) = k / x on {1, 2, 3, 6}.
RECIP_X = [1, 2, 3, 6]
K_RECIP = valid_root(sum(k / x for x in RECIP_X) - 1, k, [k / x for x in RECIP_X])
RECIP = {x: K_RECIP / x for x in RECIP_X}

# ex-formula-quadratic: P(X = x) = k(x^2 + 1) on {-1, 0, 1, 2}.
SQ_X = [-1, 0, 1, 2]
K_SQ = valid_root(sum(k * (x**2 + 1) for x in SQ_X) - 1, k, [k * (x**2 + 1) for x in SQ_X])
SQ = {x: K_SQ * (x**2 + 1) for x in SQ_X}

# check-formula-k: P(X = x) = k(x + 3) on {1, 2, 3, 4}.
LIN_X = [1, 2, 3, 4]
K_LIN = valid_root(sum(k * (x + 3) for x in LIN_X) - 1, k, [k * (x + 3) for x in LIN_X])

# check-expect-reciprocal: P(X = x) = 1 / (2x) on {1, 2, 3, 6}.
HALF_RECIP = {x: Rational(1, 2 * x) for x in RECIP_X}
assert sum(HALF_RECIP.values()) == 1

# ex-expect-unknown: x = 2, 4, 6, 8 with 0.1, p, 0.4, 0.5 - p and E(X) = 5.8.
UNK_X = [2, 4, 6, 8]
UNK_P = [Rational(1, 10), p, Rational(4, 10), Rational(1, 2) - p]
P_UNK = valid_root(sum(x * q for x, q in zip(UNK_X, UNK_P)) - Rational(58, 10), p, UNK_P)

# ex-expect-gdc: P(X = x) = k (0.8)^x on {0, ..., 5}; E(X) computed exactly.
JAM_X = range(6)
K_JAM = 1 / sum(Rational(4, 5) ** x for x in JAM_X)
E_JAM = expectation({x: K_JAM * Rational(4, 5) ** x for x in JAM_X})

# ex-spinner-gain: cost 2; prizes 5 (0.2), 1 (0.3), 0 (rest). Gain = prize - cost.
SPIN_PRIZES = {5: Rational(2, 10), 1: Rational(3, 10)}
SPIN_PRIZES[0] = 1 - sum(SPIN_PRIZES.values())
E_SPIN = expectation({prize - 2: q for prize, q in SPIN_PRIZES.items()})

# ex-fair-prize-two-spins: five sectors, one red; two independent spins; cost 3.
SECTORS = ["R", "W", "W", "W", "W"]
SPINS = list(product(SECTORS, repeat=2))
P_TWO = Rational(sum(1 for s in SPINS if s.count("R") == 2), len(SPINS))
P_ONE = Rational(sum(1 for s in SPINS if s.count("R") == 1), len(SPINS))
P_NONE = Rational(sum(1 for s in SPINS if s.count("R") == 0), len(SPINS))
K_FAIR = solve(P_TWO * (k - 3) + P_ONE * (5 - 3) + P_NONE * (0 - 3), k)[0]

# check-fair-verdict: cost 1 token; die: 6 pays 4, 5 pays 2.
DIE_GAIN = sum(Rational(1, 6) * ({6: 4, 5: 2}.get(face, 0) - 1) for face in range(1, 7))
VERDICTS = {"The game is fair.": 0, "A player gains on average.": 1, "A player loses on average.": -1}


def verdict(text):
    text = text.strip().strip("$").strip()
    if text not in VERDICTS:
        raise ValueError(f"unreadable verdict {text!r}")
    sign = 0 if DIE_GAIN == 0 else (1 if DIE_GAIN > 0 else -1)
    if VERDICTS[text] != sign:
        raise AssertionError(f"{text!r} does not match an expected gain of {DIE_GAIN}")


# check-fair-fee: cards 1..10; multiples of 3 win their value. Fair fee = expected prize.
FEE = sum(Rational(c, 10) for c in range(1, 11) if c % 3 == 0)

# check-expected-total: 10 discs (1 gold 20, 3 silver 5, 6 white 0); cost 4; 60 games.
DISCS = [20] + [5] * 3 + [0] * 6
E_DISC = sum(Rational(prize - 4, len(DISCS)) for prize in DISCS)

CHECKS = {
    # Before: complement, two coins, independence.
    "before-not-late": lambda v, tolerance: check_numeric(v, 1 - Rational(18, 100), sf=3, tolerance=tolerance),
    "before-one-head": lambda tex: same(
        tex, Rational(sum(1 for o in product("HT", repeat=2) if o.count("H") == 1), 4)),
    "before-independent": lambda v, tolerance: check_numeric(
        v, Rational(3, 10) * Rational(6, 10), sf=3, tolerance=tolerance),
    # Section 1: distributions.
    "ex-smaller-card": lambda tex: same(tex, prob(CARDS, lambda x: x >= 3)),
    "ex-goals-k": lambda tex: same(tex, prob(GOALS, lambda x: x >= 2)),
    "ex-quadratic-k": lambda tex: same(tex, K_QUAD),
    "check-find-k-table": lambda v, tolerance: check_numeric(v, K_TABLE, sf=3, tolerance=tolerance),
    "check-strict-inequality": lambda tex: same(tex, prob(GOALS, lambda x: x > 2)),
    # Section 2: formulas.
    "ex-formula-reciprocal": lambda tex: same(tex, K_RECIP),
    "ex-formula-quadratic": lambda tex: same(tex, prob(SQ, lambda x: x > 0)),
    "check-formula-k": lambda tex: same(tex, K_LIN),
    "check-formula-prob": lambda v, tolerance: check_numeric(
        v, prob(RECIP, lambda x: x <= 3), sf=3, tolerance=tolerance),
    # Section 3: expected value.
    "ex-expect-goals": lambda tex: same(tex, expectation(GOALS)),
    "ex-expect-unknown": lambda tex: same(tex, P_UNK),
    "ex-expect-gdc": lambda tex: check_rounded(tex, E_JAM, sf=3),
    "check-expect-reciprocal": lambda tex: same(tex, expectation(HALF_RECIP)),
    "check-expect-quadratic": lambda v, tolerance: check_numeric(v, expectation(SQ), sf=3, tolerance=tolerance),
    # Section 4: games.
    "ex-spinner-gain": lambda tex: same(tex, E_SPIN),
    "ex-fair-prize-two-spins": lambda tex: same(tex, K_FAIR),
    "check-fair-verdict": verdict,
    "check-fair-fee": lambda v, tolerance: check_numeric(v, FEE, sf=3, tolerance=tolerance),
    "check-expected-total": lambda v, tolerance: check_numeric(v, 60 * E_DISC, sf=3, tolerance=tolerance),
}

NUMERIC = {
    "before-not-late": {"sf": 3},
    "before-independent": {"sf": 3},
    "check-find-k-table": {"sf": 3},
    "check-formula-prob": {"sf": 3},
    "check-expect-quadratic": {"sf": 3},
    "check-fair-fee": {"sf": 3},
    "check-expected-total": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
