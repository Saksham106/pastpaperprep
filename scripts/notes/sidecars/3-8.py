"""SymPy assertions for lesson 3.8 (trigonometric equations). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

How the truths are built. Every equation here is, after an identity, a product of factors P(g(a x + b)) where g is sin,
cos or tan and P is a polynomial. For each equation the sidecar
  1. checks at 12 random points (to 40 digits) that the original equation's expression equals the factorised form,
     so the factorisation is an identity and loses or adds no solution;
  2. solves each polynomial P(u) = 0 with SymPy, keeps the real roots (and only |u| <= 1 for sin and cos);
  3. lists every angle with that sine, cosine or tangent (asin/acos/atan plus the symmetric angle, plus whole periods),
     converts the angle a x + b back to x and keeps the values inside the closed or open interval;
  4. substitutes every value back into the ORIGINAL equation and asserts it is exactly 0.
So no final answer is typed in. SymPy's solveset is not used: on [0, pi] it misses pi - atan(1/3) for
3tan^2 x - 5tan x - 2 = 0. The one equation with no algebraic method (3 sin x = x + 1) is solved with nsolve from
sign changes on a fine grid, after checking |f| stays well away from 0 elsewhere, so no touching root is missed.
"""
import random
import re
import sys
from pathlib import Path

from sympy import (
    N, Rational, acos, asin, atan, cos, expand_trig, nsolve, pi, simplify, sin, solve, sqrt, symbols, tan,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, check_rounded_list, parse_answer, parse_degrees  # noqa: E402

x, u = symbols("x u", real=True)
DEG = pi / 180


# ------------------------------------------------------------------------------------------------ truth machinery

def identical(f, g, lo, hi):
    """f and g agree at 12 random points of the interval (40-digit evaluation): the factorisation is an identity."""
    rng = random.Random(38)
    for _ in range(12):
        point = Rational(rng.randint(1, 10**6), 10**6) * (hi - lo) + lo
        if abs(N((f - g).subs(x, point), 40)) > 1e-30:
            raise RuntimeError(f"factorised form is not identical to {f}")


def angles_for(g, value, lo, hi):
    """Every angle theta in [lo - 2pi, hi + 2pi] (radians, exact) with g(theta) = value."""
    if g is tan:
        bases, period = [atan(value)], pi
    elif g is sin:
        bases, period = [asin(value), pi - asin(value)], 2 * pi
    else:
        bases, period = [acos(value), -acos(value)], 2 * pi
    found = []
    for base in bases:
        for k in range(-40, 41):
            theta = base + k * period
            if N(lo) - 7 <= N(theta) <= N(hi) + 7:
                found.append(theta)
    return found


def solutions(original, factors, lo, hi, c=1, open_ends=False):
    """Every x in the interval with original(x) = 0.

    `factors` is a list of (g, inner, P): original == c * prod P(g(inner)), with P a polynomial in u. The interval is
    [lo, hi] (or ]lo, hi[ when open_ends). Returns the exact solutions in increasing order.
    """
    product = c
    for g, inner, poly in factors:
        product *= poly.subs(u, g(inner))
    identical(original, product, lo, hi)
    found = []
    for g, inner, poly in factors:
        a = (inner - inner.subs(x, 0)) / x
        b = inner.subs(x, 0)
        for root in solve(poly, u):
            if not root.is_real:
                continue
            if g is not tan and abs(N(root)) > 1:
                continue
            for theta in angles_for(g, root, a * lo + b if a > 0 else a * hi + b, a * hi + b if a > 0 else a * lo + b):
                value = simplify((theta - b) / a)
                inside = (lo < value < hi) if open_ends else (lo <= value <= hi)
                if bool(inside) and all(simplify(value - other) != 0 for other in found):
                    found.append(value)
    for value in found:
        if simplify(original.subs(x, value)) != 0:
            raise RuntimeError(f"{value} does not satisfy {original} = 0")
    return sorted(found, key=lambda v: float(N(v)))


# ------------------------------------------------------------------------------------------------ reading answers

def published_values(tex, degrees=False):
    """Each value in `x = a \\text{ or } x = b ...` (one value is fine too), read exactly, in degrees if asked."""
    pieces = re.split(r"\\text\{\s*or\s*\}", tex.strip().strip("$"))
    values = []
    for piece in pieces:
        if not piece.strip():
            raise ValueError(f"empty answer in {tex!r}")
        values.append(parse_degrees(piece) if degrees else parse_answer(piece))
    return values


def same_list(tex, truth, degrees=False):
    published = sorted(published_values(tex, degrees), key=lambda v: float(N(v)))
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def same_mixed_list(tex, truth, sf=3):
    """`x = 0 \\text{ or } x \\approx 1.32 ...`: exact pieces must equal their truth exactly; pieces written with
    \\approx must be that truth rounded half-up to `sf` figures. Values are paired in increasing order."""
    pieces = re.split(r"\\text\{\s*or\s*\}", tex.strip().strip("$"))
    if any(not piece.strip() for piece in pieces):
        raise ValueError(f"empty answer in {tex!r}")
    if len(pieces) != len(truth):
        raise AssertionError(f"{tex!r} gives {len(pieces)} value(s), {len(truth)} expected")
    def size(piece):
        rhs = re.split(r"\\approx|=", piece)[-1]
        return float(N(parse_answer(rhs)))
    for piece, value in zip(sorted(pieces, key=size), truth):
        if "\\approx" in piece:
            check_rounded(piece, value, sf=sf)
        elif simplify(parse_answer(piece) - value) != 0:
            raise AssertionError(f"{piece!r} is not exactly {value}")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def in_degrees(values):
    return [simplify(v / DEG) for v in values]


# ------------------------------------------------------------------------------------------------ the equations

def ex_sin_neg_root2():
    """sqrt(2) sin x + 1 = 0, 0 <= x <= 2pi."""
    f = sqrt(2) * sin(x) + 1
    return solutions(f, [(sin, x, sqrt(2) * u + 1)], 0, 2 * pi)


def ex_tan_degrees():
    """sqrt(3) sin x + cos x = 0, -180 <= x <= 360 degrees. Dividing by cos x is safe: cos x = 0 gives sin x = +-1, and
    then sqrt(3) sin x + cos x = +-sqrt(3) is not 0. Checked below at the two zeros of cos x in the interval and -90."""
    f = sqrt(3) * sin(x) + cos(x)
    for zero in (-pi / 2, pi / 2, 3 * pi / 2):
        assert simplify(f.subs(x, zero)) != 0
    # On the interval with cos x != 0, f = cos x * (sqrt(3) tan x + 1): solve the tan factor, then confirm in f.
    found = solutions(sqrt(3) * tan(x) + 1, [(tan, x, sqrt(3) * u + 1)], -pi, 2 * pi)
    for value in found:
        assert simplify(f.subs(x, value)) == 0
    return in_degrees(found)


def check_cos_half():
    """2 cos x + 1 = 0, 0 <= x <= 2pi."""
    return solutions(2 * cos(x) + 1, [(cos, x, 2 * u + 1)], 0, 2 * pi)


def check_sin_larger():
    """4 sin x = 3, 0 <= x <= pi: the larger solution."""
    return solutions(4 * sin(x) - 3, [(sin, x, 4 * u - 3)], 0, pi)[-1]


def ex_count_solutions():
    """4 sin x = 1, 0 <= x <= 3pi: how many solutions."""
    return len(solutions(4 * sin(x) - 1, [(sin, x, 4 * u - 1)], 0, 3 * pi))


def check_count_tan():
    """tan x = 2, 0 <= x <= 3pi: how many solutions (tan is undefined at pi/2, 3pi/2, 5pi/2, which are not roots)."""
    return len(solutions(tan(x) - 2, [(tan, x, u - 2)], 0, 3 * pi))


def gdc_roots(f, lo, hi, steps=4000):
    """Roots of f on [lo, hi] from sign changes on a fine grid, refined with nsolve to 30 digits. Away from the roots
    |f| stays above 1e-3 on the grid, so f has no touching root that a sign-change search could miss."""
    lo_f, hi_f = float(N(lo)), float(N(hi))
    grid = [lo_f + (hi_f - lo_f) * i / steps for i in range(steps + 1)]
    values = [float(N(f.subs(x, p))) for p in grid]
    roots = []
    for left, right, fl, fr in zip(grid, grid[1:], values, values[1:]):
        if fl == 0 or fl * fr < 0:
            roots.append(nsolve(f, x, (left + right) / 2, prec=30))
    for p, v in zip(grid, values):
        if all(abs(p - float(r)) > 0.05 for r in roots):
            assert abs(v) > 1e-3, f"possible touching root near {p}"
    return roots


def ex_gdc_intersect():
    """3 sin x = x + 1, 0 <= x <= 2pi."""
    return gdc_roots(3 * sin(x) - x - 1, 0, 2 * pi)


def check_gdc_cos():
    """2 cos x = x, 0 <= x <= 2pi (one root)."""
    roots = gdc_roots(2 * cos(x) - x, 0, 2 * pi)
    assert len(roots) == 1
    return roots[0]


def ex_sin_2x():
    """2 sin 2x = sqrt(3), 0 <= x <= 2pi."""
    return solutions(2 * sin(2 * x) - sqrt(3), [(sin, 2 * x, 2 * u - sqrt(3))], 0, 2 * pi)


def ex_cos_shift_degrees():
    """2 cos(x + 40 degrees) = 1, 0 <= x <= 360 degrees. Work in radians, then convert."""
    inner = x + 40 * DEG
    found = solutions(2 * cos(inner) - 1, [(cos, inner, 2 * u - 1)], 0, 2 * pi)
    return in_degrees(found)


def check_tan_3x():
    """tan 3x = 1, 0 <= x <= pi."""
    return solutions(tan(3 * x) - 1, [(tan, 3 * x, u - 1)], 0, pi)


def check_ferris():
    """h(t) = 14 - 11 cos(pi t / 12) = 20, 0 <= t <= 24: the first time. (x plays the role of t.)"""
    inner = pi * x / 12
    found = solutions(14 - 11 * cos(inner) - 20, [(cos, inner, -11 * u - 6)], 0, 24)
    return found[0]


def ex_quad_cos():
    """2cos^2 x + 3cos x + 1 = 0, 0 <= x <= 2pi."""
    f = 2 * cos(x) ** 2 + 3 * cos(x) + 1
    return solutions(f, [(cos, x, 2 * u**2 + 3 * u + 1)], 0, 2 * pi)


def ex_quad_pythag():
    """cos^2 x = sin x + 1, 0 <= x <= 2pi. Original expression cos^2 x - sin x - 1 equals -(sin^2 x + sin x)."""
    f = cos(x) ** 2 - sin(x) - 1
    return solutions(f, [(sin, x, u**2 + u)], 0, 2 * pi, c=-1)


def ex_double_angle():
    """cos 2x = 4 sin x - 1, 0 <= x <= 2pi. cos 2x - 4 sin x + 1 = -2(sin^2 x + 2 sin x - 1)."""
    f = cos(2 * x) - 4 * sin(x) + 1
    return solutions(f, [(sin, x, u**2 + 2 * u - 1)], 0, 2 * pi, c=-2)


def check_cos2x_cos():
    """cos 2x + cos x = 0, 0 <= x <= 2pi. cos 2x + cos x = 2cos^2 x + cos x - 1."""
    f = cos(2 * x) + cos(x)
    return solutions(f, [(cos, x, 2 * u**2 + u - 1)], 0, 2 * pi)


def check_sin2x_factor():
    """2 sin 2x = sin x, 0 <= x <= 2pi. 2 sin 2x - sin x = sin x (4 cos x - 1)."""
    f = 2 * sin(2 * x) - sin(x)
    return solutions(f, [(sin, x, u), (cos, x, 4 * u - 1)], 0, 2 * pi)


def check_tan_quadratic():
    """3tan^2 x - 5tan x - 2 = 0, 0 <= x <= pi: the larger solution."""
    f = 3 * tan(x) ** 2 - 5 * tan(x) - 2
    return solutions(f, [(tan, x, 3 * u**2 - 5 * u - 2)], 0, pi)[-1]


def before_quadratic():
    """2u^2 - u - 3 = 0, solved by SymPy."""
    return sorted(solve(2 * u**2 - u - 3, u))


def before_cos_double(tex):
    """The option must equal cos 2x for every x: compared at 12 sample points (40 digits) and by expand_trig."""
    published = parse_answer(tex)
    (letter,) = published.free_symbols  # the parser's own x
    difference = expand_trig(published - cos(2 * letter))
    rng = random.Random(8)
    worst = max(abs(N(difference.subs(letter, Rational(rng.randint(-10**6, 10**6), 10**5)), 40)) for _ in range(12))
    if simplify(difference) != 0 or worst > 1e-30:
        raise AssertionError(f"{published} is not cos 2x")


CHECKS = {
    "before-exact-cos": lambda tex: same(tex, cos(5 * pi / 6)),
    "before-quadratic": lambda tex: same_list(tex, before_quadratic()),
    "before-cos-double": before_cos_double,
    "ex-sin-neg-root2": lambda tex: same_list(tex, ex_sin_neg_root2()),
    "ex-tan-degrees": lambda tex: same_list(tex, ex_tan_degrees(), degrees=True),
    "check-cos-half": lambda tex: same_list(tex, check_cos_half()),
    "check-sin-larger": lambda v, tolerance: check_numeric(v, check_sin_larger(), sf=3, tolerance=tolerance),
    "ex-count-solutions": lambda tex: same(tex, ex_count_solutions()),
    "ex-gdc-intersect": lambda tex: check_rounded_list(tex, ex_gdc_intersect(), sf=3),
    "check-count-tan": lambda tex: same(tex, check_count_tan()),
    "check-gdc-cos": lambda v, tolerance: check_numeric(v, check_gdc_cos(), sf=3, tolerance=tolerance),
    "ex-sin-2x": lambda tex: same_list(tex, ex_sin_2x()),
    "ex-cos-shift-degrees": lambda tex: same_list(tex, ex_cos_shift_degrees(), degrees=True),
    "check-tan-3x": lambda tex: same_list(tex, check_tan_3x()),
    "check-ferris": lambda v, tolerance: check_numeric(v, check_ferris(), sf=3, tolerance=tolerance),
    "ex-quad-cos": lambda tex: same_list(tex, ex_quad_cos()),
    "ex-quad-pythag": lambda tex: same_list(tex, ex_quad_pythag()),
    "ex-double-angle": lambda tex: check_rounded_list(tex, ex_double_angle(), sf=3),
    "check-cos2x-cos": lambda tex: same_list(tex, check_cos2x_cos()),
    "check-sin2x-factor": lambda tex: same_mixed_list(tex, check_sin2x_factor()),
    "check-tan-quadratic": lambda v, tolerance: check_numeric(v, check_tan_quadratic(), sf=3, tolerance=tolerance),
}

NUMERIC = {
    "check-sin-larger": {"sf": 3},
    "check-gdc-cos": {"sf": 3},
    "check-ferris": {"sf": 3},
    "check-tan-quadratic": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)


if __name__ == "__main__":
    for name, fn in [
        ("ex_sin_neg_root2", ex_sin_neg_root2), ("ex_tan_degrees", ex_tan_degrees), ("check_cos_half", check_cos_half),
        ("check_sin_larger", check_sin_larger), ("ex_count_solutions", ex_count_solutions),
        ("check_count_tan", check_count_tan), ("ex_gdc_intersect", ex_gdc_intersect), ("check_gdc_cos", check_gdc_cos),
        ("ex_sin_2x", ex_sin_2x), ("ex_cos_shift_degrees", ex_cos_shift_degrees), ("check_tan_3x", check_tan_3x),
        ("check_ferris", check_ferris), ("ex_quad_cos", ex_quad_cos), ("ex_quad_pythag", ex_quad_pythag),
        ("ex_double_angle", ex_double_angle), ("check_cos2x_cos", check_cos2x_cos),
        ("check_sin2x_factor", check_sin2x_factor),
        ("check_tan_quadratic", check_tan_quadratic), ("before_quadratic", before_quadratic),
    ]:
        result = fn()
        shown = [N(v, 8) for v in result] if isinstance(result, list) else N(result, 8)
        print(name, result, shown)
