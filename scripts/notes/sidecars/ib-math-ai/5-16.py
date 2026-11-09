"""SymPy assertions for IB Maths AI lesson 5.16 (Euler's method). Not shipped to the browser.

Why a sidecar: an Euler estimate is a recurrence run for several steps. A declarative truth allows no loops, lambdas
or comprehensions, so a 6- or 8-step estimate would have to be written out as one deeply nested expression. Here the
recurrence is run exactly, in Rationals, from each question's own equation, starting point, step length and number of
steps, and the published answer is compared after rounding half-up. Only the ids in CHECKS come here; every other
block uses its own `verify` block.
"""
import sys
from pathlib import Path

from sympy import Rational, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import _strip_decorations, check_numeric, check_rounded  # noqa: E402

R = Rational


def euler(f, x0, y0, h, steps):
    """y after `steps` Euler steps of length h for dy/dx = f(x, y) from (x0, y0)."""
    x, y = R(x0), R(y0)
    for _ in range(steps):
        y, x = y + h * f(x, y), x + h
    return y


def euler_coupled(f1, f2, x0, y0, t0, h, steps):
    """Every row (t, x, y) of Euler's method for dx/dt = f1(x, y, t), dy/dt = f2(x, y, t): both new values from the old row."""
    t, x, y = R(t0), R(x0), R(y0)
    rows = [(t, x, y)]
    for _ in range(steps):
        x, y, t = x + h * f1(x, y, t), y + h * f2(x, y, t), t + h
        rows.append((t, x, y))
    return rows


def named_rounded(tex, truths, sf=3):
    """`R \\approx 55.9, \\; F \\approx 13.6`: each named value rounded to sf, every name present once."""
    body = _strip_decorations(tex).replace("\\;", " ").replace("\\,", " ")
    pieces = [piece.strip() for piece in body.split(",") if piece.strip()]
    names = [piece.split("\\approx")[0].strip() for piece in pieces]
    if sorted(names) != sorted(truths):
        raise AssertionError(f"{tex!r} names {names}, expected {sorted(truths)}")
    for piece, name in zip(pieces, names):
        check_rounded(piece, truths[name], sf=sf)


# ex-cooling-coffee: dT/dt = -0.08(T - 21), T(0) = 85, h = 1, three steps to t = 3.
COFFEE = euler(lambda t, T: -R(8, 100) * (T - 21), 0, 85, 1, 3)
# ex-fish-spreadsheet: dP/dt = 0.6P(1 - P/800), P(0) = 100, h = 0.5, six steps to t = 3.
FISH = euler(lambda t, P: R(6, 10) * P * (1 - P / 800), 0, 100, R(1, 2), 6)
# ex-gdc-step-sizes: dy/dx = 0.5x + sqrt(y), y(2) = 1, h = 0.2, five steps to x = 3.
ROOT = euler(lambda x, y: x / 2 + sqrt(y), 2, 1, R(1, 5), 5)
# check-euler-gdc: dy/dx = x / (y + 1), y(0) = 1, h = 0.25, eight steps to x = 2.
QUOTIENT = euler(lambda x, y: x / (y + 1), 0, 1, R(1, 4), 8)


# ex-rabbits-foxes and check-rabbit-max: dR/dt = 0.9R - 0.05RF, dF/dt = 0.02RF - 0.6F, R = 40, F = 10 at t = 0, h = 0.25.
def _rabbit_rows(steps):
    return euler_coupled(lambda r, f, t: R(9, 10) * r - R(5, 100) * r * f,
                         lambda r, f, t: R(2, 100) * r * f - R(6, 10) * f, 40, 10, 0, R(1, 4), steps)


ONE_YEAR = _rabbit_rows(4)[-1]
RABBIT_MAX = max(row[1] for row in _rabbit_rows(8))

CHECKS = {
    "ex-cooling-coffee": lambda tex: check_rounded(tex, COFFEE, sf=3),
    "ex-fish-spreadsheet": lambda tex: check_rounded(tex, FISH, sf=3),
    "ex-gdc-step-sizes": lambda tex: check_rounded(tex, ROOT, sf=3),
    "check-euler-gdc": lambda v, tolerance: check_numeric(v, QUOTIENT, sf=3, tolerance=tolerance),
    "ex-rabbits-foxes": lambda tex: named_rounded(tex, {"R": ONE_YEAR[1], "F": ONE_YEAR[2]}),
    "check-rabbit-max": lambda v, tolerance: check_numeric(v, RABBIT_MAX, sf=3, tolerance=tolerance),
}

NUMERIC = {
    "check-euler-gdc": {"sf": 3},
    "check-rabbit-max": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
