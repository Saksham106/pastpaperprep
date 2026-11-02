"""SymPy assertions for lesson 2.7 (Quadratic equations and inequalities). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed from the question's own data: roots with solve, inequality solution sets with solveset over
the reals, discriminants with sympy.discriminant, and parameter conditions by solving the discriminant condition in
the parameter (removing any value that makes the x^2 coefficient zero). Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import EmptySet, FiniteSet, Rational, S, discriminant, expand, simplify, solve, solveset, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_set, parse_answer, parse_list, parse_point, parse_set,
)

x, t, k, m, c = symbols("x t k m c")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def values(tex):
    """Every value of one unknown: a list (`\\text{ or }`, `\\pm`) or a single value."""
    try:
        return parse_list(tex)
    except ValueError as error:
        if "single answer" not in str(error):
            raise
        return [parse_answer(tex)]


def same_values(tex, truth):
    published = sorted(values(tex), key=lambda r: float(r))
    truth = sorted(truth, key=lambda r: float(r))
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def roots_are(tex, expr, var=x):
    same_values(tex, [r for r in solve(expr, var) if r.is_real])


def same_point(tex, truth):
    published = parse_point(tex)
    if len(published) != 2 or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


def vertex(expr):
    (xv,) = solve(expr.diff(x), x)
    return (xv, expr.subs(x, xv))


NATURE = {"two distinct real roots": 1, "two equal real roots": 0, "no real roots": -1}


def nature_is(text, quadratic):
    words = re.sub(r"\s+", " ", text.strip().strip("$")).lower()
    if words not in NATURE:
        raise ValueError(f"cannot read {text!r} as a nature of roots")
    delta = discriminant(quadratic, x)
    sign = 1 if delta > 0 else (0 if delta == 0 else -1)
    if NATURE[words] != sign:
        raise AssertionError(f"{text!r} does not match discriminant {delta}")


DISCRIMINANT_AND_NATURE = re.compile(r"\s*(\$[^$]+\$), so (.+?)\s*")


def discriminant_and_nature(text, quadratic):
    """`$\\Delta = -7$, so no real roots`: the value must equal the discriminant and the words must name its case."""
    match = DISCRIMINANT_AND_NATURE.fullmatch(text)
    if not match:
        raise ValueError(f"cannot read {text!r} as a discriminant and a nature of roots")
    same(match.group(1), discriminant(quadratic, x))
    nature_is(match.group(2), quadratic)


def no_roots_set():
    quadratic = (m - 2) * x**2 + 4 * x + (m + 1)
    found = solveset(discriminant(quadratic, x) < 0, m, S.Reals)
    # m = 2 makes the equation linear (4x + 3 = 0, one real root), so it can never belong to the set.
    lead_zero = solveset(quadratic.coeff(x, 2), m, S.Reals)
    return found - lead_zero


def distinct_roots_set():
    quadratic = k * x**2 - 6 * x + (k + 8)
    found = solveset(discriminant(quadratic, x) > 0, k, S.Reals)
    # k = 0 makes the equation linear (-6x + 8 = 0, one root), so it can't give two distinct roots.
    lead_zero = solveset(quadratic.coeff(x, 2), k, S.Reals)
    return found - lead_zero


EXCLUDING = re.compile(r"^\s*\$?(?P<set>.+?),\s*(?:\\;\s*)?(?P<var>[A-Za-z])\s*\\neq\s*(?P<value>[^$,]+?)\s*\$?\s*$", re.S)


def same_set_excluding(tex, truth, var):
    """A solution set written `-9 < k < 1, \\; k \\neq 0`. mathparse.parse_set reads the inequalities; the trailing
    `var \\neq value` removes one point. Without that clause it is a plain set."""
    match = EXCLUDING.match(tex)
    if match:
        if match["var"] != var:
            raise ValueError(f"{tex!r} excludes a value of {match['var']}, not {var}")
        published = parse_set("$" + match["set"] + "$", var) - FiniteSet(parse_answer("$" + match["value"] + "$"))
    else:
        published = parse_set(tex, var)
    if published.complement(truth) != EmptySet or truth.complement(published) != EmptySet:
        raise AssertionError(f"published set {published} is not {truth}")


def intersection_count():
    return len(solveset((x**2 + 4 * x + 3) - (2 * x + 1), x, S.Reals))


def stone_truth():
    h = 18 + 7 * t - Rational(49, 10) * t**2
    positive = [r for r in solve(h, t) if r > 0]
    if len(positive) != 1:
        raise AssertionError(f"expected one positive root, found {positive}")
    return positive[0]


def larger_root():
    return max(solve(2 * x**2 - 7 * x + 1, x), key=lambda r: float(r))


def positive_c():
    found = [v for v in solve(discriminant(4 * x**2 + c * x + 9, x), c) if v > 0]
    if len(found) != 1:
        raise AssertionError(f"expected one positive c, found {found}")
    return found[0]


CHECKS = {
    "before-vertex-form": lambda tex: same_point(tex, vertex(2 * (x + 1) ** 2 - 5)),
    "before-factored-intercepts": lambda tex: roots_are(tex, (x - 2) * (x + 6)),
    "ex-factorise-monic": lambda tex: roots_are(tex, x**2 + 3 * x - 28),
    "ex-factorise-split": lambda tex: roots_are(tex, 6 * x**2 - (7 * x + 3)),
    "check-common-factor": lambda tex: roots_are(tex, 3 * x**2 - 12 * x),
    "check-factorise-split": lambda tex: roots_are(tex, 2 * x**2 + 5 * x - 12),
    "ex-complete-square": lambda tex: roots_are(tex, x**2 - 8 * x + 3),
    "ex-formula-exact": lambda tex: roots_are(tex, 3 * x**2 - 4 * x - 2),
    "ex-stone-gdc": lambda tex: check_rounded(tex, stone_truth(), sf=3, unit="s"),
    "check-complete-square": lambda tex: roots_are(tex, x**2 + 10 * x + 18),
    "check-formula-gdc": lambda v, tolerance: check_numeric(v, larger_root(), sf=3, tolerance=tolerance),
    "ex-inequality-basic": lambda tex: check_same_set(tex, solveset(x**2 - x - 12 < 0, x, S.Reals)),
    "ex-inequality-rearrange": lambda tex: check_same_set(tex, solveset(3 + 5 * x >= 2 * x**2, x, S.Reals)),
    "check-inequality-common-factor": lambda tex: check_same_set(tex, solveset(x**2 > 9 * x, x, S.Reals)),
    "check-inequality-closed": lambda tex: check_same_set(tex, solveset(x**2 + 4 * x - 5 <= 0, x, S.Reals)),
    "ex-nature-of-roots": lambda text: discriminant_and_nature(text, 2 * x**2 - 5 * x + 4),
    "ex-parameter-no-roots": lambda tex: check_same_set(tex, no_roots_set(), var="m"),
    "check-nature-of-roots": lambda text: nature_is(text, 9 * x**2 - 30 * x + 25),
    "check-parameter-distinct-roots": lambda tex: same_set_excluding(tex, distinct_roots_set(), "k"),
    "check-parameter-equal-roots": lambda v, tolerance: check_numeric(v, positive_c(), dp=0, tolerance=tolerance),
    "check-line-meets-curve": lambda tex: same(tex, intersection_count()),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "check-formula-gdc": {"sf": 3},
    "check-parameter-equal-roots": {"dp": 0},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
