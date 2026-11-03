"""SymPy assertions for lesson 2.14 (Odd, even and inverse functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed from each question's own data: parity by simplifying f(-x) - f(x) and f(-x) + f(x), inverses by
solving f(y) = x and keeping the branch the restricted domain allows, domains of inverses as SymPy's function_range of
the restricted f, symmetric points by reflection matrices, values of periodic functions by sliding the input by the
period and applying the symmetry, and self-inverse claims by proving f(f(x)) = x symbolically on the stated domain
(sample points are only a smoke check).
"""
import re
import sys
from pathlib import Path

from sympy import (
    Eq, Interval, Matrix, N, Poly, Rational, diff, exp, log, oo, pi, real_roots, simplify, sin, cos, solve, sqrt,
    symbols,
)
from sympy.calculus.util import function_range

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_set, check_self_inverse, parse_answer, parse_list, parse_point, proves_zero,
)

x = symbols("x")  # mathparse returns plain symbols
y = symbols("y")
r = symbols("r", real=True)
POS = symbols("x_pos", positive=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def point_is(tex, truth):
    published = parse_point(tex)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {tuple(truth)}")


# --- parity --------------------------------------------------------------------------------------------------------
def parity(f):
    """'even', 'odd' or 'neither', from f(-x) compared with f(x) and -f(x)."""
    g = f.subs(x, -x)
    if simplify(g - f) == 0:
        return "even"
    if simplify(g + f) == 0:
        return "odd"
    # neither: confirm with a number, as the lesson does
    for a in (1, 2, Rational(1, 3)):
        if simplify(f.subs(x, -a) - f.subs(x, a)) != 0 and simplify(f.subs(x, -a) + f.subs(x, a)) != 0:
            return "neither"
    raise AssertionError(f"could not classify {f}")


def option_has_parity(tex, wanted):
    found = parity(parse_answer(tex))
    if found != wanted:
        raise AssertionError(f"{tex} is {found}, not {wanted}")


CLASSIFY = re.compile(r"\$([a-z])\$\s+is\s+(even|odd|neither)")


def classify_polynomials(text):
    """Word answer: each named function's parity must match the parity computed from its formula."""
    functions = {"f": 2 * x**6 - 7 * x**2, "g": 4 * x - x**3, "h": x**2 + x}
    named = dict(CLASSIFY.findall(text))
    if set(named) != set(functions):
        raise ValueError(f"cannot read a parity for each of f, g, h in {text!r}")
    for name, f in functions.items():
        if named[name] != parity(f):
            raise AssertionError(f"{name} is {parity(f)}, published {named[name]}")


def two_parts(tex):
    """Split a two-part answer at its top-level `, \\;` into the part (a) and part (b) texts, each wrapped in `$...$`."""
    pieces = re.split(r",\s*\\;\s*", tex.strip().strip("$").strip())
    if len(pieces) != 2:
        raise ValueError(f"expected two parts split by ', \\;' in {tex!r}")
    return [f"${piece.strip()}$" for piece in pieces]


def odd_zeros(tex):
    """Data: f odd on [-5, 5], zero on [0, 5] only at 0 and 4. Odd sends each zero a to -a."""
    right = {0, 4}
    truth = sorted(right | {-a for a in right})
    published = sorted(parse_list(tex), key=lambda v: float(v))
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


HALF_TURN = Matrix([[-1, 0], [0, -1]])


def odd_graph_point(tex):
    """Part (a): the local maximum (2, 5) under the half-turn about the origin, after a `\\text{minimum: }` label.
    Part (b): the zeros, as in odd_zeros."""
    part_a, part_b = two_parts(tex)
    label = re.match(r"\$\s*\\text\{\s*minimum:\s*\}\s*", part_a)
    if not label:
        raise ValueError(f"part (a) {part_a!r} has no \\text{{minimum: }} label")
    point_is("$" + part_a[label.end():], list(HALF_TURN * Matrix([2, 5])))
    odd_zeros(part_b)
Y_MIRROR = Matrix([[-1, 0], [0, 1]])


def symmetric_value(n, data, period, sign):
    """Value at n of a function with the given period and symmetry (sign +1 even, -1 odd), from the known data."""
    for k in range(-3, 4):
        m = n - k * period
        if m in data:
            return data[m]
        if -m in data:
            return sign * data[-m]
    raise AssertionError(f"no data reaches {n}")


# --- inverses --------------------------------------------------------------------------------------------------------
def inverse(f, branch_test):
    """Solve f(y) = x for y; keep the one branch whose values lie in the restricted domain at a sample."""
    branches = [b for b in solve(Eq(f.subs(x, y), x), y) if branch_test(b)]
    if len(branches) != 1:
        raise AssertionError(f"expected one inverse branch of {f}, found {branches}")
    return branches[0]


INVERSE_WITH_DOMAIN = re.compile(r"\s*\$(.+),\s*\\;\s*x\s*(\\ge|\\le|<|>)\s*([^$]+?)\s*\$\s*")


def split_inverse(tex):
    match = INVERSE_WITH_DOMAIN.fullmatch(tex)
    if not match:
        raise ValueError(f"cannot read {tex!r} as a formula followed by its domain")
    formula, op, bound = match.groups()
    return f"${formula}$", f"$x {op} {bound}$"


def inverse_with_domain(tex, f, f_domain, branch_test):
    """Formula = the inverse branch the domain allows (and it undoes f); stated domain = range of the restricted f."""
    formula, domain = split_inverse(tex)
    finv = inverse(f, branch_test)
    if simplify((f.subs(x, finv) - x).subs(x, r)) != 0:  # real x, so log(exp(x)) = x
        raise AssertionError(f"{finv} does not undo {f}")
    same(formula, finv)
    check_same_set(domain, function_range(f.subs(x, r), r, f_domain))


QUAD = x**2 - 8 * x + 3


def quadratic_k():
    """Largest k: the vertex, where f'(x) = 0."""
    (k,) = solve(diff(QUAD, x), x)
    return k


def restrict_quadratic(tex):
    k = quadratic_k()
    assert k == 4
    inverse_with_domain(tex, QUAD, Interval(-oo, k), lambda b: N(b.subs(x, 0)) <= k)


LOG_EVEN = log(x**2 + 4)


def restrict_even_log(tex):
    assert parity(LOG_EVEN) == "even"  # part (a): so f is not one-to-one on R
    inverse_with_domain(tex, LOG_EVEN, Interval(0, oo), lambda b: N(b.subs(x, 2)) >= 0)


SHIFTED = (x + 3) ** 2 - 2


def restrict_root_option(tex):
    finv = inverse(SHIFTED, lambda b: N(b.subs(x, 7)) <= -3)
    same(tex, finv)


def restrict_k():
    """Smallest k for 2x^2 + 10x - 1 on x >= k: its vertex."""
    (k,) = solve(diff(2 * x**2 + 10 * x - 1, x), x)
    return k


CUBIC = x**3 - 4 * x + 1


def cubic_a():
    """a = the right-hand zero of f' (f'' > 0 there, so a local minimum and f increases after it)."""
    a = max(solve(diff(CUBIC, x), x), key=lambda v: float(v))
    assert diff(CUBIC, x, 2).subs(x, a) > 0
    return a


def cubic_inverse_at_5():
    """f^-1(5) = the real root of f(x) = 5 with x >= a."""
    a = cubic_a()
    roots = [v for v in real_roots(Poly(CUBIC - 5, x)) if float(v) >= float(a)]
    assert len(roots) == 1, roots
    return roots[0]


# --- self-inverse ----------------------------------------------------------------------------------------------------
def line_composed(tex):
    f = 6 - x
    same(tex, simplify(f.subs(x, f)))


def self_inverse_option(tex):
    """The question says every option has domain R. check_self_inverse proves f(f(x)) = x for every real x, reading each
    cube root as the real cube root, and needs f defined on all of R. Agreeing at a few points is not a proof: the
    function x + (x - 1/2)(x - 1)(x - 19/10) fixes three points but g(g(0)) = -72067/8000."""
    check_self_inverse(tex, domain=Interval(-oo, oo))


QUARTER = sqrt(25 - x**2)


def quarter_inverse_at_3():
    """Solve f(y) = 3 with 0 <= y <= 5 directly (not using the self-inverse shortcut)."""
    sols = [v for v in solve(Eq(QUARTER.subs(x, y), 3), y) if 0 <= v <= 5]
    assert len(sols) == 1
    return sols[0]


LOG_SELF = log((exp(x) + 1) / (exp(x) - 1))


def self_inverse_log(tex):
    """The published formula g must undo f both ways and equal f, each PROVED symbolically for every x > 0 (a positive
    symbol), with the sample points of ]0, oo[ kept as a smoke check. Its stated domain must be the range of f on x > 0."""
    formula, domain = split_inverse(tex)
    g = parse_answer(formula).subs(x, POS)
    f = LOG_SELF.subs(x, POS)
    for what, difference in (("g(f(x)) = x", g.subs(POS, f) - POS), ("f(g(x)) = x", f.subs(POS, g) - POS),
                             ("g = f", g - f)):
        if not proves_zero(difference):
            raise AssertionError(f"could not prove {what} for every x > 0 with g = {g}")
    for s in (Rational(1, 10), 1, 2, 5):
        if abs(N(g.subs(POS, f.subs(POS, s)) - s, 30)) > 1e-20 or abs(N(f.subs(POS, g.subs(POS, s)) - s, 30)) > 1e-20:
            raise AssertionError(f"g and f do not undo each other at {s}")
    check_same_set(domain, function_range(LOG_SELF.subs(x, r), r, Interval.open(0, oo)))


def restrict_gdc(tex):
    """Part (a): a, exact. Part (b): f^-1(5) to 3 s.f."""
    part_a, part_b = two_parts(tex)
    if not re.match(r"\$\s*a\s*=", part_a):
        raise ValueError(f"part (a) {part_a!r} does not start 'a ='")
    same(part_a, cubic_a())
    check_rounded(part_b, cubic_inverse_at_5(), sf=3)


TRIG_QUOTIENT = sin(x) / (2 + cos(x))


def trig_quotient(tex):
    """Part (a): f is odd. Part (b), the published answer: f(-pi/3), compared with direct substitution."""
    assert parity(TRIG_QUOTIENT) == "odd"
    same(tex, TRIG_QUOTIENT.subs(x, -pi / 3))


CHECKS = {
    "before-reflect-y-axis": lambda tex: point_is(tex, list(Y_MIRROR * Matrix([3, -4]))),
    "before-inverse-domain": lambda tex: check_same_set(
        tex, function_range(sqrt(r - 2) + 1, r, Interval(2, oo))),
    "ex-classify-polynomials": classify_polynomials,
    "check-which-odd": lambda tex: option_has_parity(tex, "odd"),
    "ex-odd-graph-point": odd_graph_point,
    "check-even-point": lambda tex: point_is(tex, list(Y_MIRROR * Matrix([-3, -1]))),
    "ex-trig-quotient": trig_quotient,
    "check-which-even-trig": lambda tex: option_has_parity(tex, "even"),
    "ex-period-parity-value": lambda tex: same(tex, symmetric_value(5, {3: 2}, 8, -1)),
    "check-period-even-value": lambda v, tolerance: check_numeric(
        v, symmetric_value(7, {3: -7}, 10, 1), sf=3, tolerance=tolerance),
    "ex-restrict-quadratic": restrict_quadratic,
    "check-restrict-root": restrict_root_option,
    "ex-restrict-even-log": restrict_even_log,
    "check-restrict-k": lambda v, tolerance: check_numeric(v, restrict_k(), sf=3, tolerance=tolerance),
    "ex-restrict-gdc": restrict_gdc,
    "ex-self-inverse-line": line_composed,
    "check-self-inverse-cube": self_inverse_option,
    "check-self-inverse-value": lambda v, tolerance: check_numeric(
        v, quarter_inverse_at_3(), sf=3, tolerance=tolerance),
    "ex-self-inverse-log": self_inverse_log,
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "check-period-even-value": {"sf": 3},
    "check-restrict-k": {"sf": 3},
    "check-self-inverse-value": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
