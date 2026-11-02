"""SymPy assertions for lesson 5.9 (kinematics). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is built from the question's own s(t), v(t) or a(t): velocity and acceleration with sympy.diff, positions
with sympy.integrate plus a solved constant, displacement as a definite integral of v, and distance by finding every
zero of v in the interval (exactly for polynomials, by bracketed sign changes and nsolve otherwise) and adding the sizes
of the exact integrals over the pieces. Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Abs, Eq, Interval, lambdify, Rational, S, Symbol, cos, diff, integrate, nsolve, oo, pi, simplify, sin, solve, solveset, symbols,
)
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_set, parse_answer, parse_list, parse_with_unit,
)

t = symbols("t")
C = symbols("C")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_with_unit(tex, unit, truth):
    """An exact answer that carries a unit, such as `\\text{distance} = 13\\text{ m}`."""
    same(parse_with_unit(tex, unit), truth)


def labelled_pair(tex, checks):
    """Two labelled answers split at `, \\;`, such as `\\text{displacement} = ... \\text{ m}, \\; \\text{distance} = ...`.
    `checks` maps each label to the assertion for its piece; a missing, extra or swapped label fails."""
    pieces = re.split(r",\s*\\;\s*", tex.strip().strip("$").strip())
    labels = []
    for piece in pieces:
        match = re.match(r"\\text\{\s*([a-z]+)\s*\}", piece.strip())
        if not match:
            raise ValueError(f"piece {piece!r} of {tex!r} has no \\text{{label}}")
        labels.append(match.group(1))
    if sorted(labels) != sorted(checks):
        raise AssertionError(f"{tex!r} gives {labels}, expected {sorted(checks)}")
    for label, piece in zip(labels, pieces):
        checks[label](piece)


def roots_are(tex, truths):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truths = sorted(truths, key=lambda r: float(r))
    if len(published) != len(truths) or any(simplify(p - q) != 0 for p, q in zip(published, truths)):
        raise AssertionError(f"published {published}, truth {truths}")


def rest_times(s, lo=0, hi=oo):
    """Times in [lo, hi] when v = ds/dt = 0."""
    return sorted(solveset(diff(s, t), t, Interval(lo, hi)), key=lambda r: float(r))


def through(rate, t0, value):
    """The antiderivative of `rate` (plus C) that equals `value` at t0, with C solved for."""
    family = integrate(rate, t) + C
    (constant,) = solve(Eq(family.subs(t, t0), value), C)
    result = family.subs(C, constant)
    assert simplify(diff(result, t) - rate) == 0 and simplify(result.subs(t, t0) - value) == 0
    return result


def zeros_inside(v, a, b):
    """Every time strictly inside ]a, b[ where v = 0: exact for a polynomial, else each bracketed sign change refined
    by nsolve. Asserts that each zero found is a real sign change or touch (|v| tiny there)."""
    if v.is_polynomial(t):
        return sorted((r for r in solve(v, t) if r.is_real and a < r < b), key=lambda r: float(r))
    steps = 4000
    grid = [a + (b - a) * Rational(k, steps) for k in range(steps + 1)]
    numeric = lambdify(t, v, "math")
    values = [numeric(float(g)) for g in grid]
    found = []
    for left, right, f_left, f_right in zip(grid, grid[1:], values, values[1:]):
        if f_left == 0 and left != a:
            found.append(S(left))
        elif f_left * f_right < 0:
            root = nsolve(v, t, ((left + right) / 2).evalf(30), prec=50)
            assert left <= root <= right and abs(v.subs(t, root)) < 1e-40
            found.append(root)
    return found


def distance(v, a, b):
    """Total distance from t = a to t = b: the sizes of the integrals of v between consecutive zeros, added."""
    F = integrate(v, t)
    cuts = [S(a)] + zeros_inside(v, a, b) + [S(b)]
    return sum(Abs(F.subs(t, right) - F.subs(t, left)) for left, right in zip(cuts, cuts[1:]))


def speeding_set_check(tex, v):
    """Speeding up: t >= 0 with v and a = dv/dt of the same sign, i.e. v * a > 0."""
    real_t = Symbol("t", real=True)
    truth = solve_univariate_inequality((v * diff(v, t)).subs(t, real_t) > 0, real_t, relational=False)
    check_same_set(tex, truth.intersect(Interval(0, oo)), var="t")


# Word answer for check-change-direction: each option names one state at t = 3; the truth is computed from v.
MOTION_OPTIONS = {
    "it is at rest for an instant, then keeps moving in the positive direction": ("rest", "same", 1),
    "it is at rest for an instant, then moves in the negative direction": ("rest", "turns", -1),
    "it is not at rest: it is moving in the positive direction": ("moving", None, 1),
}


def motion_at(v, t0):
    """(state, turn, direction after t0) from the sign of v just either side of t0, inside a gap with no other zero."""
    others = [abs(r - t0) for r in solve(v, t) if r.is_real and r != t0]
    h = min(others + [S(1)]) / 4
    before, after = v.subs(t, t0 - h), v.subs(t, t0 + h)
    direction = 1 if after > 0 else -1
    if v.subs(t, t0) != 0:
        return ("moving", None, direction)
    return ("rest", "turns" if before * after < 0 else "same", direction)


def motion_check(text, v, t0):
    key = text.strip().strip("$").strip().lower()
    if key not in MOTION_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    published, truth = MOTION_OPTIONS[key], motion_at(v, t0)
    if published != truth:
        raise AssertionError(f"option {text!r} says {published}, truth is {truth}")


S_REST = 2 * t**3 - 15 * t**2 + 24 * t
S_SINE = 6 * sin(pi * t / 3)
S_CHECK_V = t**3 - 4 * t**2 + 5
S_CHECK_A = t**3 - 9 * t**2 + 15 * t
V_SPEED = t**2 - 6 * t + 5
V_GDC = 4 * cos(Rational(6, 5) * t) + Rational(1, 2) * t


def accel_at_first_rest():
    first = rest_times(S_SINE, 0, 6)[0]
    return diff(S_SINE, t, 2).subs(t, first)


def accel_at_last_rest():
    last = rest_times(S_CHECK_A)[-1]
    return diff(S_CHECK_A, t, 2).subs(t, last)


CHECKS = {
    # Before you start (5.5, 5.6)
    "before-chain-rule": lambda tex: same(tex, diff(5 * sin(3 * t), t)),
    "before-boundary-condition": lambda tex: same(tex, through(6 * t - 2, 1, 5)),
    "before-definite-integral": lambda tex: same(tex, integrate(3 * t**2 + 1, (t, 0, 2))),
    # Displacement, velocity and acceleration
    "ex-rest-times": lambda tex: roots_are(tex, rest_times(S_REST)),
    "check-velocity-at-time": lambda tex: same(tex, diff(S_CHECK_V, t).subs(t, 3)),
    "ex-accel-first-rest": lambda tex: same_with_unit(tex, "m s^-2", accel_at_first_rest()),
    "check-accel-at-rest": lambda v, tolerance: check_numeric(v, accel_at_last_rest(), sf=3, tolerance=tolerance),
    # Speed and direction
    "ex-speed-value": lambda tex: same_with_unit(tex, "m s^-1", Abs(V_SPEED.subs(t, 2))),
    "ex-speeding-up": lambda tex: speeding_set_check(tex, V_SPEED),
    "check-speed-radians": lambda v, tolerance: check_numeric(v, Abs(3 * cos(2 * t)).subs(t, 1), sf=3, tolerance=tolerance),
    "check-change-direction": lambda text: motion_check(text, t**3 - 6 * t**2 + 9 * t, 3),
    # Displacement from velocity
    "ex-position-from-velocity": lambda tex: same(tex, through(6 * t**2 - 4 * t, 1, 3)),
    "check-velocity-from-accel": lambda v, tolerance: check_numeric(v, through(6 * t, 0, 2).subs(t, 2), sf=3, tolerance=tolerance),
    "ex-displacement-linear": lambda tex: same_with_unit(tex, "m", integrate(8 - 2 * t, (t, 1, 6))),
    "check-displacement-zero": lambda tex: same(tex, integrate(3 * t**2 - 6 * t, (t, 0, 3))),
    # Total distance travelled
    "ex-distance-quadratic": lambda tex: labelled_pair(tex, {
        "displacement": lambda piece: same_with_unit(piece, "m", integrate(t**2 - 4 * t + 3, (t, 0, 4))),
        "distance": lambda piece: same_with_unit(piece, "m", distance(t**2 - 4 * t + 3, 0, 4)),
    }),
    "check-distance-linear": lambda tex: same(tex, distance(2 * t - 4, 0, 5)),
    "ex-distance-gdc": lambda tex: labelled_pair(tex, {
        "displacement": lambda piece: check_rounded(piece, integrate(V_GDC, (t, 0, 5)), sf=3, unit="m"),
        "distance": lambda piece: check_rounded(piece, distance(V_GDC, 0, 5), sf=3, unit="m"),
    }),
    "check-distance-gdc": lambda v, tolerance: check_numeric(v, distance(2 * sin(2 * t), 0, 2), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check: 3 s.f. (the two exact integers 12 and 14 are the same at 3 s.f.).
NUMERIC = {
    "check-accel-at-rest": {"sf": 3},
    "check-speed-radians": {"sf": 3},
    "check-velocity-from-accel": {"sf": 3},
    "check-distance-gdc": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
