"""SymPy assertions for lesson 1.4 (Financial applications of geometric sequences). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built from the question's own data with exact rational rates: a balance is PV * (1 + r/(100k))^(kn),
a depreciating value is PV * (1 - r/100)^n, and a real value uses the real rate r - i. Unknown rates are found with
SymPy's solve on the model equation, and "least number of periods" answers by stepping through whole periods exactly.
"""
import sys
from pathlib import Path

import re

from sympy import Eq, Rational, nsimplify, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer, parse_with_unit  # noqa: E402

R = Rational
rate = symbols("r", positive=True)


def same(tex, truth):
    # Decimals such as 1.0125 parse as floats; read them as the exact decimals they are before comparing.
    published = nsimplify(parse_answer(tex), rational=True)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_money(tex, truth):
    """An exact amount written with its unit, e.g. `FV = 768\\text{ euros}`."""
    same(parse_with_unit(tex, "euros"), truth)


def same_percent(tex, truth):
    """An exact percentage such as `7\\%`: the number in front of the % sign must equal the truth."""
    stripped = tex.replace("\\%", "")
    if stripped == tex:
        raise ValueError(f"{tex!r} has no % sign")
    same(stripped, truth)


def compound(pv, r, k, n):
    """Balance after n years at nominal r% a year, compounded k times a year."""
    return pv * (1 + R(r) / (100 * k)) ** (k * n)


def solve_rate(equation):
    """The single positive real rate satisfying the model equation."""
    roots = [root for root in solve(equation, rate) if root.is_real and root > 0]
    if len(roots) != 1:
        raise AssertionError(f"expected one positive rate, found {roots}")
    return roots[0]


def first_period_above(pv, multiplier, target):
    """Least whole number of periods N with pv * multiplier^N > target (interest added only at the end of a period)."""
    periods = 0
    while not pv * multiplier**periods > target:
        periods += 1
    return periods


# Distinct examples ---------------------------------------------------------------------------------------------------

def simple_vs_compound(tex):
    """Lena: 2500 for 3 years at 4%. Compound minus simple."""
    simple = 2500 + 3 * (2500 * R(4, 100))
    same_money(tex, compound(2500, 4, 1, 3) - simple)


def named_parts(tex):
    """`r = 6\\%, \\; PV = 1500\\text{ euros}` -> {"r": "6\\%", "PV": "1500\\text{ euros}"}."""
    parts = {}
    for piece in re.split(r",\s*(?:\\;)?", tex.strip().strip("$")):
        name, sep, rhs = piece.partition("=")
        if not sep or not name.strip() or not rhs.strip():
            raise ValueError(f"{tex!r}: every value needs a name, as in r = 6\\%")
        if name.strip() in parts:
            raise ValueError(f"{tex!r}: {name.strip()} is given twice")
        parts[name.strip()] = rhs.strip()
    return parts


def deposit_from_balances(tex):
    """Omar: end of year 1 is 1590, end of year 2 is 1685.40. Rate from the ratio of consecutive balances,
    then PV = u1 / ratio. Both the rate and the first deposit must be published, under their own names."""
    ratio = R(168540, 100) / 1590
    parts = named_parts(tex)
    if set(parts) != {"r", "PV"}:
        raise AssertionError(f"published names {sorted(parts)} are not ['PV', 'r']")
    same_percent(parts["r"], (ratio - 1) * 100)
    same_money(parts["PV"], 1590 / ratio)


def tractor_rate(tex):
    """85000 (1 - r/100)^4 = 52000, solved for the depreciation rate 0 < r < 100."""
    roots = [root for root in solve(Eq(85000 * (1 - rate / 100) ** 4, 52000), rate) if root.is_real and 0 < root < 100]
    if len(roots) != 1:
        raise AssertionError(f"expected one rate, found {roots}")
    check_rounded(tex, roots[0], sf=3)


def solver_months(tex):
    """Ana: 7500 at 3.9% compounded monthly; first whole month with balance above 10000."""
    same(tex, first_period_above(7500, 1 + R(39, 10) / 1200, 10000))


def solver_rate(tex):
    """12000 (1 + r/400)^24 = 15000 for the nominal rate r."""
    check_rounded(tex, solve_rate(Eq(12000 * (1 + rate / 400) ** 24, 15000)), sf=3)


CHECKS = {
    # before you start
    "before-nth-term-geometric": lambda tex: same(tex, 5 * 3 ** (6 - 1)),
    "before-ratio-from-terms": lambda v, tolerance: check_numeric(v, R(1175, 1250), dp=2, tolerance=tolerance),
    # simple to compound
    "ex-simple-vs-compound": simple_vs_compound,
    "ex-deposit-from-balances": deposit_from_balances,
    "check-compound-by-hand": lambda tex: same(tex, compound(4000, 3, 1, 2)),
    "check-fourth-year-interest": lambda v, tolerance: check_numeric(
        v, compound(2000, 5, 1, 4) - compound(2000, 5, 1, 3), dp=2, tolerance=tolerance),
    # the formula
    "ex-half-yearly-by-hand": lambda tex: check_rounded(tex, compound(4000, 6, 2, R(3, 2)), dp=2, unit="euros"),
    "ex-present-value": lambda tex: check_rounded(tex, 20000 / compound(1, R(44, 10), 4, 6), dp=2, unit="euros"),
    "check-quarterly-expression": lambda tex: same(tex, compound(3000, 5, 4, 7)),
    "check-monthly-value": lambda v, tolerance: check_numeric(
        v, compound(2500, R(54, 10), 12, 3), dp=2, tolerance=tolerance),
    # depreciation: the compound formula with k = 1 and -r
    "ex-laptop": lambda tex: same_money(tex, compound(1500, -20, 1, 3)),
    "ex-depreciation-rate": tractor_rate,
    # 64000 one year, 59520 the next: the multiplier is their ratio, and the rate is (1 - multiplier) * 100.
    "check-depreciation-rate-from-values": lambda tex: same_percent(tex, (1 - R(59520, 64000)) * 100),
    "check-depreciation-value": lambda v, tolerance: check_numeric(
        v, compound(950, -8, 1, 6), sf=3, tolerance=tolerance),
    # finance solver
    "ex-solver-months": solver_months,
    "ex-solver-rate": solver_rate,
    "check-tvm-n": lambda v, tolerance: check_numeric(v, 12 * 9, sf=3, tolerance=tolerance),
    # A fall of 13% a year is a rate of change of -13% (multiplier 1 + I%/100 = 0.87).
    "check-tvm-depreciation": lambda tex: same(tex, (R(87, 100) - 1) * 100),
    # inflation: real rate = interest rate - inflation rate
    "ex-real-value-yearly": lambda tex: check_rounded(
        tex, compound(8000, R(55, 10) - R(23, 10), 1, 10), dp=0, unit="euros"),
    "ex-real-value-monthly": lambda tex: check_rounded(
        tex, compound(25000, R(42, 10) - R(18, 10), 12, 8), dp=0, unit="euros"),
    "check-real-rate": lambda tex: same_percent(tex, R(31, 10) - R(44, 10)),
    "check-real-value": lambda v, tolerance: check_numeric(
        v, compound(6000, 4 - R(25, 10), 1, 5), dp=2, tolerance=tolerance),
}

NUMERIC = {
    "before-ratio-from-terms": {"dp": 2},
    "check-fourth-year-interest": {"dp": 2},
    "check-monthly-value": {"dp": 2},
    "check-depreciation-value": {"sf": 3},
    "check-tvm-n": {"sf": 3},
    "check-real-value": {"dp": 2},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
