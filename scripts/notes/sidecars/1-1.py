"""SymPy assertions for lesson 1.1 (standard form and orders of magnitude). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC (this lesson has none).

In this lesson the FORM of an answer is part of what is marked: $30 \\times 10^{-7}$ has the right value but is not
standard form. So `standard_form` checks two things on the published text: the right-hand side is exactly
a \\times 10^{k} with 1 <= a < 10 and k an integer, and its value equals a truth computed with exact SymPy rationals from
the question's own numbers (products, quotients, powers, roots and sums done by SymPy, never typed in). Calculator
notation such as 2.04E-7 is read and rejected as wrong form. Rounded answers (\\approx) also go through check_rounded.
"""
import re
import sys
from pathlib import Path

from sympy import Integer, Rational, simplify, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import _strip_decorations, check_rounded, parse_answer, parse_with_unit  # noqa: E402

TEN = Integer(10)
STANDARD = re.compile(r"(-?)\s*(\d+(?:\.\d+)?)\s*\\times\s*10\^\{?\s*(-?\d+)\s*\}?")
CALCULATOR = re.compile(r"\d(?:\.\d+)?\s*E\s*[+-]?\d+")
PLAIN_DECIMAL = re.compile(r"-?\d+(?:\.\d+)?")


def dec(text):
    """An exact rational from a decimal written in the question, e.g. dec("7.5") = 15/2."""
    return Rational(text)


def relation_and_rhs(tex, unit=None):
    """(relation, right-hand side) after the last `=` or `\\approx`, with any unit removed."""
    text = parse_with_unit(tex, unit) if unit else tex
    cleaned = _strip_decorations(text)
    cuts = list(re.finditer(r"\\approx|=", cleaned))
    if not cuts:
        return "=", cleaned.strip()
    last = cuts[-1]
    return last.group(0), cleaned[last.end():].strip()


def standard_form(tex, truth, unit=None, sf=3):
    if CALCULATOR.search(tex) and "\\times" not in tex:
        raise AssertionError(f"{tex!r} is calculator notation, not standard form")
    relation, rhs = relation_and_rhs(tex, unit)
    match = STANDARD.fullmatch(rhs)
    if not match:
        parse_answer(rhs)  # unreadable text raises ValueError here; readable text is the wrong form
        raise AssertionError(f"{rhs!r} is not written as a times 10 to the power k")
    sign, mantissa, power = match.groups()
    a = Rational(mantissa)
    if not (1 <= a < 10):
        raise AssertionError(f"front number {mantissa} is not in [1, 10)")
    if relation == "\\approx":
        check_rounded(f"$x \\approx {rhs}$", truth, sf=sf)
        return
    value = (-1 if sign else 1) * a * TEN ** int(power)
    if simplify(value - truth) != 0:
        raise AssertionError(f"published {value} is not {truth}")


def value_is(tex, truth):
    """An exact value: a plain decimal is read exactly; anything else through parse_answer."""
    _, rhs = relation_and_rhs(tex)
    rhs = rhs.replace(" ", "")
    published = Rational(rhs) if PLAIN_DECIMAL.fullmatch(rhs) else parse_answer(rhs)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def word_is(text, truth):
    if text.strip() != truth:
        raise AssertionError(f"published {text!r}, truth {truth!r}")


# --- writing ----------------------------------------------------------------------------------------------------------
def compare_size(text):
    p, q = dec("4.1") * TEN**-6, dec("9.7") * TEN**-7
    truth = "$P$" if p > q else ("$Q$" if q > p else "They are equal")
    word_is(text, truth)


# --- calculator answers -------------------------------------------------------------------------------------------------
def gdc_gravity(tex):
    g, m1, m2, d = dec("6.67") * TEN**-11, dec("5.97") * TEN**24, dec("7.35") * TEN**22, dec("3.84") * TEN**8
    standard_form(tex, g * m1 * m2 / d**2, unit="N", sf=3)


def calculator_display(tex):
    # The display 2.04E-7 means 2.04 * 10^(-7); read its value from the display string itself.
    mantissa, power = "2.04E-7".split("E")
    standard_form(tex, dec(mantissa) * TEN ** int(power))


CHECKS = {
    "before-multiply-powers": lambda tex: value_is(tex, TEN**5 * TEN**-2),
    "before-power-of-power": lambda tex: value_is(tex, (TEN**3) ** 4),
    "before-negative-power": lambda tex: value_is(tex, TEN**-3),
    "ex-write-small": lambda tex: standard_form(tex, dec("0.0000306"), unit="g"),
    "ex-fix-form": lambda tex: standard_form(tex, dec("52.8") * TEN**-7),
    "check-write-large": lambda tex: standard_form(tex, Integer(149600000)),
    "check-compare-size": compare_size,
    "ex-multiply": lambda tex: standard_form(tex, dec("7.5") * TEN**6 * 4 * TEN**-9),
    "ex-divide": lambda tex: standard_form(tex, dec("1.2") * TEN**5 / (4 * TEN**-3)),
    "check-multiply-renormalise": lambda tex: standard_form(tex, 8 * TEN**4 * 5 * TEN**-11),
    "ex-crystal-volume": lambda tex: standard_form(tex, (5 * TEN**-4) ** 3, unit="m^3"),
    "check-sqrt-even-power": lambda tex: standard_form(tex, sqrt(dec("8.1") * TEN**7)),
    "ex-add-match-powers": lambda tex: standard_form(tex, dec("4.2") * TEN**5 + dec("3.9") * TEN**4),
    "check-subtract": lambda tex: standard_form(tex, dec("7.3") * TEN**8 - dec("4.5") * TEN**7),
    "ex-gdc-gravity": gdc_gravity,
    "check-calculator-display": calculator_display,
}

NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
