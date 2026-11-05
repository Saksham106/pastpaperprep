"""SymPy assertions for IGCSE Maths 0580 lesson 1.1 (types of number; placeholder lesson). Not shipped to the browser.

Same contract as the AA sidecars: check-math.py passes verify(id, value) the lesson's own published text, and a
numeric check gets verify(id, value, tolerance=...) with its precision declared in NUMERIC.
"""
import sys
from pathlib import Path

from sympy import Integer, gcd, lcm, simplify

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import parse_answer  # noqa: E402


def value_is(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def exact_numeric(value, truth, tolerance=None):
    if Integer(round(float(value))) != truth or float(value) != float(truth):
        raise AssertionError(f"published {value} is not {truth}")
    if tolerance is not None and float(tolerance) != 0:
        raise AssertionError(f"an exact whole-number answer needs tolerance 0, not {tolerance}")


CHECKS = {
    "ex-hcf": lambda tex: value_is(tex, gcd(24, 36)),
    "check-lcm": lambda value, tolerance=None: exact_numeric(value, lcm(6, 8), tolerance),
}

NUMERIC = {"check-lcm": {"sf": 2}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
