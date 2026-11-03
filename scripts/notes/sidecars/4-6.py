"""SymPy assertions for lesson 4.6 (probability diagrams, rules and independence). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

The truths are computed independently of the lesson's formulas wherever the data allow:
- counts in a Venn diagram come from explicit Python sets of people;
- dice and draws without replacement come from enumerating every equally likely ordered outcome with itertools;
- trees come from enumerating each path's joint probability;
- questions given only as probabilities are solved as a linear (or, for independence, quadratic) system in the four
  Venn regions, keeping only the solution whose regions all lie in [0, 1].
Published decimals are read back as exact rationals from their printed digits before comparing.
"""
import re
import sys
from itertools import permutations, product
from pathlib import Path

from sympy import Float, Rational, simplify, solve, symbols

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


def R(text):
    return Rational(text)


# ---------- Venn regions as unknowns: a = A only, ab = both, b = B only, n = neither ----------
a, ab, b, n, p = symbols("a ab b n p")
PA, PB, PU = a + ab, ab + b, a + ab + b


def regions(*equations, unknowns=(a, ab, b, n)):
    """The unique assignment of the four regions (plus any extra unknown) with every region in [0, 1]."""
    sols = solve([a + ab + b + n - 1, *equations], list(unknowns), dict=True)
    valid = [s for s in sols if all(s[r].is_real and 0 <= s[r] <= 1 for r in (a, ab, b, n))]
    if len(valid) != 1:
        raise RuntimeError(f"expected one valid solution, got {valid}")
    return valid[0]


def exclusive_possible(pa, pb):
    """Is there a valid Venn diagram with P(A) = pa, P(B) = pb and nothing in the overlap?"""
    sols = solve([a + ab + b + n - 1, ab, PA - pa, PB - pb], [a, ab, b, n], dict=True)
    return any(all(0 <= s[r] <= 1 for r in (a, ab, b, n)) for s in sols)


def yes_no(text, truth):
    """A word answer: the option must start with the verdict SymPy computed."""
    claim = text.strip().startswith("Yes")
    if not (text.strip().startswith("Yes") or text.strip().startswith("No")):
        raise ValueError(f"cannot read verdict in {text!r}")
    if claim != truth:
        raise AssertionError(f"option claims {claim}, truth is {truth}")
    return claim


# ---------- before ----------
EIGHT = range(1, 9)

# ---------- venn: explicit sets of people ----------
CINEMA = set(range(60))
SNACK = set(range(0, 34))         # 34 people
DRINK = set(range(22, 47))        # 25 people, 12 of them (22..33) also in SNACK
assert len(SNACK) == 34 and len(DRINK) == 25 and len(SNACK & DRINK) == 12

CLASS = set(range(30))
FRENCH = set(range(0, 18))        # 18 students
SPANISH = set(range(13, 24))      # 11 students, 5 of them (13..17) also study French
assert len(FRENCH) == 18 and len(SPANISH) == 11 and len(FRENCH & SPANISH) == 5

# ---------- dice ----------
DICE = list(product(range(1, 7), repeat=2))
TOTAL_9 = {o for o in DICE if sum(o) == 9}
DOUBLE = {o for o in DICE if o[0] == o[1]}

# ---------- travel table (one record per student) ----------
TABLE = {("12", "walk"): 18, ("12", "bus"): 24, ("12", "car"): 8, ("13", "walk"): 22, ("13", "bus"): 30, ("13", "car"): 18}
STUDENTS = [key for key, count in TABLE.items() for _ in range(count)]
assert len(STUDENTS) == 120


def given(event, condition, population=STUDENTS):
    """Restrict to the condition, then count the event: no formula, just the shrunken sample space."""
    kept = [s for s in population if condition(s)]
    return Rational(sum(1 for s in kept if event(s)), len(kept))


def frac(event, population=STUDENTS):
    return Rational(sum(1 for s in population if event(s)), len(population))


