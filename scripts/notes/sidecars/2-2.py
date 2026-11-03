"""SymPy assertions for lesson 2.2 (function concepts, domain and range). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed here from each question's own data: SymPy's continuous_domain and function_range give domains and
ranges, solve/nsolve give the input for a given output (that is, the inverse's value), and an inverse rule is found by
solving f(y) = x for y.
"""
import re
import sys
from pathlib import Path

from sympy import (
    EmptySet, Interval, Poly, Rational, S, expand, nsolve, oo, real_roots, simplify, solve, sqrt, symbols,
)
from sympy.calculus.util import continuous_domain, function_range

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_set, parse_answer, parse_point, parse_set, round_half_up,
)

x, y, t, n = symbols("x y t n")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_set(published, truth):
    if published.complement(truth) != EmptySet or truth.complement(published) != EmptySet:
        raise AssertionError(f"published set {published} is not {truth}")


def output_set(tex, name, truth):
    """A range written with the function's output, e.g. `-4 \\le g(x) \\le 5`: read `g(x)` as one unknown y."""
    if name not in tex:
        raise AssertionError(f"{tex!r} does not describe the outputs {name}")
    same_set(parse_set(tex.replace(name, "y"), var="y"), truth)


def domain_and_range(tex, f):
    """ex-domain-range-root: `\\text{domain: } ..., \\quad \\text{range: } ...`; truths from SymPy's domain and range."""
    m = re.fullmatch(r"\$?\\text\{domain: \}(.+?),\s*\\quad\s*\\text\{range: \}(.+?)\$?", tex.strip())
    if not m:
        raise ValueError(f"cannot split {tex!r} into domain and range")
    dom = continuous_domain(f, x, S.Reals)
    check_same_set(m.group(1), dom, var="x")
    output_set(m.group(2), "f(x)", function_range(f, x, dom))


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published} is not {truth}")


def inverse_rule(f):
    """f^{-1}(x): solve f(y) = x for y; a one-to-one f gives exactly one solution."""
    sols = solve(f.subs(x, y) - x, y)
    assert len(sols) == 1
    return sols[0]


def inverse_value(f, k, domain):
    """f^{-1}(k): the unique input in the domain with f(input) = k."""
    sols = [s for s in solve(f - k, x) if s.is_real and domain.contains(s)]
    assert len(sols) == 1, sols
    return sols[0]


# ex-model-ball: h(t) = 1.6 + 11t - 4.9t^2 until it lands.
BALL = Rational(16, 10) + 11 * t - Rational(49, 10) * t**2


def ball_landing():
    land = [r for r in solve(BALL, t) if r.evalf() > 0]
    assert len(land) == 1
    return land[0]


def ball_domain(tex):
    """Part (a): domain 0 <= t <= landing time (the positive root of h), the upper end rounded half-up to 3 s.f."""
    land = ball_landing()
    published = parse_set(tex, var="t")
    if not isinstance(published, Interval):
        raise AssertionError(f"{published} is not one interval")
    rounded = round_half_up(land, sf=3)
    if published.inf != 0 or published.left_open:
        raise AssertionError(f"lower end {published.inf} is not 0")
    if Rational(str(published.sup)) != Rational(str(rounded)) or published.right_open or str(rounded) not in tex:
        raise AssertionError(f"upper end {published.sup} is not the landing time {land} rounded to 3 s.f. ({rounded})")


def ball_range(tex):
    """Part (b): the published range must be 0 <= h(t) <= (maximum height, rounded half-up to 3 s.f.), with the lower
    end exact: the ball reaches height 0 at landing."""
    land = ball_landing()
    # Candidates for the extremes on [0, land]: both ends and every stationary point inside.
    inside = [c for c in solve(BALL.diff(t), t) if 0 < c.evalf() < land.evalf()]
    values = [simplify(BALL.subs(t, c)) for c in [S(0), land, *inside]]
    low = min(values, key=lambda v: v.evalf(30))
    high = max(values, key=lambda v: v.evalf(30))
    if "h(t)" not in tex:
        raise AssertionError(f"{tex!r} does not describe h(t)")
    published = parse_set(tex.replace("h(t)", "y"), var="y")
    if not isinstance(published, Interval):
        raise AssertionError(f"{published} is not one interval")
    rounded = round_half_up(high, sf=3)
    if simplify(published.inf - low) != 0 or published.left_open:
        raise AssertionError(f"lower end {published.inf} is not {low}")
    if Rational(str(published.sup)) != Rational(str(rounded)) or published.right_open or str(rounded) not in tex:
        raise AssertionError(f"upper end {published.sup} is not the maximum {high} rounded to 3 s.f. ({rounded})")


def ball_both(tex):
    """ex-model-ball: `\\text{domain: } ..., \\quad \\text{range: } ...`; both parts checked."""
    m = re.fullmatch(r"\$?\\text\{domain: \}(.+?),\s*\\quad\s*\\text\{range: \}(.+?)\$?", tex.strip())
    if not m:
        raise ValueError(f"cannot split {tex!r} into domain and range")
    ball_domain(m.group(1))
    ball_range(m.group(2))


