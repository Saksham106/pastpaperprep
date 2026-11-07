"""Answer checks for IB Chemistry lesson 7.2 (uncertainties, errors and significant figures). Not shipped to the browser.

Only answers recorded as a range need a sidecar: no verify kind reads "value \\pm uncertainty unit", such as
$V = 12.35 \\pm \\pu{0.05 cm3}$. CHECKS[id] gives, from the question's own data:
  value  the measured or processed value (an expression of exact decimals; the booklet helpers Mr() and Ar() are allowed)
  unc    its absolute uncertainty (an expression; the name `value` may be used, for a relative uncertainty)
  sf     the significant figures the lesson asks for in the uncertainty (1, or 2 for a burette titre's +/-0.10)
  unit   the unit, compared after mathparse._normal_unit
The published text must read <value> \\pm <uncertainty> <unit> after the last "=" or "\\approx". The uncertainty must
show exactly `sf` figures and equal the true uncertainty rounded half-up; the value must end at the same decimal place
as the uncertainty and equal the true value rounded there; the unit must match. Any mismatch is an AssertionError (so
a readable wrong range can stand as a distractor); unreadable text is a ValueError.
Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import chem_data  # noqa: E402
import mathparse  # noqa: E402

CHECKS = {
    # burette marked every 0.1 cm3; meniscus exactly halfway between the 12.3 and 12.4 marks
    "ex-burette-reading": {"value": "(12.3 + 12.4) / 2", "unc": "0.1 / 2", "sf": 1, "unit": "cm3"},
    # titre from readings 0.85 and 24.30 cm3, each +/-0.05 cm3
    "ex-titre-range": {"value": "24.30 - 0.85", "unc": "0.05 + 0.05", "sf": 2, "unit": "cm3"},
    # 1.325 +/- 0.001 g of Na2CO3 made up to 250.0 +/- 0.2 cm3
    "ex-standard-solution": {
        "value": "1.325 / Mr('Na2CO3') / (250.0 / 1000)",
        "unc": "value * (0.001 / 1.325 + 0.2 / 250.0)",
        "sf": 1,
        "unit": "mol dm-3",
    },
    # titre from readings 3.20 and 27.65 cm3, each +/-0.05 cm3
    "check-titre-range": {"value": "27.65 - 3.20", "unc": "0.05 + 0.05", "sf": 2, "unit": "cm3"},
}

_NUMBER = r"(\d+(?:\.\d+)?)"
_RANGE = re.compile(r"^\s*" + _NUMBER + r"\s*\\pm\s*" + _NUMBER + r"\s*(.*?)\s*$")


def _exact(source, value=None):
    """An exact Fraction from an expression of decimals, + - * / and brackets, Mr('...') and Ar('...')."""
    def helper(match):
        name, arg = match.group(1), match.group(2)
        return f"Fraction('{(chem_data.Mr if name == 'Mr' else chem_data.Ar)(arg)}')"

    if re.search(r"[^\s()'0-9./*+\-]", re.sub(r"\b(?:Mr|Ar)\('[A-Za-z0-9()]+'\)|\bvalue\b", "", source)):
        raise ValueError(f"unexpected text in {source!r}")
    text = re.sub(r"(?<![\w'.])(\d+(?:\.\d+)?)", r"Fraction('\1')", source)
    text = re.sub(r"\b(Mr|Ar)\('([^']+)'\)", helper, text)
    return eval(text, {"__builtins__": {}}, {"Fraction": Fraction, "value": value})  # noqa: S307 - text checked above


def _decimal(fraction):
    return Decimal(fraction.numerator) / Decimal(fraction.denominator)


def _round_sf(fraction, sf):
    value = _decimal(fraction)
    return value.quantize(Decimal(1).scaleb(value.adjusted() - sf + 1), rounding=ROUND_HALF_UP)


def _places(text):
    return len(text.split(".")[1]) if "." in text else 0


def published(text):
    """(value text, uncertainty text, normalised unit) of a range answer."""
    cleaned = mathparse._strip_decorations(str(text))
    cuts = mathparse._top_level_cuts(cleaned, r"\\approx|=")
    rhs = cleaned[cuts[-1][1]:] if cuts else cleaned
    match = _RANGE.match(rhs)
    if not match:
        raise ValueError(f"{text!r} is not written as value \\pm uncertainty unit")
    value, unc, unit = match.groups()
    return value, unc, mathparse._normal_unit(unit) if unit else ""


def verify(id_, text, tolerance=None):
    spec = CHECKS[id_]
    true_value = _exact(spec["value"])
    true_unc = _exact(spec["unc"], true_value)
    value, unc, unit = published(text)
    if unit != mathparse._normal_unit(spec["unit"]):
        raise AssertionError(f"{text!r} has unit {unit!r}, expected {mathparse._normal_unit(spec['unit'])!r}")
    figures = len(unc.replace(".", "").lstrip("0"))
    if figures != spec["sf"]:
        raise AssertionError(f"{text!r}: the uncertainty shows {figures} significant figures, {spec['sf']} expected")
    if Decimal(unc) != _round_sf(true_unc, spec["sf"]):
        raise AssertionError(f"{text!r}: the uncertainty is {_round_sf(true_unc, spec['sf'])}, not {unc}")
    if _places(value) != _places(unc):
        raise AssertionError(f"{text!r}: the value must end at the same decimal place as its uncertainty")
    expected = _decimal(true_value).quantize(Decimal(1).scaleb(-_places(unc)), rounding=ROUND_HALF_UP)
    if Decimal(value) != expected:
        raise AssertionError(f"{text!r}: the value is {expected}, not {value}")
