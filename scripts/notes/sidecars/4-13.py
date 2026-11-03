"""SymPy assertions for lesson 4.13 (Bayes' theorem). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed without Bayes' formula. Each question's two-stage experiment is built as one finite random variable
whose outcomes are (first-stage outcome, second-stage outcome) pairs, weighted by multiplying along the tree. The
reversed probability is then sympy.stats' own conditional probability P(event, condition) on that joint distribution.
In the spinner example the second-stage weights come from sympy.stats Binomial densities, so every number of reds
0..8 is a separate outcome. Published decimals are read back as the exact rationals their digits state.
"""
import re
import sys
from pathlib import Path

from sympy import Eq, Float, Or, Rational, simplify
from sympy.stats import P, Binomial, FiniteRV, density

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

R = Rational


def exact(value):
    """A parsed SymPy number, with a Float turned into the exact rational its printed digits show."""
    if isinstance(value, Float):
        return Rational(str(value))
    return value


def same(tex, truth):
    published = exact(parse_answer(tex))
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


# ------------------------------------------------------------------------------------------- joint distributions

class TwoStage:
    """A two-stage experiment as one finite random variable over (first, second) outcome pairs.

    `first` maps each first-stage outcome to its probability; `second` maps each first-stage outcome to a dict of
    second-stage outcome -> conditional probability. Each pair gets a code; its weight is the product along the path.
    """

    def __init__(self, name, first, second):
        if sum(first.values()) != 1:
            raise ValueError(f"{name}: first stage does not sum to 1")
        self.codes = {}
        weights = {}
        for f, pf in first.items():
            if sum(second[f].values()) != 1:
                raise ValueError(f"{name}: second stage after {f} does not sum to 1")
            for s, ps in second[f].items():
                code = len(self.codes)
                self.codes[(f, s)] = code
                weights[code] = pf * ps
        self.X = FiniteRV(name, weights)

    def event(self, keep):
        """The event made of every (first, second) pair for which keep(first, second) is true."""
        return Or(*[Eq(self.X, code) for pair, code in self.codes.items() if keep(*pair)])

    def given(self, want, condition):
        return P(self.event(want), self.event(condition))

    def prob(self, want):
        return P(self.event(want))


def yes_no(p):
    """Second stage with outcomes True (the evidence) and False, the evidence having probability p."""
    return {True: p, False: 1 - p}


SPAM = TwoStage("spam", {"spam": R(20, 100), "genuine": R(80, 100)},
                {"spam": yes_no(R(95, 100)), "genuine": yes_no(R(4, 100))})

# Second stage: does Mia win the point?
TENNIS = TwoStage("tennis", {"in": R(6, 10), "out": R(4, 10)},
                  {"in": yes_no(R(7, 10)), "out": yes_no(R(4, 10))})

FLOOD = TwoStage("flood", {"high": R(1, 4), "normal": R(3, 4)},
                 {"high": yes_no(R(6, 10)), "normal": yes_no(R(4, 100))})

COURIER = TwoStage("courier", {1: R(50, 100), 2: R(30, 100), 3: R(20, 100)},
                   {1: yes_no(R(4, 100)), 2: yes_no(R(10, 100)), 3: yes_no(R(5, 100))})

CHIPS = TwoStage("chips", {1: R(25, 100), 2: R(35, 100), 3: R(40, 100)},
                 {1: yes_no(R(2, 100)), 2: yes_no(R(4, 100)), 3: yes_no(R(1, 100))})

# Spinner types in the box: 2 of T1, 2 of T2, 1 of T3. Given the type, the number of reds in 8 spins is binomial.
SPINNER_COUNTS = {1: 2, 2: 2, 3: 1}
SPINNER_P = {1: R(2, 10), 2: R(5, 10), 3: R(7, 10)}
SPINNERS = TwoStage(
    "spinners",
    {t: R(c, sum(SPINNER_COUNTS.values())) for t, c in SPINNER_COUNTS.items()},
    {t: dict(density(Binomial(f"X{t}", 8, SPINNER_P[t])).dict) for t in SPINNER_P},
)

MUSIC = TwoStage("music", {"music": R(65, 100), "silent": R(35, 100)},
                 {"music": yes_no(R(8, 100)), "silent": yes_no(R(8, 100))})

DEPENDENT = TwoStage("dependent", {"B": R(4, 10), "B'": R(6, 10)},
                     {"B": yes_no(R(3, 10)), "B'": yes_no(R(5, 10))})

DECIDE = TwoStage("decide", {"B": R(5, 10), "B'": R(5, 10)},
                  {"B": yes_no(R(2, 10)), "B'": yes_no(R(6, 10))})

