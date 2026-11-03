"""SymPy assertions for lesson 2.5 (Composite and inverse functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Eq, FiniteSet, Interval, Matrix, Poly, Rational, S, exp, log, nsolve, oo, real_root, real_roots, simplify, solve, sqrt,
    symbols,
)
from sympy.calculus.singularities import is_decreasing, is_increasing
from sympy.calculus.util import function_range

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    _normalise_real_roots, check_numeric, check_rounded_list, check_same_set, parse_answer, parse_list, parse_point,
    proves_zero, with_real_odd_roots,
)

x = symbols("x")  # mathparse returns plain symbols
y = symbols("y")
r = symbols("r", real=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def compose(outer, inner):
    """(outer o inner)(x) = outer(inner(x)), built by substitution."""
    return outer.subs(x, inner)


def inverse(f, domain_test):
    """The inverse of f(x), by solving f(y) = x for y and keeping the branch that satisfies domain_test at a sample."""
    branches = [b for b in solve(Eq(f.subs(x, y), x), y) if domain_test(b)]
    if len(branches) != 1:
        raise AssertionError(f"expected one inverse branch of {f}, found {branches}")
    return branches[0]


def roots_are(tex, expr):
    published = sorted(parse_list(tex), key=lambda v: float(v))
    truth = sorted(solve(expr, x), key=lambda v: float(v))
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def point_is(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {tuple(truth)}")


def range_set_is(tex, f, domain):
    """A range written as `f(x) \\ge 5`: read it as a set of values of f, compared with SymPy's function_range."""
    if not re.fullmatch(r"\s*\$f\(x\)\s*[^$]*\$\s*", tex):
        raise ValueError(f"cannot read range {tex!r}")
    check_same_set(tex.replace("f(x)", "y"), function_range(f.subs(x, r), r, domain), var="y")


# --- composite functions -------------------------------------------------------------------------------------------

def composite_value():
    f, g = sqrt(x + 5), 3 * x - 2
    return compose(f, g).subs(x, 2)


def composite_gdc(tex):
    """(f o g)(x) = (g o f)(x) for f = e^x, g = x^2 - 2. h = e^(x^2-2) - e^(2x) + 2 has no zero for x <= ln(2)/2
    (there e^(2x) - 2 <= 0 < e^(x^2-2)) and none for x >= 1 + sqrt(3) (there x^2 - 2 >= 2x, so h >= 2). Between those
    ends a dense sign scan finds exactly two sign changes; each root is bisected to 40 digits."""
    f, g = exp(r), r**2 - 2
    h = f.subs(r, g) - g.subs(r, f)
    low, high = log(2) / 2, 1 + sqrt(3)
    if not (h.subs(r, low).evalf() > 0 and h.subs(r, high).evalf() > 0):
        raise AssertionError("end-point argument fails")
    steps = 4000
    grid = [low + (high - low) * Rational(k, steps) for k in range(steps + 1)]
    values = [h.subs(r, p).evalf(30) for p in grid]
    brackets = [(grid[k], grid[k + 1]) for k in range(steps) if values[k] * values[k + 1] < 0]
    if len(brackets) != 2:
        raise AssertionError(f"expected two sign changes, found {len(brackets)}")
    roots = [nsolve(h, r, (a.evalf(30), b.evalf(30)), solver="bisect", prec=40) for a, b in brackets]
    check_rounded_list(tex, roots, sf=3)


# --- identity and inverse values -----------------------------------------------------------------------------------

def identity_verify(tex):
    f, g = 5 * x - 2, (x + 2) / 5
    one, other = simplify(compose(f, g)), simplify(compose(g, f))
    if simplify(one - other) != 0:
        raise AssertionError(f"(f o g)(x) = {one} but (g o f)(x) = {other}")
    same(tex, one)


def inverse_value():
    """f(a) = 7 for f = x^3 + 2x - 5: the single real root (f is increasing, so f^-1(7) is that root)."""
    f = r**3 + 2 * r - 5
    real = real_roots(Poly(f - 7, r))
    if len(real) != 1:
        raise AssertionError(f"expected one real solution, found {real}")
    return real[0]


def identity_value(tex):
    """Data: f(3) = 10. f^-1(10) is the input that f sends to 10."""
    data = {3: 10}
    inputs = [a for a, b in data.items() if b == 10]
    same(tex, inputs[0])


def identity_compose(tex):
    f = (x + 1) / (x - 3)
    finv = inverse(f, lambda b: True)
    same(tex, simplify(compose(f, finv)).subs(x, 12))


# --- finding inverses ------------------------------------------------------------------------------------------------

def inverse_is(tex, f, domain_test=lambda b: True):
    finv = inverse(f, domain_test)
    if simplify(compose(f, finv) - x) != 0:
        raise AssertionError(f"{finv} is not the inverse of {f}")
    same(tex, finv)


INVERSE_WITH_DOMAIN = re.compile(r"\s*\$(.+),\s*\\;\s*x\s*(\\ne|\\ge|\\le|<|>)\s*([^$]+?)\s*\$\s*")


