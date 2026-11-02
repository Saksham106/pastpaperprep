"""SymPy assertions for lesson 3.9 (reciprocal and inverse trigonometric functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

How the truths are built.
  * Exact values: SymPy evaluates the question's own expression (sec(5 pi/4), acos(cos(7 pi/4)), sec(atan 4), ...).
  * "Find one ratio from another, given the quadrant": the angle itself is built from the given ratio and the given
    interval (for example cos theta = -1/3 in ]pi, 3pi/2[ gives theta = 2 pi - acos(-1/3)); the sidecar asserts the angle
    is inside the interval and has the given ratio, then evaluates the asked ratio at that angle.
  * Identities ("show that"): the published right-hand side must equal the question's left-hand side, by simplify or,
    if simplify can't close it, at 12 random points to 40 digits.
  * Equations: each equation is rewritten as a polynomial P in one ratio g (sin, cos or cot); the rewrite is checked
    as an identity at random points, P is solved, every angle with that ratio is listed, the ones inside the interval
    are kept and each is substituted back into the ORIGINAL equation. SymPy's solveset must agree.
  * Domains and ranges: continuous_domain / function_range of the question's own function.
  * GDC questions: nsolve to 30 digits, after checking that the difference changes sign exactly once on the domain.
"""
import random
import sys
from pathlib import Path

from sympy import (
    Interval, N, Rational, S, acos, asin, atan, cos, cot, csc, exp, nsolve, pi, sec, simplify, sin, solve, solveset,
    sqrt, symbols, tan,
)
from sympy.calculus.util import continuous_domain, function_range

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, check_same_set, parse_answer, parse_list  # noqa: E402

x = symbols("x", real=True)
u = symbols("u")


# ------------------------------------------------------------------------------------------------ helpers

def identical(f, g, lo=Rational(1, 10), hi=Rational(3, 2)):
    """True when f and g agree at 12 random points of [lo, hi], evaluated to 40 digits."""
    rng = random.Random(39)
    for _ in range(12):
        point = lo + (hi - lo) * Rational(rng.randint(1, 10**6), 10**6)
        if abs(N((f - g).subs(x, point), 40)) > 1e-30:
            return False
    return True


def same(tex, truth):
    """One exact value or expression. The published text's x is a plain symbol: line it up with our real x."""
    published = parse_answer(tex)
    published = published.subs({s: x for s in published.free_symbols if s.name == "x"})
    if simplify(published - truth) == 0:
        return
    if published.free_symbols and identical(published, truth):
        return
    raise AssertionError(f"published {published} is not {truth}")


def angle_in(value_of_ratio, ratio, lo, hi, theta):
    """theta must lie strictly inside ]lo, hi[ and have the given ratio; return it."""
    if not (N(lo) < N(theta) < N(hi)):
        raise RuntimeError(f"angle {theta} is not inside ]{lo}, {hi}[")
    if simplify(ratio(theta) - value_of_ratio) != 0:
        raise RuntimeError(f"{ratio}({theta}) is not {value_of_ratio}")
    return theta


def angles_for(g, value, lo, hi):
    """Every exact angle within [lo - 7, hi + 7] with g(angle) = value, for g in sin, cos, cot."""
    if g is sin:
        bases, period = [asin(value), pi - asin(value)], 2 * pi
    elif g is cos:
        bases, period = [acos(value), -acos(value)], 2 * pi
    elif g is cot:
        bases, period = [pi / 2 if value == 0 else atan(1 / value)], pi
    else:
        raise RuntimeError(f"no angle rule for {g}")
    found = []
    for base in bases:
        for k in range(-6, 7):
            theta = simplify(base + k * period)
            if N(lo) - 7 <= N(theta) <= N(hi) + 7:
                found.append(theta)
    return found


def equation_roots(original, g, poly, lo, hi, open_ends=False):
    """Every x in the interval with original(x) = 0, where original == poly(g(x)) wherever both are defined."""
    if not identical(original, poly.subs(u, g(x))):
        raise RuntimeError(f"{original} is not {poly} in {g}(x)")
    roots = set()
    for root in solve(poly, u):
        if not root.is_real or (g in (sin, cos) and abs(N(root)) > 1):
            continue
        for theta in angles_for(g, root, lo, hi):
            inside = (N(lo) < N(theta) < N(hi)) if open_ends else (N(lo) - 1e-20 <= N(theta) <= N(hi) + 1e-20)
            if inside:
                if simplify(original.subs(x, theta)) != 0:
                    raise RuntimeError(f"{theta} does not satisfy {original}")
                roots.add(theta)
    roots = sorted(roots, key=lambda r: float(N(r)))
    interval = Interval(lo, hi, left_open=open_ends, right_open=open_ends)
    if set(solveset(original, x, interval)) != set(roots):
        raise RuntimeError(f"solveset disagrees with {roots}")
    return roots


