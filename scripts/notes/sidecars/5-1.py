"""SymPy assertions for lesson 5.1 (limits and the derivative as a rate of change). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import sys
from pathlib import Path

from sympy import Rational, Symbol, diff, exp, limit, pi, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer, parse_with_unit  # noqa: E402

x, h, t = symbols("x h t")
r = Symbol("r", positive=True)
side = Symbol("s", positive=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def two_sided_limit(expr, var, point):
    """The limit from each side, computed separately; they must agree for the limit to exist."""
    left = limit(expr, var, point, dir="-")
    right = limit(expr, var, point, dir="+")
    assert simplify(left - right) == 0, f"one-sided limits differ: {left}, {right}"
    return left


def gradient_at(f, point):
    """Gradient of the curve as the limit of chord gradients (f(a+h) - f(a)) / h as h -> 0."""
    return two_sided_limit((f.subs(x, point + h) - f.subs(x, point)) / h, h, 0)


def line_gradient(eq):
    """Gradient of the line eq = 0, from solving for y and differentiating."""
    y = Symbol("y")
    return diff(solve(eq, y)[0], x)


def cube_volume_rate(tex):
    """V = s^3, dV/ds when V = 64: solve for the edge first, then evaluate dV/ds. Unit must be cm^3 per cm."""
    edge = solve(side**3 - 64, side)
    assert len(edge) == 1
    truth = diff(side**3, side).subs(side, edge[0])
    same(parse_with_unit(tex, "cm^3 per cm"), truth)


def circle_area_rate(tex):
    """A = pi r^2, dA/dr when A = 25 pi: solve for r > 0 first."""
    radius = solve(pi * r**2 - 25 * pi, r)
    assert len(radius) == 1
    same(tex, diff(pi * r**2, r).subs(r, radius[0]))


def cooling_rate(tex):
    """T = 20 + 60 e^(-0.1 t): dT/dt at t = 5, to 3 s.f., in degrees Celsius per minute."""
    temperature = 20 + 60 * exp(-Rational(1, 10) * t)
    check_rounded(tex, diff(temperature, t).subs(t, 5), sf=3, unit="°C per minute")


CHECKS = {
    "before-gradient-two-points": lambda tex: same(tex, Rational(12 - 3, 4 - 1)),
    "before-general-form-gradient": lambda tex: same(tex, line_gradient(3 * x + 2 * Symbol("y") - 8)),
    # The figure's f is x + 2 except at x = 2 (where f(2) = 1); the limit depends only on nearby values.
    "check-limit-graph": lambda tex: same(tex, two_sided_limit(x + 2, x, 2)),
    "ex-limit-table": lambda tex: same(tex, two_sided_limit((x**3 - 1) / (x - 1), x, 1)),
    "ex-limit-gdc": lambda tex: check_rounded(tex, two_sided_limit((2**h - 1) / h, h, 0), sf=3),
    "check-limit-sqrt": lambda v, tolerance: check_numeric(v, two_sided_limit((sqrt(x) - 2) / (x - 4), x, 4), sf=3, tolerance=tolerance),
    "ex-chord-square": lambda tex: same(tex, gradient_at(x**2, 3)),
    "check-chord-gradient": lambda v, tolerance: check_numeric(
        v, ((x**2).subs(x, Rational(3, 2)) - (x**2).subs(x, 1)) / (Rational(3, 2) - 1), sf=3, tolerance=tolerance),
    "ex-chord-cube": lambda tex: same(tex, gradient_at(x**3, 2)),
    "check-tangent-estimate": lambda tex: same(tex, gradient_at(x**2 + x, 2)),
    # Gradient function of y = x^3: the chord-gradient limit at a general point x.
    "check-gradient-function": lambda tex: same(tex, simplify(limit(((x + h)**3 - x**3) / h, h, 0))),
    "ex-cube-volume-rate": cube_volume_rate,
    "check-circle-area-rate": circle_area_rate,
    "ex-cooling-gdc": cooling_rate,
    "check-population-rate": lambda v, tolerance: check_numeric(
        v, diff(500 * Rational(104, 100)**t, t).subs(t, 10), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "check-limit-sqrt": {"sf": 3},
    "check-chord-gradient": {"sf": 3},
    "check-population-rate": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