# ---------- café: 1000 customers, 40% hot drink, 35% of those buy a pastry ----------
CAFE_SIZE = 1000
CAFE_HOT = CAFE_SIZE * R("0.4")          # from the question's 40%
CAFE_BOTH = CAFE_HOT * R("0.35")         # from the question's 35% of the hot-drink customers
CAFE = ([("H", "S")] * int(CAFE_BOTH) + [("H", "-")] * int(CAFE_HOT - CAFE_BOTH)
        + [("-", "?")] * int(CAFE_SIZE - CAFE_HOT))
assert CAFE_HOT.is_integer and CAFE_BOTH.is_integer and len(CAFE) == CAFE_SIZE
assert frac(lambda c: c[0] == "H", CAFE) == R("0.4")
assert given(lambda c: c[1] == "S", lambda c: c[0] == "H", population=CAFE) == R("0.35")

# ---------- tree for Sam's bus: joint probability of each path ----------
RAIN = {"R": R("0.3"), "R'": R("0.7")}
LATE_GIVEN = {"R": {"L": R("0.25"), "L'": R("0.75")}, "R'": {"L": R("0.1"), "L'": R("0.9")}}
PATHS = {(r, l): RAIN[r] * LATE_GIVEN[r][l] for r in RAIN for l in ("L", "L'")}
assert sum(PATHS.values()) == 1
P_LATE = sum(v for (r, l), v in PATHS.items() if l == "L")
P_RAIN_GIVEN_LATE = PATHS[("R", "L")] / P_LATE

# ---------- draws without replacement: every ordered pair of distinct labelled items ----------
COUNTERS = ["G"] * 5 + ["W"] * 3
PAIRS = list(permutations(range(len(COUNTERS)), 2))
SAME_COLOUR = Rational(sum(1 for i, j in PAIRS if COUNTERS[i] == COUNTERS[j]), len(PAIRS))

BULBS = ["F"] * 3 + ["ok"] * 7
BULB_PAIRS = list(permutations(range(len(BULBS)), 2))
BOTH_FAULTY = Rational(sum(1 for i, j in BULB_PAIRS if BULBS[i] == "F" and BULBS[j] == "F"), len(BULB_PAIRS))

# ---------- Ana's driving test: paths pass1, fail-pass, fail-fail ----------
ANA = {("pass",): R("0.7"), ("fail", "pass"): R("0.3") * R("0.8"), ("fail", "fail"): R("0.3") * R("0.2")}
assert sum(ANA.values()) == 1
ANA_PASS = sum(v for path, v in ANA.items() if path[-1] == "pass")

# ---------- probability-only questions, solved for the regions ----------
RULE = regions(PA - R("0.45"), PB - R("0.3"), PU - R("0.6"))
EXCL_ALG = regions(ab, PA - R("0.28"), PU - R("0.73"))
EXCL_NEITHER = regions(ab, PA - R("0.15"), PB - R("0.6"))
UNION_NUM = regions(PA - R("0.42"), PB - R("0.37"), ab - R("0.16"))
COND_COMP = regions(PA - R("0.55"), PB - R("0.3"), PU - R("0.67"))
GDC = regions(PA - p, PB - (p + R("0.25")), ab - R("0.18"), ab - PA * PB, unknowns=(a, ab, b, n, p))
IS_INDEP = regions(PA - R("0.6"), PB - R("0.35"), PU - R("0.74"))
INDEP_NUM = regions(PA - R("0.4"), PB - R("0.55"), ab - PA * PB)


def check_is_independent(text):
    pa, pb, inter = IS_INDEP[a] + IS_INDEP[ab], IS_INDEP[ab] + IS_INDEP[b], IS_INDEP[ab]
    truth = simplify(inter - pa * pb) == 0
    if yes_no(text, truth):
        # The correct option also quotes the overlap: it must be the true value.
        quoted = re.search(r"=\s*([0-9.]+)\s*=", text)
        if not quoted or Rational(quoted.group(1)) != inter:
            raise AssertionError(f"quoted overlap {quoted and quoted.group(1)} is not {inter}")


