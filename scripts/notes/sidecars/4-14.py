"""SymPy assertions for lesson 4.14 (discrete and continuous random variables). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data: discrete moments are sums over the stated table, density
constants solve "total integral = 1", modes compare f at its critical points and end points, medians solve
"integral up to m = 1/2", and continuous moments are SymPy integrals of x f(x) and x^2 f(x).
"""
import sys
from pathlib import Path

from sympy import Rational, S, diff, integrate, nsolve, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, check_rounded, parse_answer  # noqa: E402

x, k, m, p, q = symbols("x k m p q", real=True)


def same(tex, truth):
    published = parse_answer(tex)
    if (published - truth).simplify() != 0:
        raise AssertionError(f"published {published} is not {truth}")


# ---------------------------------------------------------------- discrete

def moments(table):
    """table: [(value, probability)] with exact probabilities. Returns (E(X), E(X^2), Var(X)); probabilities must sum to 1."""
    assert sum(pr for _, pr in table) == 1
    e1 = sum(v * pr for v, pr in table)
    e2 = sum(v**2 * pr for v, pr in table)
    return e1, e2, e2 - e1**2


def r(s):
    return Rational(s)


def var_unknowns():
    """ex-var-unknowns: solve the two conditions for p and q, then compute the variance from the completed table."""
    sol = solve([r("0.2") + p + q + r("0.1") - 1, 0 * r("0.2") + p + 2 * q + 3 * r("0.1") - r("1.4")], [p, q], dict=True)[0]
    table = [(0, r("0.2")), (1, sol[p]), (2, sol[q]), (3, r("0.1"))]
    assert all(pr >= 0 for _, pr in table)
    e1, _, var = moments(table)
    assert e1 == r("1.4")
    return var


# ---------------------------------------------------------------- continuous

def piecewise_density(kk):
    """[(expression, lower, upper)] for the ramp-then-flat density used in the lesson."""
    return [(kk * x**2, 0, 1), (kk, 1, 3)]


def total(pieces):
    return sum(integrate(expr, (x, a, b)) for expr, a, b in pieces)


def cont_moments(pieces):
    assert total(pieces) == 1
    e1 = sum(integrate(x * expr, (x, a, b)) for expr, a, b in pieces)
    e2 = sum(integrate(x**2 * expr, (x, a, b)) for expr, a, b in pieces)
    return e1, e2, e2 - e1**2


def solve_constant(pieces_in_k):
    roots = [s for s in solve(total(pieces_in_k) - 1, k) if s > 0]
    assert len(roots) == 1
    return roots[0]


def mode_of(expr, a, b):
    """Argmax of f on [a, b]: compare f at every critical point inside and at both ends."""
    candidates = [S(a), S(b)] + [c for c in solve(diff(expr, x), x) if c.is_real and a <= c <= b]
    values = {c: expr.subs(x, c) for c in candidates}
    best = max(values.values())
    winners = [c for c, v in values.items() if v == best]
    assert len(winners) == 1
    assert all(v >= 0 for v in values.values())
    return winners[0]


def median_exact(pieces):
    """Solve cumulative area = 1/2 piece by piece, keeping the root inside the piece where the half is reached."""
    so_far = S(0)
    for expr, a, b in pieces:
        area = integrate(expr, (x, a, b))
        if so_far + area >= Rational(1, 2):
            roots = [s for s in solve(so_far + integrate(expr, (x, a, m)) - Rational(1, 2), m) if s.is_real and a <= s <= b]
            assert len(roots) == 1
            return roots[0]
        so_far += area
    raise AssertionError("median not found")


CUBIC = Rational(4, 27) * x * (3 - x) ** 2  # pdf on [0, 3]


def cubic_median():
    """ex-median-gdc: quartic in m, no neat root, so solve numerically (30 digits) and confirm the root is inside [0, 3]."""
    assert integrate(CUBIC, (x, 0, 3)) == 1
    cdf = integrate(CUBIC, (x, 0, m))
    root = nsolve(cdf - Rational(1, 2), m, 1.2, prec=30)
    assert 0 <= root <= 3
    assert abs(cdf.subs(m, root) - Rational(1, 2)) < 1e-20
    return root


def fair_fee():
    table = [(0, r("0.4")), (2, r("0.3")), (5, r("0.2")), (10, r("0.1"))]
    e1, _, _ = moments(table)
    c = symbols("c")
    return solve(2 * e1 - c, c)[0]


def density_piecewise_answers():
    """ex-density-piecewise: k from "total area = 1", then P(X <= 2) by integrating the solved density over [0, 2]."""
    kk = solve_constant(piecewise_density(k))
    prob = integrate(kk * x**2, (x, 0, 1)) + integrate(kk, (x, 1, 2))
    return {"k": kk, "\\mathrm{P}(X\\le2)": prob}


