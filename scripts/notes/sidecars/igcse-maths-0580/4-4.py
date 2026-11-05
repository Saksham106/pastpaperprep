"""SymPy assertions for 0580 lesson 4.4 (similarity): only the check no verify kind fits. Not shipped to the browser.

`check-rectangle-enlarged` offers rectangles as "a cm by b cm". A rectangle is similar to the 3 cm by 5 cm one exactly
when both sides are multiplied by the same scale factor, so the check reads the two lengths and compares the ratios;
every other option must fail. Everything else in the lesson uses its declarative `verify` block.
"""
import re

from sympy import Rational, nsimplify

ORIGINAL = (Rational(3), Rational(5))


def similar_rectangle(text):
    numbers = [nsimplify(n) for n in re.findall(r"\d+(?:\.\d+)?", text.replace("$", ""))]
    if len(numbers) != 2:
        raise ValueError(f"expected two side lengths in {text!r}")
    k = numbers[0] / ORIGINAL[0]
    if k <= 0 or numbers[1] != k * ORIGINAL[1]:
        raise AssertionError(f"{text!r} is not the 3 cm by 5 cm rectangle scaled by one factor")


CHECKS = {"check-rectangle-enlarged": similar_rectangle}


def verify(check_id, value):
    if check_id not in CHECKS:
        raise KeyError(check_id)
    return CHECKS[check_id](value)