def check_dice_exclusive(tex):
    # Part (a) claims the events share no outcome: confirm it on the 36 cells, then check P(A u B) by counting.
    if TOTAL_9 & DOUBLE:
        raise AssertionError("the events overlap, so they are not mutually exclusive")
    same(tex, Rational(len(TOTAL_9 | DOUBLE), len(DICE)))


def check_test_independence(tex):
    product_truth = frac(lambda s: s[0] == "13") * frac(lambda s: s[1] == "bus")
    same(tex, product_truth)
    # The lesson concludes "not independent": confirm that against the table's own overlap.
    if product_truth == frac(lambda s: s == ("13", "bus")):
        raise AssertionError("T and B are independent, but the lesson says they are not")


CHECKS = {
    # before
    "before-complement": lambda v, tolerance: check_numeric(v, 1 - R("0.38"), sf=3, tolerance=tolerance),
    "before-greater-than-five": lambda tex: same(tex, Rational(sum(1 for k in EIGHT if k > 5), len(EIGHT))),
    "before-two-spins": lambda v, tolerance: check_numeric(v, len(list(product(range(1, 6), repeat=2))), sf=3, tolerance=tolerance),
    # venn
    "ex-cinema-venn": lambda tex: same(tex, Rational(len(CINEMA - (SNACK | DRINK)), len(CINEMA))),
    "ex-rule-intersection": lambda tex: same(tex, RULE[a]),
    "check-union-numeric": lambda v, tolerance: check_numeric(v, UNION_NUM[a] + UNION_NUM[ab] + UNION_NUM[b], sf=3, tolerance=tolerance),
    "check-neither-class": lambda tex: same(tex, Rational(len(CLASS - (FRENCH | SPANISH)), len(CLASS))),
    # exclusive
    "ex-dice-exclusive": check_dice_exclusive,
    "ex-exclusive-algebra": lambda tex: same(tex, EXCL_ALG[n]),
    "check-could-exclusive": lambda tex: yes_no(tex, exclusive_possible(R("0.58"), R("0.61"))),
    "check-exclusive-neither": lambda v, tolerance: check_numeric(v, EXCL_NEITHER[n], sf=3, tolerance=tolerance),
    # conditional
    "ex-cafe-multiply": lambda tex: same(tex, frac(lambda c: c == ("H", "S"), CAFE)),
    "ex-conditional-complement": lambda tex: same(tex, COND_COMP[b] / (COND_COMP[b] + COND_COMP[n])),
    "check-given-table": lambda tex: same(tex, given(lambda s: s[0] == "12", lambda s: s[1] == "walk")),
    "check-conditional-numeric": lambda v, tolerance: check_numeric(
        v, given(lambda s: s[1] == "B", lambda s: s[0] == "A",
                 population=[("A", "B")] * 12 + [("A", "-")] * 20 + [("-", "?")] * 68), sf=3, tolerance=tolerance),
    # trees
    "ex-tree-late": lambda tex: same(tex, P_RAIN_GIVEN_LATE),
    "ex-counters-without": lambda tex: same(tex, SAME_COLOUR),
    "check-tree-two-attempts": lambda tex: same(tex, ANA_PASS),
    "check-faulty-bulbs": lambda v, tolerance: check_numeric(v, BOTH_FAULTY, sf=3, tolerance=tolerance),
    # independent
    "ex-test-independence": check_test_independence,
    "ex-independent-gdc": lambda tex: check_rounded(tex, GDC[p], sf=3),
    "check-is-independent": check_is_independent,
    "check-independent-numeric": lambda v, tolerance: check_numeric(v, INDEP_NUM[a], sf=3, tolerance=tolerance),
}

NUMERIC = {
    "before-complement": {"sf": 3},
    "before-two-spins": {"sf": 3},
    "check-union-numeric": {"sf": 3},
    "check-exclusive-neither": {"sf": 3},
    "check-conditional-numeric": {"sf": 3},
    "check-faulty-bulbs": {"sf": 3},
    "check-independent-numeric": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
