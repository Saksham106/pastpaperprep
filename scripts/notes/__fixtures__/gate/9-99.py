"""Fixture sidecar for the check-math gate tests."""
import sys
from pathlib import Path

from sympy import Rational, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import check_antiderivative  # noqa: E402

x = symbols("x")


def near(value, truth, tol):
    if abs(float(value) - float(truth)) > tol:
        raise AssertionError(f"{value} is not {float(truth)}")


CHECKS = {
    "ex-recip": lambda tex: check_antiderivative(tex, 2 / (2 * x + 1)),
    "check-recip": lambda tex: check_antiderivative(tex, 1 / x),
    "check-root": lambda v: near(v, sqrt(Rational(117, 1000)), 0.0005),
}


def verify(id, value):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value)
