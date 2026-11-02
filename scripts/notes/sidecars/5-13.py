"""SymPy assertions for lesson 5.13 (evaluating limits). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is a SymPy limit (or derivative) computed from the question's own functions, never a typed-in answer.
"""
import sys
from pathlib import Path

from sympy import atan, cos, diff, exp, limit, log, oo, simplify, sin, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, parse_answer  # noqa: E402

x, k = symbols("x k")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def limit_is(tex, expr, point):
    same(tex, limit(expr, x, point))


def constant_and_limit(tex):
    """sin(3x) - kx over x^3: for a finite limit the x-coefficient of the top must vanish (the bottom starts at x^3)."""
    top = sin(3 * x) - k * x
    k_values = solve(diff(top, x).subs(x, 0), k)
    if len(k_values) != 1:
        raise AssertionError(f"expected one k, got {k_values}")
    k_truth = k_values[0]
    # The x^2 coefficient must vanish too; it does for every k, since sin is odd.
    if simplify(diff(top, x, 2).subs(x, 0)) != 0:
        raise AssertionError("x^2 term of the top does not vanish")
    l_truth = limit(top.subs(k, k_truth) / x**3, x, 0)
    check_assignments(tex, {"k": k_truth, "L": l_truth})


def exp_constant_and_limit(tex):
    """e^x + e^-x - a over x^2: the bottom tends to 0, so a finite limit needs the top to tend to 0 as well."""
    a = symbols("a")
    top = exp(x) + exp(-x) - a
    a_values = solve(top.subs(x, 0), a)
    if len(a_values) != 1:
        raise AssertionError(f"expected one a, got {a_values}")
    a_truth = a_values[0]
    l_truth = limit(top.subs(a, a_truth) / x**2, x, 0)
    if not l_truth.is_finite:
        raise AssertionError(f"limit {l_truth} is not finite")
    check_assignments(tex, {"a": a_truth, "L": l_truth})


CHECKS = {
    "before-chain-rule": lambda tex: same(tex, diff(cos(3 * x), x)),
    "before-second-derivative": lambda tex: same(tex, diff(sin(2 * x), x, 2)),
    "ex-lhopital-sin": lambda tex: limit_is(tex, sin(x) / x, 0),
    "ex-lhopital-ln": lambda tex: limit_is(tex, (x**2 - 9) / log(x - 2), 3),
    "check-lhopital-exp": lambda tex: limit_is(tex, (exp(4 * x) - 1) / sin(x), 0),
    "ex-lhopital-infinity": lambda tex: limit_is(tex, (5 * x + log(x)) / (2 * x + 1), oo),
    "check-lhopital-poly": lambda v, tolerance: check_numeric(v, limit((x**3 - 8) / (x**2 + x - 6), x, 2), sf=3, tolerance=tolerance),
    "ex-repeat-exp": lambda tex: limit_is(tex, (exp(2 * x) - 1 - 2 * x) / x**2, 0),
    "check-repeat-cos": lambda tex: limit_is(tex, (1 - cos(4 * x)) / x**2, 0),
    "ex-repeat-constant": constant_and_limit,
    "check-repeat-constant-exp": exp_constant_and_limit,
    "check-series-exp-sub": lambda tex: limit_is(tex, (exp(-x**2) - 1 + x**2) / x**4, 0),
    "ex-series-sin": lambda tex: limit_is(tex, (x - sin(x)) / x**3, 0),
    "check-series-arctan": lambda tex: limit_is(tex, (x - atan(x)) / x**3, 0),
    "ex-series-gdc": lambda tex: limit_is(tex, (log(1 + 2 * x) - 2 * x) / x**2, 0),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-lhopital-poly": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
