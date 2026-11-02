"""SymPy assertions for lesson 5.17 (areas and volumes of revolution). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data. Areas against the y-axis are built from x as a function of
y (found by solving the curve for x) and split wherever the curve crosses the y-axis. Volumes about the y-axis are also
computed a second, independent way (cylindrical shells, 2*pi*integral of x*height dx), and the two must agree.
"""
import sys
from pathlib import Path

from sympy import Abs, Integral, Interval, Rational, exp, integrate, log, pi, simplify, solve, solveset, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

x = symbols("x", real=True)
y = symbols("y", real=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def area_to_y_axis(x_of_y, lo, hi):
    """Area between x = x_of_y and the y-axis for lo <= y <= hi: split at every crossing inside, add the sizes."""
    cuts = sorted({lo, hi, *[r for r in solveset(x_of_y, y, Interval(lo, hi)) if lo < r < hi]}, key=float)
    return sum(Abs(integrate(x_of_y, (y, a, b))) for a, b in zip(cuts, cuts[1:]))


def enclosed_by_y_axis(x_of_y):
    """Region enclosed by x = x_of_y and the y-axis: the limits are where x = 0 (exactly two crossings)."""
    roots = sorted(solveset(x_of_y, y, Interval(-100, 100)), key=float)
    assert len(roots) == 2, roots
    return area_to_y_axis(x_of_y, roots[0], roots[1])


def x_from(curve, branch_test):
    """Solve y = curve(x) for x and keep the one branch that passes branch_test (a point inside the region)."""
    branches = [b for b in solve(curve - y, x) if branch_test(b)]
    assert len(branches) == 1, branches
    return branches[0]


def before_between():
    """Area enclosed by y = 2x and y = x^2: meeting points solved, top curve found from a test point."""
    a, b = sorted(solve(2 * x - x**2, x))
    gap = 2 * x - x**2
    top_minus_bottom = gap if gap.subs(x, (a + b) / 2) > 0 else -gap
    return integrate(top_minus_bottom, (x, a, b))


def yarea_ln():
    """y = ln x, y-axis, x-axis (y = 0), y = 2. x = e^y from solving; cross-check with x-strips:
    the 2 by e^2 rectangle minus the area under ln x from 1 to e^2."""
    x_of_y = x_from(log(x), lambda b: True)
    by_y = area_to_y_axis(x_of_y, 0, 2)
    width = exp(2)
    by_x = 2 * width - integrate(log(x), (x, 1, width))
    assert simplify(by_y - by_x) == 0
    return by_y


def yarea_cube():
    """y = x^3, y-axis, y = 8: x = y^(1/3), the real branch (x = 1 at y = 1)."""
    x_of_y = x_from(x**3, lambda b: b.subs(y, 1) == 1)
    return area_to_y_axis(x_of_y, 0, 8)


def vol_x(outer, a, b, inner=0):
    """Volume about the x-axis: pi * integral of (outer^2 - inner^2) dx."""
    return pi * integrate(outer**2 - inner**2, (x, a, b))


def volx_cone():
    """y = x/2, 0 <= x <= 6 about the x-axis; must also match the cone formula (1/3) pi r^2 h with r = 3, h = 6."""
    v = vol_x(x / 2, 0, 6)
    assert simplify(v - Rational(1, 3) * pi * 3**2 * 6) == 0
    return v


def volx_washer():
    """Region between y = 2x and y = x^2 about the x-axis: meeting points solved; outer radius from a test point."""
    a, b = sorted(solve(2 * x - x**2, x))
    mid = (a + b) / 2
    outer, inner = (2 * x, x**2) if (2 * x).subs(x, mid) > (x**2).subs(x, mid) else (x**2, 2 * x)
    assert inner.subs(x, mid) >= 0
    return vol_x(outer, a, b, inner)


def volx_washer_check():
    """Region between y = 4 - x^2 and y = 3 about the x-axis (outer 4 - x^2, inner 3 between the meeting points)."""
    a, b = sorted(solve(4 - x**2 - 3, x))
    assert (4 - x**2).subs(x, (a + b) / 2) > 3
    return vol_x(4 - x**2, a, b, 3)


def volx_gdc():
    """y = ln(x^2 + 1) from 0 (its only root) to 2 about the x-axis, evaluated numerically to 30 digits."""
    assert solve(log(x**2 + 1), x) == [0]
    return (pi * Integral(log(x**2 + 1) ** 2, (x, 0, 2))).evalf(30)


def vol_y(x_squared, lo, hi):
    """Volume about the y-axis: pi * integral of x^2 dy."""
    return pi * integrate(x_squared, (y, lo, hi))


def voly_parabola():
    """y = x^2, y-axis, y = 4 (x >= 0) about the y-axis. Shells cross-check: 2 pi * integral_0^2 x (4 - x^2) dx."""
    branch = x_from(x**2, lambda b: b.subs(y, 1) > 0)
    discs = vol_y(branch**2, 0, 4)
    shells = 2 * pi * integrate(x * (4 - x**2), (x, 0, 2))
    assert simplify(discs - shells) == 0
    return discs


def voly_branch():
    """y = (x - 2)^2 and both axes (0 <= x <= 2) about the y-axis: the branch with x <= 2 (x = 1 at y = 1).
    Shells cross-check: 2 pi * integral_0^2 x (x - 2)^2 dx."""
    branch = x_from((x - 2) ** 2, lambda b: b.subs(y, 1) == 1)
    discs = vol_y(branch**2, 0, 4)
    shells = 2 * pi * integrate(x * (x - 2) ** 2, (x, 0, 2))
    assert simplify(discs - shells) == 0
    return discs


def voly_hole():
    """Region under y = x^3 from x = 0 to 2 about the y-axis: cylinder (r = 2, h = 8) minus the hole
    pi * integral_0^8 x^2 dy. Shells cross-check: 2 pi * integral_0^2 x * x^3 dx."""
    branch = x_from(x**3, lambda b: b.subs(y, 1) == 1)
    cylinder_minus_hole = pi * 2**2 * 8 - vol_y(branch**2, 0, 8)
    shells = 2 * pi * integrate(x * x**3, (x, 0, 2))
    assert simplify(cylinder_minus_hole - shells) == 0
    return shells


def voly_hole_limits():
    """Region under y = sqrt(x) for 1 <= x <= 4 about the y-axis: a hole with its own y-limits.
    Discs: cylinder (r = 4, up to the curve's height at x = 4) minus the radius-1 cylinder up to the curve's height
    at x = 1, minus pi * integral of x^2 dy for the curve part between those heights (x = y^2 solved, not typed).
    Shells cross-check: 2 pi * integral_1^4 x sqrt(x) dx."""
    curve = sqrt(x)
    low, top = curve.subs(x, 1), curve.subs(x, 4)
    branch = x_from(curve, lambda b: True)
    discs = pi * 4**2 * top - pi * 1**2 * low - vol_y(branch**2, low, top)
    shells = 2 * pi * integrate(x * curve, (x, 1, 4))
    assert simplify(discs - shells) == 0
    return shells


def voly_dish():
    """y = x^4 / 4, y-axis, y = 4 about the y-axis: the branch with x = 2 at y = 4.
    Shells cross-check: 2 pi * integral_0^2 x (4 - x^4/4) dx."""
    branch = x_from(x**4 / 4, lambda b: b.subs(y, 4) == 2)
    discs = vol_y(branch**2, 0, 4)
    shells = 2 * pi * integrate(x * (4 - x**4 / 4), (x, 0, 2))
    assert simplify(discs - shells) == 0
    return discs


CHECKS = {
    # Before you start (5.11)
    "before-area-x": lambda tex: same(tex, integrate(3 * x - x**2, (x, 0, 3))),
    "before-between": lambda tex: same(tex, before_between()),
    # Area between a curve and the y-axis
    "ex-yarea-quadratic": lambda tex: same(tex, enclosed_by_y_axis(4 * y - y**2)),
    "ex-yarea-ln": lambda tex: same(tex, yarea_ln()),
    "check-yarea-cube": lambda tex: same(tex, yarea_cube()),
    "check-yarea-left": lambda tex: same(tex, enclosed_by_y_axis(2 * y**2 - 4 * y)),
    # Volume about the x-axis
    "ex-volx-cone": lambda tex: same(tex, volx_cone()),
    "check-volx-recip": lambda tex: same(tex, vol_x(2 / x, 1, 4)),
    "ex-volx-washer": lambda tex: same(tex, volx_washer()),
    "check-volx-washer": lambda tex: same(tex, volx_washer_check()),
    "ex-volx-gdc": lambda tex: check_rounded(tex, volx_gdc(), sf=3),
    # Volume about the y-axis
    "ex-voly-parabola": lambda tex: same(tex, voly_parabola()),
    "ex-voly-branch": lambda tex: same(tex, voly_branch()),
    "ex-voly-hole-limits": lambda tex: same(tex, voly_hole_limits()),
    "check-voly-hole": lambda tex: same(tex, voly_hole()),
    "check-voly-dish": lambda v, tolerance: check_numeric(v, voly_dish(), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-voly-dish": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