# Independent A and B with P(A) = 0.2, P(B) = 0.35: the first stage is A, the second is B with the same chance either way.
INDEP = TwoStage("indep", {"A": R(2, 10), "A'": R(8, 10)},
                 {"A": yes_no(R(35, 100)), "A'": yes_no(R(35, 100))})


# ------------------------------------------------------------------------------------------- word answers

def plain(text):
    text = text.replace("$", "")
    text = re.sub(r"\\mathrm\{P\}", "P", text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def claim_of(text):
    """Read an independence option into (independent?, stated P(B | A) or None)."""
    t = plain(text)
    m = re.match(r"^(yes|no), because (.*)$", t)
    if not m:
        raise ValueError(f"unreadable option {text!r}")
    independent = m.group(1) == "yes"
    reason = m.group(2)
    value = re.match(r"^p\(b \\mid a\) = ([0-9.]+), which (is not|equals) p\(b\)$", reason)
    if value:
        return independent, Rational(value.group(1))
    if reason == r"p(a \mid b) + p(a \mid b') < 1":
        return independent, None
    raise ValueError(f"unreadable reason {reason!r}")


def decide_independence(text):
    independent, stated = claim_of(text)
    p_b_given_a = DECIDE.given(lambda f, s: f == "B", lambda f, s: s)
    p_b = DECIDE.prob(lambda f, s: f == "B")
    truth = simplify(p_b_given_a - p_b) == 0
    if independent != truth:
        raise AssertionError(f"option says independent={independent}, truth is {truth}")
    if stated is None or simplify(stated - p_b_given_a) != 0:
        raise AssertionError(f"option's P(B | A) = {stated} is not {p_b_given_a}")


CHECKS = {
    # Before: the 4.11 definition, the multiplication form, independence.
    "before-conditional": lambda v, tolerance: check_numeric(v, R(12, 100) / R(3, 10), sf=3, tolerance=tolerance),
    "before-branch-product": lambda v, tolerance: check_numeric(
        v, TwoStage("branch", {"B": R(6, 10), "B'": R(4, 10)}, {"B": yes_no(R(1, 4)), "B'": yes_no(R(1, 2))}).prob(
            lambda f, s: f == "B" and s), sf=3, tolerance=tolerance),
    "before-independent": lambda v, tolerance: check_numeric(
        v, TwoStage("ind", {"B": R(8, 10), "B'": R(2, 10)}, {"B": yes_no(R(3, 10)), "B'": yes_no(R(3, 10))}).given(
            lambda f, s: s, lambda f, s: f == "B"), sf=3, tolerance=tolerance),
    # Section 1: two events.
    "ex-spam-filter": lambda tex: same(tex, SPAM.given(lambda f, s: f == "spam", lambda f, s: s)),
    "check-spam-not-flagged": lambda v, tolerance: check_numeric(
        v, SPAM.given(lambda f, s: f == "spam", lambda f, s: not s), sf=3, tolerance=tolerance),
    "ex-tennis-serve": lambda tex: same(tex, TENNIS.given(lambda f, s: f == "in", lambda f, s: not s)),
    "check-flood": lambda tex: same(tex, FLOOD.given(lambda f, s: f == "high", lambda f, s: s)),
    # Section 2: three events.
    "ex-courier-late": lambda tex: same(tex, COURIER.given(lambda f, s: f == 2, lambda f, s: s)),
    "check-chips-machine": lambda tex: same(tex, CHIPS.given(lambda f, s: f == 2, lambda f, s: s)),
    "ex-spinner-types": lambda tex: check_rounded(
        tex, SPINNERS.given(lambda f, s: f == 3, lambda f, s: s == 5), sf=3),
    "check-chips-not-faulty": lambda v, tolerance: check_numeric(
        v, CHIPS.given(lambda f, s: f == 3, lambda f, s: not s), sf=3, tolerance=tolerance),
    # Section 3: independence.
    "ex-music-best": lambda tex: same(tex, MUSIC.given(lambda f, s: f == "music", lambda f, s: s)),
    "ex-determine-independence": lambda tex: same(tex, DEPENDENT.given(lambda f, s: f == "B", lambda f, s: s)),
    "check-independent-complement": lambda tex: same(tex, INDEP.given(lambda f, s: not s, lambda f, s: f == "A")),
    "check-decide-independence": decide_independence,
}

NUMERIC = {
    "before-conditional": {"sf": 3},
    "before-branch-product": {"sf": 3},
    "before-independent": {"sf": 3},
    "check-spam-not-flagged": {"sf": 3},
    "check-chips-not-faulty": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