def cost_both(tex):
    """ex-model-cost: `C(6) = ..., \\; n = ...`; part (a) is C(6), part (b) the n with C(n) = 145."""
    m = re.fullmatch(r"\$?\s*C\(6\)\s*=(.+?),\s*\\;\s*n\s*=(.+?)\$?", tex.strip())
    if not m:
        raise ValueError(f"cannot split {tex!r} into C(6) and n")
    same(m.group(1), cost.subs(n, 6))
    same(m.group(2), solve(cost - 145, n)[0])


def inverse_domain_and_value(tex):
    """ex-inverse-solve: `\\text{domain of } g^{-1}\\text{: } ..., \\quad g^{-1}(10) = ...`. The domain of g^{-1} is the
    range of g = x^2 - 6 on x >= 0; g^{-1}(10) is the input in x >= 0 with g = 10."""
    m = re.fullmatch(
        r"\$?\\text\{domain of \}\s*g\^\{-1\}\\text\{: \}(.+?),\s*\\quad\s*g\^\{-1\}\(10\)\s*=(.+?)\$?", tex.strip()
    )
    if not m:
        raise ValueError(f"cannot split {tex!r} into the domain of g^-1 and g^-1(10)")
    g, dom = x**2 - 6, Interval(0, oo)
    check_same_set(m.group(1), function_range(g, x, dom), var="x")
    same(m.group(2), inverse_value(g, 10, dom))


def f_inverse_20():
    """ex-inverse-gdc: f(x) = x^3 + 2x - 5 is one-to-one; f^{-1}(20) is the only real root of x^3 + 2x - 25."""
    p = x**3 + 2 * x - 5 - 20
    assert len(real_roots(Poly(p, x))) == 1
    return nsolve(p, x, 3, prec=30)


def before_not_real(tex):
    """before-square-root: sqrt(9 - x) is not real exactly when 9 - x < 0."""
    value = parse_answer(tex)
    if not (9 - value < 0):
        raise AssertionError(f"sqrt(9 - {value}) is real")


f_shift = x**2 + 3
f_shift2 = 2 * x**2 - x
cost = 25 + 8 * n
battery = 100 - 6 * t
drone = Rational(1, 2) * t**3 - 6 * t**2 + 18 * t + 2
GIVEN_POINT = (S(-3), S(8))  # check-inverse-reflect: the point on y = f(x)

CHECKS = {
    "before-substitute": lambda v, tolerance: check_numeric(v, (3 * x**2 - 5 * x).subs(x, -2), sf=3, tolerance=tolerance),
    "before-solve-linear": lambda v, tolerance: check_numeric(v, solve((x + 4) / 3 - 7, x)[0], sf=3, tolerance=tolerance),
    "before-square-root": before_not_real,
    "ex-evaluate-notation": lambda tex: same(tex, (x**2 - 4 * x + 1).subs(x, -3)),
    "ex-notation-expression": lambda tex: same(tex, expand(f_shift.subs(x, x - 1))),
    "check-evaluate-fraction": lambda v, tolerance: check_numeric(v, (12 / (t + 1)).subs(t, 3), sf=3, tolerance=tolerance),
    "check-notation-expression": lambda tex: same(tex, expand(f_shift2.subs(x, x + 1))),
    "ex-domain-range-root": lambda tex: domain_and_range(tex, 3 + sqrt(x - 4)),
    "ex-range-restricted": lambda tex: output_set(tex, "g(x)", function_range((x - 1) ** 2 - 4, x, Interval(-1, 4))),
    "check-domain-root": lambda tex: check_same_set(tex, continuous_domain(sqrt(10 - 4 * x), x, S.Reals), var="x"),
    "check-range-graph": lambda tex: output_set(tex, "f(x)", function_range(7 - x**2, x, Interval(-1, 3))),
    "ex-model-cost": cost_both,
    "ex-model-ball": ball_both,
    "check-model-domain": lambda tex: check_same_set(tex, Interval(0, solve(battery, t)[0]), var="t"),
    "check-model-range": lambda tex: output_set(tex, "h(t)", function_range(drone, t, Interval(0, 7))),
    "ex-inverse-undo": lambda tex: same(tex, inverse_rule(x / 4 + 5)),
    "check-inverse-linear": lambda tex: same(tex, inverse_rule(3 * x - 7)),
    # (a, b) on y = f(x) means f(a) = b, so f^{-1}(b) = a: the image point swaps the given coordinates.
    "check-inverse-reflect": lambda tex: same_point(tex, tuple(reversed(GIVEN_POINT))),
    "ex-inverse-solve": inverse_domain_and_value,
    "ex-inverse-gdc": lambda tex: check_rounded(tex, f_inverse_20(), sf=3),
    "check-inverse-value": lambda v, tolerance: check_numeric(v, inverse_value(2 * x**3 + 1, 55, S.Reals), sf=3, tolerance=tolerance),
    "check-inverse-domain": lambda tex: check_same_set(tex, function_range((x - 2) ** 2 + 1, x, Interval(2, oo)), var="x"),
}

NUMERIC = {
    "before-substitute": {"sf": 3},
    "before-solve-linear": {"sf": 3},
    "check-evaluate-fraction": {"sf": 3},
    "check-inverse-value": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
