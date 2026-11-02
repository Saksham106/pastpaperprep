"""SymPy assertions for lesson 5.14 (Implicit differentiation, related rates and optimisation). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

How the truths are computed, independently of the lesson's working:
- implicit gradients: dy/dx = -F_x / F_y for the curve F(x, y) = 0 (partial derivatives), checked at points that are
  first shown to lie on the curve;
- related rates: the linking equation is written with x(t), y(t) as SymPy functions of t, differentiated with respect to
  t, and solved for the unknown rate;
- optimisation: every critical point in the allowed interval plus both end points, compared by value;
- highest points of implicit curves: solve F = 0 together with F_x = 0 (a horizontal tangent), keeping points with
  F_y != 0.
"""
import sys
from pathlib import Path

from sympy import Function, Interval, Rational, S, diff, oo, pi, simplify, sin, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded, check_same_equation, parse_answer, parse_list, parse_point,
    parse_with_unit,
)

x, y, t = symbols("x y t")  # plain symbols, as mathparse returns


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def roots_are(tex, expr):
    published = sorted(parse_list(tex), key=lambda r: float(r))
    truth = sorted(solve(expr, x), key=lambda r: float(r))
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def implicit_dydx(F):
    """dy/dx on the curve F(x, y) = 0, from the partial derivatives."""
    return simplify(-diff(F, x) / diff(F, y))


def on_curve(F, px, py):
    if simplify(F.subs({x: px, y: py})) != 0:
        raise AssertionError(f"({px}, {py}) is not on {F} = 0")


def gradient_at(F, px, py):
    on_curve(F, px, py)
    return implicit_dydx(F).subs({x: px, y: py})


# ------------------------------------------------------------------------------------------- implicit differentiation

def ellipse_gradient(tex):
    F = x**2 + 4 * y**2 - 20
    # Part (a) of the example states dy/dx = -x/(4y); confirm it before checking part (b), the published answer.
    if simplify(implicit_dydx(F) - (-x / (4 * y))) != 0:
        raise AssertionError("part (a): dy/dx is not -x/(4y)")
    same(tex, gradient_at(F, 2, 2))


def tangent_equation(tex):
    F = x**2 * y + y**3 - 2 * x - 8
    m = gradient_at(F, 1, 2)
    check_same_equation(tex, y - 2 - m * (x - 1))


# ------------------------------------------------------------------------------------------------------ related rates

X, Y, R, V, H = (Function(name)(t) for name in ("X", "Y", "R", "V", "H"))


def rate_from(link, unknown_rate, known):
    """Differentiate `link` (= 0 at all times) with respect to t, solve for unknown_rate, substitute `known`."""
    derivative = diff(link, t)
    solutions = solve(derivative, unknown_rate)
    if len(solutions) != 1:
        raise AssertionError(f"expected one solution for {unknown_rate}, got {solutions}")
    value = solutions[0]
    # Substitute derivatives before the functions themselves, so X(t) inside Derivative(X(t), t) is not replaced first.
    for key in sorted(known, key=lambda k: 0 if k.is_Derivative else 1):
        value = value.subs(key, known[key])
    return simplify(value)


def balloon(tex):
    link = V - Rational(4, 3) * pi * R**3
    truth = rate_from(link, diff(R, t), {diff(V, t): 100, R: 5})
    same(parse_with_unit(tex, "cm s^-1"), truth)


def ice_cube(tex):
    # Volume falls by 24 cm^3 per minute, so dV/dt = -24.
    link = V - X**3
    same(tex, rate_from(link, diff(X, t), {diff(V, t): -24, X: 2}))


def ladder(tex):
    link = X**2 + Y**2 - 13**2
    height = sqrt(13**2 - 5**2)
    truth = rate_from(link, diff(Y, t), {diff(X, t): Rational(1, 2), X: 5, Y: height})
    same(parse_with_unit(tex, "m s^-1"), truth)


def cars(value, tolerance):
    # B east (X = 60, dX/dt = 20), A north (Y = 80, dY/dt = 15); s = sqrt(X^2 + Y^2).
    s = sqrt(X**2 + Y**2)
    rate = diff(s, t)
    for key, val in ((diff(X, t), 20), (diff(Y, t), 15), (X, 60), (Y, 80)):
        rate = rate.subs(key, val)
    check_numeric(value, rate, sf=3, tolerance=tolerance)


def cone(tex):
    h = symbols("h", positive=True)
    radius = Rational(10, 25) * h  # similar triangles
    volume = Rational(1, 3) * pi * radius**2 * h
    # Part (a): V = 4*pi*h^3/75.
    if simplify(volume - 4 * pi * h**3 / 75) != 0:
        raise AssertionError("part (a): V is not 4 pi h^3 / 75")
    depths = [d for d in solve(volume - 300, h) if d.is_real and 0 < d <= 25]
    if len(depths) != 1:
        raise AssertionError(f"expected one depth for V = 300, got {depths}")
    link = V - volume.subs(h, H)
    truth = rate_from(link, diff(H, t), {diff(V, t): 15, H: depths[0]})
    check_rounded(tex, truth, sf=3, unit="cm s^-1")