def cubic_mean_var():
    """ex-cont-mean-var: E(X) and Var(X) of the cubic density, both from SymPy integrals."""
    e1, _, var = cont_moments([(CUBIC, 0, 3)])
    return {"\\mathrm{E}(X)": e1, "\\mathrm{Var}(X)": var}


CHECKS = {
    "before-expected-value": lambda v, tolerance: check_numeric(
        v, moments([(1, r("0.5")), (2, r("0.3")), (5, r("0.2"))])[0], sf=3, tolerance=tolerance),
    "before-definite-integral": lambda v, tolerance: check_numeric(
        v, integrate(3 * x**2 - x, (x, 0, 2)), sf=3, tolerance=tolerance),
    "before-stationary": lambda tex: same(
        tex, [c for c in solve(diff(12 * x - 2 * x**3, x), x) if c > 0 and diff(12 * x - 2 * x**3, x, 2).subs(x, c) < 0][0]),
    "ex-var-table": lambda tex: same(tex, moments([(1, r("0.1")), (2, r("0.3")), (3, r("0.4")), (4, r("0.2"))])[2]),
    "ex-var-unknowns": lambda tex: same(tex, var_unknowns()),
    "check-var-formula": lambda tex: same(tex, moments([(v, Rational(v, 10)) for v in range(1, 5)])[2]),
    "check-sd-discrete": lambda v, tolerance: check_numeric(
        v, sqrt(moments([(-2, r("0.25")), (0, r("0.5")), (3, r("0.25"))])[2]), sf=3, tolerance=tolerance),
    "ex-density-k": lambda tex: same(tex, solve_constant([(k * x * (3 - x) ** 2, 0, 3)])),
    "ex-density-piecewise": lambda tex: check_assignments(tex, density_piecewise_answers()),
    "check-density-sqrt-k": lambda tex: same(tex, solve_constant([(k * sqrt(x), 0, 4)])),
    "check-density-prob": lambda v, tolerance: check_numeric(
        v, integrate(solve_constant(piecewise_density(k)), (x, Rational(5, 2), 3)), sf=3, tolerance=tolerance),
    "ex-mode-calculus": lambda tex: same(tex, mode_of(CUBIC, 0, 3)),
    "ex-median-piecewise": lambda tex: same(tex, median_exact(piecewise_density(solve_constant(piecewise_density(k))))),
    "ex-median-gdc": lambda tex: check_rounded(tex, cubic_median(), sf=3),
    "check-mode-cubic": lambda tex: same(tex, mode_of(solve_constant([(k * x**2 * (2 - x), 0, 2)]) * x**2 * (2 - x), 0, 2)),
    "check-median-power": lambda tex: same(tex, median_exact([(solve_constant([(k * x**2, 0, 2)]) * x**2, 0, 2)])),
    "ex-cont-mean-var": lambda tex: check_assignments(tex, cubic_mean_var()),
    "ex-cont-sd-gdc": lambda tex: check_rounded(
        tex, sqrt(cont_moments(piecewise_density(solve_constant(piecewise_density(k))))[2]), sf=3),
    "check-cont-var": lambda tex: same(tex, cont_moments([(solve_constant([(k * x**2, 0, 2)]) * x**2, 0, 2)])[2]),
    "check-cont-sd": lambda v, tolerance: check_numeric(
        v, sqrt(cont_moments([(solve_constant([(k * sqrt(x), 0, 4)]) * sqrt(x), 0, 4)])[2]), sf=3, tolerance=tolerance),
    # Linear transformation: E(Y) and Var(Y) from the rules, cross-checked against the density the values came from.
    "ex-linear-cost": lambda tex: check_assignments(tex, linear_cost()),
    "ex-fair-game": lambda tex: same(tex, fair_fee()),
    "check-linear-var": lambda tex: same(tex, (-3) ** 2 * 4),
    "check-linear-sd": lambda v, tolerance: check_numeric(v, abs(Rational(1, 2)) * 3, sf=3, tolerance=tolerance),
}


def linear_cost():
    """E(X) = 6/5 and Var(X) = 9/25 as stated; confirm they are the cubic density's moments, then transform by
    integrating (40x + 15) f(x) directly, an independent route to the linear rules."""
    e1, _, var = cont_moments([(CUBIC, 0, 3)])
    assert e1 == Rational(6, 5) and var == Rational(9, 25)
    ey = integrate((40 * x + 15) * CUBIC, (x, 0, 3))
    vy = integrate((40 * x + 15) ** 2 * CUBIC, (x, 0, 3)) - ey**2
    return {"\\mathrm{E}(Y)": ey, "\\mathrm{Var}(Y)": vy}


# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-expected-value": {"sf": 3},
    "before-definite-integral": {"sf": 3},
    "check-sd-discrete": {"sf": 3},
    "check-density-prob": {"sf": 3},
    "check-cont-sd": {"sf": 3},
    "check-linear-sd": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
