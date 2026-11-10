"""SymPy assertions for IB Maths AI lesson 5.18 (second-order differential equations). Not shipped to the browser.

Why a sidecar: the buoy example runs Euler's method for 10 and 20 steps on a forced equation (a 2cos t term), so the
recurrence can't be written as a matrix power, and a declarative truth allows no loops. Here the coupled recurrence
x_{n+1} = x_n + h y_n, y_{n+1} = y_n + h f(x_n, y_n, t_n) is run from the question's own equation, starting values,
step length and number of steps (cos evaluated to 30 digits), and the published answer is compared after rounding.
Only the ids in CHECKS come here; every other block uses its own `verify` block.
"""
import sys
from pathlib import Path

from sympy import Rational, cos

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import _strip_decorations, check_numeric, check_rounded  # noqa: E402

R = Rational


def euler_second_order(f, t0, x0, y0, h, steps):
    """(t, x, y) after `steps` Euler steps for d2x/dt2 = f(x, y, t), written as dx/dt = y, dy/dt = f(x, y, t).
    Both new values come from the old row."""
    t, x, y = R(t0), R(x0), R(y0)
    for _ in range(steps):
        x, y, t = x + h * y, (y + h * f(x, y, t)).evalf(30), t + h
    return t, x, y


def named_rounded(tex, truths, sf=3):
    """`x \\approx 0.305, \\; y \\approx -0.381`: each named value rounded to sf, every name present once."""
    body = _strip_decorations(tex).replace("\\;", " ").replace("\\,", " ")
    pieces = [piece.strip() for piece in body.split(",") if piece.strip()]
    names = [piece.split("\\approx")[0].strip() for piece in pieces]
    if sorted(names) != sorted(truths):
        raise AssertionError(f"{tex!r} names {names}, expected {sorted(truths)}")
    for piece, name in zip(pieces, names):
        check_rounded(piece, truths[name], sf=sf)


# ex-buoy-gdc: d2x/dt2 + 0.6 dx/dt + 5x = 2cos t, so f(x, y, t) = 2cos t - 5x - 0.6y; x = 0.5, y = 0 at t = 0.
def buoy(x, y, t):
    return 2 * cos(t) - 5 * x - R(6, 10) * y


# h = 0.1, ten steps to t = 1.
BUOY_T, BUOY_X, BUOY_Y = euler_second_order(buoy, 0, R(1, 2), 0, R(1, 10), 10)
# check-buoy-half-step: h = 0.05, twenty steps to t = 1.
HALF_T, HALF_X, HALF_Y = euler_second_order(buoy, 0, R(1, 2), 0, R(1, 20), 20)
assert BUOY_T == 1 and HALF_T == 1

CHECKS = {
    "ex-buoy-gdc": lambda tex: named_rounded(tex, {"x": BUOY_X, "y": BUOY_Y}),
    "check-buoy-half-step": lambda v, tolerance: check_numeric(v, HALF_X, sf=3, tolerance=tolerance),
}

NUMERIC = {
    "check-buoy-half-step": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
