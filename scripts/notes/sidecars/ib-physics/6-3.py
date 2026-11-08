"""Answer checks for IB Physics lesson 6.3 (uncertainties and errors). Not shipped to the browser.

Only answers recorded as a range need a sidecar: no verify kind reads "value \\pm uncertainty unit", such as
$I = 0.34 \\pm \\pu{0.01 A}$. CHECKS[id] gives, from the question's own data:
  value  the measured or processed value (an expression of exact decimals with + - * / ** and brackets)
  unc    its absolute uncertainty (an expression; the name `value` may be used, for a propagated relative uncertainty)
  sf     the significant figures the lesson asks for in the uncertainty (1)
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
import mathparse  # noqa: E402

CHECKS = {
    # analogue ammeter marked every 0.02 A; needle exactly on the 0.34 A mark
    "ex-ammeter-reading": {"value": "0.34", "unc": "0.02 / 2", "sf": 1, "unit": "A"},
    # five stopwatch times 2.43, 2.38, 2.46, 2.40, 2.44 s: mean +/- half the range
    "ex-ramp-times": {"value": "(2.43 + 2.38 + 2.46 + 2.40 + 2.44) / 5", "unc": "(2.46 - 2.38) / 2", "sf": 1, "unit": "s"},
    # mean length 15.264 cm with absolute uncertainty 0.03 cm
    "check-record-length": {"value": "15.264", "unc": "0.03", "sf": 1, "unit": "cm"},
    # spring length 18.4 +/- 0.1 cm stretched, 12.7 +/- 0.1 cm unstretched
    "check-extension-range": {"value": "18.4 - 12.7", "unc": "0.1 + 0.1", "sf": 1, "unit": "cm"},
    # R = V / I with V = 4.5 +/- 0.1 V and I = 0.30 +/- 0.01 A
    "ex-resistance-range": {"value": "4.5 / 0.30", "unc": "value * (0.1 / 4.5 + 0.01 / 0.30)", "sf": 1, "unit": "\\Omega"},
    # E = 1/2 m v^2 with m = 0.600 +/- 0.006 kg and v = 2.5 +/- 0.1 m s-1
    "ex-kinetic-energy-range": {"value": "0.5 * 0.600 * 2.5**2", "unc": "value * (0.006 / 0.600 + 2 * 0.1 / 2.5)", "sf": 1, "unit": "J"},
}

_NUMBER = r"(\d+(?:\.\d+)?)"
_RANGE = re.compile(r"^\s*" + _NUMBER + r"\s*\\pm\s*" + _NUMBER + r"\s*(.*?)\s*$")


def _exact(source, value=None):
    """An exact Fraction from an expression of decimals, + - * / ** and brackets, and the name `value`."""
    if re.search(r"[^\s()0-9./*+\-]", re.sub(r"\bvalue\b", "", source)):
        raise ValueError(f"unexpected text in {source!r}")
    text = re.sub(r"(?<![\w.])(\d+(?:\.\d+)?)", r"Fraction('\1')", source)
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