def inverse_with_domain(tex, f, f_domain, domain_test=lambda b: True):
    """`f^{-1}(x) = ..., \\; x \\ne 2`: the formula is checked as the inverse of f, and the stated domain is compared
    with the range of f on its domain (computed by function_range)."""
    match = INVERSE_WITH_DOMAIN.fullmatch(tex)
    if not match:
        raise ValueError(f"cannot read {tex!r} as a formula followed by its domain")
    formula, op, bound = match.groups()
    inverse_is(f"${formula}$", f, domain_test)
    truth = function_range(f.subs(x, r), r, f_domain)
    if op == "\\ne":
        published = S.Reals - FiniteSet(parse_answer(f"${bound}$"))
        if published.complement(truth) != S.EmptySet or truth.complement(published) != S.EmptySet:
            raise AssertionError(f"published domain {published} is not the range {truth}")
    else:
        check_same_set(f"$x {op} {bound}$", truth)


def inverse_domain(tex):
    """Domain of f^-1 = range of f = 5 - x^2 on x >= 0."""
    check_same_set(tex, function_range(5 - r**2, r, Interval(0, oo)))


# --- one-to-one and reflection -----------------------------------------------------------------------------------------

NOT_ONE_TO_ONE = re.compile(r"\s*\$f\$ is not one-to-one: \$f\((.+?)\) = f\((.+?)\)\$\s*")


def not_one_to_one(text, f):
    match = NOT_ONE_TO_ONE.fullmatch(text)
    if not match:
        raise ValueError(f"cannot read {text!r}")
    a, b = (parse_answer(m) for m in match.groups())
    if simplify(a - b) == 0:
        raise AssertionError("the two inputs are the same")
    if simplify(f.subs(x, a) - f.subs(x, b)) != 0:
        raise AssertionError(f"f({a}) = {f.subs(x, a)} but f({b}) = {f.subs(x, b)}")


def has_inverse(tex):
    """A polynomial on R is one-to-one exactly when it is strictly monotonic (it is continuous, so a turn repeats
    outputs). That holds exactly when f' never changes sign on R and f' is not the zero polynomial (its zeros are then
    isolated, as at x = 0 for x^3). Only the option that is one-to-one passes."""
    f = parse_answer(tex).subs(x, r)
    if not f.is_polynomial(r):
        raise ValueError(f"expected a polynomial, got {f}")
    if simplify(f.diff(r)) == 0 or not (is_increasing(f, S.Reals) or is_decreasing(f, S.Reals)):
        raise AssertionError(f"{f} is not one-to-one on R, so it has no inverse")


def reflection_x_intercept(tex):
    """f = x^3/2 + 4. f^-1(x) = cube root of 2(x - 4), checked as the inverse; its graph meets the x-axis where it is 0."""
    f = r**3 / 2 + 4
    finv = real_root(2 * (r - 4), 3)
    # Proved both ways for every real x (real cube roots); the samples below are a smoke check only.
    if not proves_zero(f.subs(r, finv) - r):
        raise AssertionError("could not prove f(f^-1(x)) = x")
    as_real_root = with_real_odd_roots((2 * (r - 4)) ** Rational(1, 3))
    if not proves_zero(_normalise_real_roots(as_real_root.subs(r, f)) - r):
        raise AssertionError("could not prove f^-1(f(x)) = x")
    for sample in (-3, 0, 4, 7, 20):
        if abs((f.subs(r, finv.subs(r, sample)) - sample).evalf()) > 1e-12:
            raise AssertionError("cube-root formula is not the inverse")
    crossing = solve(Eq(2 * (r - 4), 0), r)  # finv = 0 exactly when 2(x - 4) = 0
    point_is(tex, [crossing[0], 0])


def reflected_point(tex):
    """(5, -2) on y = f(x): reflect in y = x with the reflection matrix."""
    image = Matrix([[0, 1], [1, 0]]) * Matrix([5, -2])
    point_is(tex, list(image))


CHECKS = {
    "before-evaluate": lambda tex: same(tex, (x**2 - 3 * x).subs(x, -2)),
    "before-range": lambda tex: range_set_is(tex, x**2 + 5, S.Reals),
    "ex-composite-value": lambda tex: same(tex, composite_value()),
    "check-composite-order": lambda tex: same(tex, compose(x**3, x - 2)),
    "ex-composite-solve": lambda tex: roots_are(tex, compose(x**2 - 4 * x, 2 * x + 1) - 5),
    "check-composite-number": lambda v, tolerance: check_numeric(
        v, compose(3 - x, 2 * x**2 - 1).subs(x, -2), sf=3, tolerance=tolerance),
    "ex-composite-gdc": composite_gdc,
    "ex-identity-verify": identity_verify,
    "ex-inverse-value": lambda tex: same(tex, inverse_value()),
    "check-identity-value": identity_value,
    "check-identity-compose": identity_compose,
    "ex-inverse-linear": lambda tex: inverse_is(tex, 7 - 2 * x),
    "check-inverse-linear": lambda tex: inverse_is(tex, x / 4 - 3),
    "ex-inverse-rational": lambda tex: inverse_with_domain(tex, (2 * x + 1) / (x - 3), S.Reals - FiniteSet(3)),
    # Domain x >= 2: keep the branch whose output at x = 5 (in the range of f) is at least 2.
    "ex-inverse-domain": lambda tex: inverse_with_domain(
        tex, (x - 2) ** 2 + 1, Interval(2, oo), lambda b: b.subs(x, 5) >= 2),
    "check-inverse-domain": inverse_domain,
    "ex-not-one-to-one": lambda text: not_one_to_one(text, x**2 - 6 * x),
    "check-one-to-one": has_inverse,
    "ex-reflection-point": reflection_x_intercept,
    "check-reflection-point": reflected_point,
}

NUMERIC = {"check-composite-number": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
