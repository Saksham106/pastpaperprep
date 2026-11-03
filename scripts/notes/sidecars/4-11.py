"""SymPy assertions for lesson 4.11 (conditional probability). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

The truths are computed independently of the lesson's working wherever the data allow:
- questions given only as probabilities are solved for the four Venn regions (A only, both, B only, neither),
  keeping the one solution whose regions all lie in [0, 1]; conditional probabilities are then read off the regions;
- trees come from each path's joint probability; tables come from one record per person;
- binomial, normal and discrete-table conditionals use sympy.stats' own conditional probability P(event, condition),
  which never sees the lesson's choice of overlap or of X >= 8 for X > 7.
Published decimals are read back as exact rationals from their printed digits before comparing.
"""
import re
import sys
from pathlib import Path

from sympy import And, Eq, Float, Rational, simplify, solve, symbols
from sympy.stats import Binomial, FiniteRV, Normal, P

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402


def R(text):
    return Rational(text)


def exact(value):
    """A parsed SymPy number, with a Float turned into the exact rational its printed digits show."""
    if isinstance(value, Float):
        return Rational(str(value))
    return value


def same(tex, truth):
    published = exact(parse_answer(tex))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


# ---------- Venn regions as unknowns: a = A only, ab = both, b = B only, n = neither ----------
a, ab, b, n = symbols("a ab b n")
PA, PB, PU = a + ab, ab + b, a + ab + b


def regions(*equations):
    """The unique assignment of the four regions with every region in [0, 1]."""
    sols = solve([a + ab + b + n - 1, *equations], [a, ab, b, n], dict=True)
    valid = [s for s in sols if all(s[r].is_real and 0 <= s[r] <= 1 for r in (a, ab, b, n))]
    if len(valid) != 1:
        raise RuntimeError(f"expected one valid solution, got {valid}")
    return valid[0]


def cond(event_regions, condition_regions, sol):
    """P(event | condition), each written as a set of region symbols."""
    num = sum(sol[r] for r in event_regions & condition_regions)
    den = sum(sol[r] for r in condition_regions)
    return num / den


A_SET, B_SET = {a, ab}, {ab, b}
NOT_A, NOT_B = {b, n}, {a, n}

# ---------- before ----------
BEFORE_INTER = regions(PA - R("0.5"), PB - R("0.35"), PU - R("0.7"))
B5 = Binomial("B5", 5, R("0.2"))
Y = Normal("Y", 50, 4)

# ---------- definition ----------
BOTH_WAYS = regions(PA - R("0.45"), PB - R("0.4"), a - R("0.21"))
assert cond(A_SET, B_SET, BOTH_WAYS) == R("0.6")  # part (a) of the example, stated in its steps

# Priya: picture 10 000 days. The counts come from the question's two rates (8% cancelled, 0.65 late given
# cancelled), never typed in; then count the days that are both.
N_DAYS = 10000
N_CANCELLED = N_DAYS * R("0.08")
N_CANCELLED_LATE = N_CANCELLED * R("0.65")
assert N_CANCELLED.is_integer and N_CANCELLED_LATE.is_integer
DAYS = (
    [("C", "L")] * int(N_CANCELLED_LATE)
    + [("C", "-")] * int(N_CANCELLED - N_CANCELLED_LATE)
    + [("-", "?")] * int(N_DAYS - N_CANCELLED)
)
assert len(DAYS) == N_DAYS
_cancelled = [d for d in DAYS if d[0] == "C"]
assert Rational(len(_cancelled), N_DAYS) == R("0.08")
assert Rational(sum(1 for d in _cancelled if d[1] == "L"), len(_cancelled)) == R("0.65")
CANCELLED_AND_LATE = Rational(sum(1 for d in DAYS if d == ("C", "L")), N_DAYS)

# Quiz tree: joint probability of each path.
EASY = {"E": R(3) / 4, "E'": R(1) / 4}
CORRECT_GIVEN = {"E": R(4) / 5, "E'": R(1) / 3}
PATHS = {}
for q, pq in EASY.items():
    PATHS[(q, "C")] = pq * CORRECT_GIVEN[q]
    PATHS[(q, "C'")] = pq * (1 - CORRECT_GIVEN[q])
assert sum(PATHS.values()) == 1
P_WRONG = sum(v for (q, c), v in PATHS.items() if c == "C'")
assert P_WRONG == R(19) / 60  # the "show that" in part (a)
HARD_GIVEN_WRONG = PATHS[("E'", "C'")] / P_WRONG

CHANGE = regions(PB - R("0.25"), ab - R("0.6") * PB, PU - R("0.6"))

# ---------- distributions ----------
THROWS = Binomial("THROWS", 10, R("0.7"))
BUS = Normal("BUS", 40, 6)
TABLE_X = FiniteRV("TABLE_X", {1: R("0.1"), 2: R("0.2"), 3: R("0.3"), 4: R("0.4")})
SUNFLOWER = Normal("SUNFLOWER", 165, 8)