# ------------------------------------------------------------------------------------------------------- optimisation

def extreme_on(f, interval, kind):
    """(x, f(x)) at the greatest (kind='max') or least value of f on the interval: critical points and finite ends."""
    candidates = [c for c in solve(diff(f, x), x) if c.is_real and interval.contains(c)]
    for end in (interval.start, interval.end):
        if end.is_finite and interval.contains(end):
            candidates.append(end)
    pairs = [(c, simplify(f.subs(x, c))) for c in candidates]
    chooser = max if kind == "max" else min
    return chooser(pairs, key=lambda p: float(p[1]))


def closest_point(tex):
    D = sqrt((x - 4) ** 2 + (sqrt(x) - 0) ** 2)
    same(tex, extreme_on(D, Interval(0, oo), "min")[1])


def distance_parabola(value, tolerance):
    D = sqrt((x - 0) ** 2 + (x**2 - 3) ** 2)
    check_numeric(value, extreme_on(D, S.Reals, "min")[1], sf=3, tolerance=tolerance)


def boat(tex):
    # Row B -> Q: hypotenuse of legs 3 and x at 4 km/h; walk Q -> H: 3 - x at 5 km/h.
    T = sqrt(3**2 + x**2) / 4 + (3 - x) / 5
    best_x, best_T = extreme_on(T, Interval(0, 3), "min")
    # The time carries its unit (hours): parse_with_unit requires it and strips it before the values are compared.
    check_assignments(parse_with_unit(tex, "h"), {"x": best_x, "T": best_T})


def endpoint_max(tex):
    g = sqrt(x**2 - 6 * x + 13)
    same(tex, extreme_on(g, Interval(0, 5), "max")[1])


def rectangle(tex):
    # Corner (x, y) on x^2 + 4y^2 = 32 in the first quadrant; area 4xy with y = sqrt(32 - x^2)/2.
    upper_y = solve(x**2 + 4 * y**2 - 32, y)
    y_pos = [r for r in upper_y if r.subs(x, 1) > 0][0]
    area = 4 * x * y_pos
    same(tex, extreme_on(area, Interval(0, sqrt(32)), "max")[1])


def horizontal_tangent_points(F):
    """Points of F = 0 with a horizontal tangent: F_x = 0 there and F_y != 0."""
    points = solve([F, diff(F, x)], [x, y], dict=True)
    return [(p[x], p[y]) for p in points if p[x].is_real and p[y].is_real and simplify(diff(F, y).subs(p)) != 0]


def highest_point(F):
    return max(horizontal_tangent_points(F), key=lambda p: float(p[1]))


def implicit_highest(tex):
    published = parse_point(tex)
    truth = highest_point(x**2 + x * y + y**2 - 12)
    if len(published) != 2 or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published} is not {truth}")


def implicit_greatest_y(value, tolerance):
    check_numeric(value, highest_point(x**2 - 2 * x * y + 3 * y**2 - 18)[1], sf=3, tolerance=tolerance)


CHECKS = {
    "before-chain-rule": lambda tex: same(tex, diff((3 * x**2 + 1) ** 5, x)),
    "before-product-rule": lambda tex: same(tex, diff(x**2 * sin(x), x)),
    "before-stationary": lambda tex: roots_are(tex, diff(x**3 - 6 * x**2 + 9 * x + 4, x)),
    "ex-implicit-ellipse": ellipse_gradient,
    "check-implicit-basic": lambda tex: same(tex, implicit_dydx(y**3 + 3 * y - x**2 - 4 * x)),
    "ex-implicit-tangent": tangent_equation,
    "check-implicit-gradient": lambda v, tolerance: check_numeric(
        v, gradient_at(x**2 - 3 * x * y + y**3 - 5, 4, 1), sf=3, tolerance=tolerance
    ),
    "ex-rates-balloon": balloon,
    "check-rates-cube": ice_cube,
    "ex-rates-ladder": ladder,
    "check-rates-cars": cars,
    "ex-rates-cone-gdc": cone,
    "ex-opt-closest-point": closest_point,
    "check-distance-parabola": distance_parabola,
    "ex-opt-endpoint-boat": boat,
    "check-endpoint-max": endpoint_max,
    "ex-implicit-highest": implicit_highest,
    "check-implicit-greatest-y": implicit_greatest_y,
    "ex-implicit-rectangle": rectangle,
}

NUMERIC = {
    "check-implicit-gradient": {"sf": 3},
    "check-rates-cars": {"sf": 3},
    "check-distance-parabola": {"sf": 3},
    "check-implicit-greatest-y": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