def roots_are(tex, truth):
    published = sorted(parse_list(tex), key=lambda r: float(N(r)))
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def gdc_root(difference, lo, hi, guess):
    """The single root of difference(x) on ]lo, hi[: one sign change on a fine grid, then nsolve to 30 digits."""
    grid = [lo + (hi - lo) * Rational(i, 400) for i in range(1, 400)]
    values = [N(difference.subs(x, p), 30) for p in grid]
    changes = sum(1 for a, b in zip(values, values[1:]) if a * b < 0)
    if changes != 1:
        raise RuntimeError(f"{difference} changes sign {changes} times on ]{lo}, {hi}[")
    root = nsolve(difference, x, guess, prec=30)
    if not (lo < root < hi) or abs(difference.subs(x, root)) > 1e-25:
        raise RuntimeError(f"nsolve root {root} is not valid")
    return root


# ------------------------------------------------------------------------------------------------ truths

# before-pyth-cos: cos theta = -1/4 with pi/2 < theta < pi. acos(-1/4) is that angle.
THETA_COS = angle_in(Rational(-1, 4), cos, pi / 2, pi, acos(Rational(-1, 4)))

# ex-ident-sec-tan: sec theta = -3, so cos theta = -1/3, with pi < theta < 3pi/2.
THETA_SEC = angle_in(-3, sec, pi, 3 * pi / 2, 2 * pi - acos(Rational(-1, 3)))

# check-ident-cosec: cot theta = 3, so tan theta = 1/3, with pi < theta < 3pi/2.
THETA_COT = angle_in(3, cot, pi, 3 * pi / 2, pi + atan(Rational(1, 3)))

ROOTS_SOLVE_SIN = equation_roots(2 * sin(x) + sqrt(3), sin, 2 * u + sqrt(3), 0, 2 * pi)
# tan^2 x - sec x - 1 = 0. Times cos^2 x (never 0 at a root, since cos x = 0 makes the original undefined):
# sin^2 x - cos x - cos^2 x = 1 - cos x - 2cos^2 x. Divide back by cos^2 x to compare with the original.
ROOTS_SEC = equation_roots(tan(x) ** 2 - sec(x) - 1, cos, (1 - u - 2 * u**2) / u**2, 0, 2 * pi)
ROOTS_COT = equation_roots(csc(x) ** 2 - 1 - sqrt(3) * cot(x), cot, u**2 - sqrt(3) * u, 0, 2 * pi, open_ends=True)

GDC_ARCCOS = gdc_root(acos(x) - 2 * x, -1, 1, Rational(1, 2))
GDC_ARCSIN = gdc_root(asin(x) - (1 - x), -1, 1, Rational(1, 2))


CHECKS = {
    "before-pyth-cos": lambda tex: same(tex, sin(THETA_COS)),
    "before-inverse-domain": lambda tex: check_same_set(tex, function_range(2 + exp(x), x, S.Reals)),
    "before-solve-sin": lambda tex: roots_are(tex, ROOTS_SOLVE_SIN),
    "ex-recip-sec-exact": lambda tex: same(tex, sec(5 * pi / 4)),
    "check-recip-cot-exact": lambda tex: same(tex, cot(5 * pi / 3)),
    "ex-recip-show": lambda tex: same(tex, (tan(x) + cot(x)) / sec(x)),
    "check-recip-gdc": lambda v, tolerance: check_numeric(v, csc(Rational(5, 2)), sf=3, tolerance=tolerance),
    "ex-ident-sec-tan": lambda tex: same(tex, tan(THETA_SEC)),
    "check-ident-cosec": lambda tex: same(tex, csc(THETA_COT)),
    "ex-ident-show-sec4": lambda tex: same(tex, sec(x) ** 4 - tan(x) ** 4),
    "ex-ident-solve": lambda tex: roots_are(tex, ROOTS_SEC),
    "check-ident-solve-cot": lambda tex: roots_are(tex, ROOTS_COT),
    "ex-inv-arccos-exact": lambda tex: same(tex, acos(-sqrt(3) / 2)),
    "check-inv-arctan-exact": lambda tex: same(tex, atan(-sqrt(3))),
    "ex-inv-arccos-cos": lambda tex: same(tex, acos(cos(7 * pi / 4))),
    "check-inv-sec-arctan": lambda tex: same(tex, sec(atan(4))),
    "ex-graph-domain": lambda tex: check_same_set(tex, continuous_domain(asin(3 - 2 * x), x, S.Reals)),
    "ex-graph-range": lambda tex: check_same_set(tex, function_range(2 * acos(x) - pi, x, Interval(-1, 1)), var="y"),
    "check-graph-range-arctan": lambda tex: check_same_set(tex, function_range(pi - 2 * atan(x), x, S.Reals), var="y"),
    "ex-graph-gdc": lambda tex: check_rounded(tex, GDC_ARCCOS, sf=3),
    "check-graph-gdc": lambda v, tolerance: check_numeric(v, GDC_ARCSIN, sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-recip-gdc": {"sf": 3}, "check-graph-gdc": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
