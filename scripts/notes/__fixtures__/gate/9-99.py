"""Fixture sidecar for the check-math gate tests."""
import sys
from pathlib import Path

from sympy import Rational, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import check_antiderivative, check_numeric  # noqa: E402

x = symbols("x")


CHECKS = {
    "ex-recip": lambda tex: check_antiderivative(tex, 2 / (2 * x + 1)),
    "check-recip": lambda tex: check_antiderivative(tex, 1 / x),
    "check-root": lambda v, tolerance: check_numeric(v, sqrt(Rational(117, 1000)), sf=3, tolerance=tolerance),
}

# Required precision of each numeric check: the gate holds the tolerance to half a unit in that place.
NUMERIC = {"check-root": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