# ---------- independence ----------
# Smartwatch survey: one record per adult, (watch?, runs?).
ADULTS = [("W", "R")] * 36 + [("W", "R'")] * 24 + [("W'", "R")] * 84 + [("W'", "R'")] * 56
assert len(ADULTS) == 200


def frac_given(event, condition):
    kept = [p for p in ADULTS if condition(p)]
    return Rational(sum(1 for p in kept if event(p)), len(kept))


def check_table_independent(tex):
    given_w = frac_given(lambda p: p[1] == "R", lambda p: p[0] == "W")
    given_not_w = frac_given(lambda p: p[1] == "R", lambda p: p[0] == "W'")
    if given_w != given_not_w:
        raise AssertionError("the two conditional probabilities differ, so the lesson's conclusion is wrong")
    both = Rational(sum(1 for p in ADULTS if p == ("W", "R")), 200)
    p_r = Rational(sum(1 for p in ADULTS if p[1] == "R"), 200)
    p_w = Rational(sum(1 for p in ADULTS if p[0] == "W"), 200)
    if both != p_r * p_w:
        raise AssertionError("product test disagrees")
    same(tex, given_w)


# P(A | B') = 0.4, P(B) = 0.35, independent: solve for the regions.
UNION = regions(PB - R("0.35"), ab - PA * PB, a - R("0.4") * (a + n))

TEST = regions(PA - R("0.6"), PB - R("0.25"), ab - R("0.12"))


def yes_no(text, truth):
    t = text.strip()
    if not (t.startswith("Yes") or t.startswith("No")):
        raise ValueError(f"cannot read verdict in {text!r}")
    claim = t.startswith("Yes")
    if claim != truth:
        raise AssertionError(f"option claims {claim}, truth is {truth}")


def check_test_independence(text):
    truth = simplify(TEST[ab] - (TEST[a] + TEST[ab]) * (TEST[ab] + TEST[b])) == 0
    yes_no(text, truth)
    # The correct option quotes P(A | B): it must be the true value.
    quoted = re.search(r"=\s*([0-9.]+)\s*\\ne", text)
    if not quoted or Rational(quoted.group(1)) != cond(A_SET, B_SET, TEST):
        raise AssertionError(f"quoted P(A|B) {quoted and quoted.group(1)} is not {cond(A_SET, B_SET, TEST)}")


COMPLEMENTS = regions(PA - R("0.45"), PB - R("0.2"), ab - PA * PB)


CHECKS = {
    # before
    "before-intersection": lambda v, tolerance: check_numeric(v, BEFORE_INTER[ab], sf=3, tolerance=tolerance),
    "before-binomial-zero": lambda v, tolerance: check_numeric(v, P(Eq(B5, 0)), sf=3, tolerance=tolerance),
    "before-normal-above": lambda v, tolerance: check_numeric(v, P(Y > 54), sf=3, tolerance=tolerance),
    # definition
    "ex-def-both-ways": lambda tex: same(tex, cond(B_SET, A_SET, BOTH_WAYS)),
    "check-multiply-form": lambda v, tolerance: check_numeric(v, CANCELLED_AND_LATE, sf=3, tolerance=tolerance),
    "ex-tree-reverse": lambda tex: same(tex, HARD_GIVEN_WRONG),
    "check-change-condition": lambda tex: same(tex, cond(A_SET, NOT_B, CHANGE)),
    # distributions
    "ex-binomial-given": lambda tex: check_rounded(tex, P(THROWS > 7, THROWS <= 9), sf=3),
    "ex-normal-given": lambda tex: check_rounded(tex, P(BUS > 44, And(BUS > 32, BUS < 48)), sf=3),
    "check-table-given": lambda tex: same(tex, P(Eq(TABLE_X, 4), TABLE_X > 2)),
    "check-normal-given": lambda v, tolerance: check_numeric(v, P(SUNFLOWER > 180, SUNFLOWER > 170), sf=3, tolerance=tolerance),
    # independence
    "ex-table-independent": check_table_independent,
    "ex-independent-union": lambda tex: same(tex, UNION[a] + UNION[ab] + UNION[b]),
    "check-test-independence": check_test_independence,
    "check-complements-independent": lambda v, tolerance: check_numeric(v, cond(NOT_A, NOT_B, COMPLEMENTS), sf=3, tolerance=tolerance),
}

NUMERIC = {
    "before-intersection": {"sf": 3},
    "before-binomial-zero": {"sf": 3},
    "before-normal-above": {"sf": 3},
    "check-multiply-form": {"sf": 3},
    "check-normal-given": {"sf": 3},
    "check-complements-independent": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
