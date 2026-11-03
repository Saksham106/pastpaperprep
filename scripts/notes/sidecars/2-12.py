"""SymPy assertions for lesson 2.12 (polynomial functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths come from the question's own data: remainders from SymPy's polynomial division, roots from solve/real_roots,
unknown coefficients by solving the stated conditions, and sums and products of roots from numerical roots (nroots)
rather than from the booklet formula the lesson teaches.
"""
import sys
from pathlib import Path

from sympy import (
    I, Mul, Poly, Pow, expand, factor, im, nroots, prod, re, real_roots, rem, roots, simplify, solve, symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded_list, parse_answer, parse_assignments, parse_list,
)

x, z, a, b, p, q, k, al = symbols("x z a b p q k alpha")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_roots(tex, polynomial, var=x):
    """Every root of the polynomial (complex included, each listed once) and nothing else."""
    published = parse_list(tex)
    truth = list(roots(Poly(polynomial, var)).keys())
    if len(published) != len(truth):
        raise AssertionError(f"published {published}, truth {truth}")
    remaining = list(truth)
    for value in published:
        match = next((t for t in remaining if simplify(value - t) == 0), None)
        if match is None:
            raise AssertionError(f"published root {value} is not among {truth}")
        remaining.remove(match)


def close(published, truth):
    if abs(complex(published) - complex(truth)) > 1e-15:
        raise AssertionError(f"published {published} is not {truth}")


# ---------------------------------------------------------------------------------------------------- before

NATURE = {"two distinct real roots": 1, "two equal real roots": 0, "no real roots": -1}


def nature_is(text, quadratic):
    words = " ".join(text.strip().strip("$").split()).lower()
    if words not in NATURE:
        raise ValueError(f"cannot read {text!r}")
    coeffs = Poly(quadratic, x).all_coeffs()
    disc = coeffs[1] ** 2 - 4 * coeffs[0] * coeffs[2]
    sign = int(bool(disc > 0)) - int(bool(disc < 0))
    if NATURE[words] != sign:
        raise AssertionError(f"{text!r} does not match discriminant {disc}")


# ---------------------------------------------------------------------------------------------------- graphs

def even_multiplicity_root():
    """check-touch-root: the only root of (x+2)^3 (x-4)^2 (x-1) with even multiplicity."""
    found = [root for root, m in roots(Poly(expand((x + 2) ** 3 * (x - 4) ** 2 * (x - 1)), x)).items() if m % 2 == 0]
    assert len(found) == 1
    return found[0]


def from_graph():
    """ex-from-graph: cross at -1 (single), touch at 3 (double), cubic, f(0) = 18."""
    shape = (x + 1) * (x - 3) ** 2
    scale = solve(a * shape.subs(x, 0) - 18, a)[0]
    return scale * shape


def scale_through_point():
    """check-find-scale: a(x+2)(x-1)(x-4) through (2, 12)."""
    return solve(a * (2 + 2) * (2 - 1) * (2 - 4) - 12, a)[0]


# ---------------------------------------------------------------------------------------------------- factor/remainder

def two_unknowns():
    """ex-two-unknowns: (x+2) a factor, remainder -5 on dividing by (2x - 1)."""
    f = 2 * x**3 + a * x**2 + b * x - 6
    conditions = [rem(f, x + 2, x), rem(f, 2 * x - 1, x) + 5]
    solution = solve(conditions, [a, b], dict=True)
    assert len(solution) == 1
    return solution[0]


def double_factor():
    """check-double-factor: (x - 1)^2 divides x^3 + px + q, so the remainder (degree <= 1) vanishes identically."""
    remainder = Poly(rem(x**3 + p * x + q, (x - 1) ** 2, x), x)
    solution = solve(remainder.all_coeffs(), [p, q], dict=True)
    assert len(solution) == 1
    return solution[0]


def _factors(expr):
    """The factors of a product as written (parse_latex keeps products unevaluated), powers reduced to their base."""
    if isinstance(expr, Mul):
        return [f for arg in expr.args for f in _factors(arg)]
    if isinstance(expr, Pow) and expr.exp.is_Integer and expr.exp > 0:
        return _factors(expr.base)
    return [expr]


def fully_factorised(tex, polynomial):
    """ex-factorise-cubic: the published product equals the cubic AND every non-constant factor is linear in x.
    The truth f = 2x^3 + x^2 - 13x + 6 splits into linear factors over Q (SymPy's factor shows it), so "fully" means
    no factor of degree 2 or more may remain: (x - 2)(2x^2 + 5x - 3) must fail."""
    truth = factor(polynomial)
    assert all(Poly(f, x).degree() <= 1 for f in _factors(truth))
    same(tex, polynomial)
    for piece in _factors(parse_answer(tex)):
        if piece.has(x) and Poly(piece.doit(), x).degree() != 1:
            raise AssertionError(f"factor {piece} is not linear: the answer is not fully factorised")


# ---------------------------------------------------------------------------------------------------- equations

def real_root_count():
    return len(real_roots(Poly(x**4 + 3 * x**2 - 4, x)))


def box_roots():
    """ex-box-gdc: x(20 - 2x)(12 - 2x) = 200 with 0 < x < 6 (every side positive)."""
    candidates = [rt.evalf(30) for rt in real_roots(Poly(expand(x * (20 - 2 * x) * (12 - 2 * x) - 200), x))]
    valid = [rt for rt in candidates if 0 < rt < 6]
    assert len(valid) == 2 and len(candidates) == 3
    return valid


# ---------------------------------------------------------------------------------------------------- sum and product

def numeric_sum_product(polynomial):
    """Sum and product of all roots, from 40-digit numerical roots (independent of the booklet formula)."""
    found = nroots(Poly(polynomial, x), n=40, maxsteps=200)
    return sum(found), prod(found)


def quartic_sum_product(tex):
    total, product = numeric_sum_product(2 * x**4 - 3 * x**3 + 5 * x - 8)
    published = parse_assignments(tex)
    if set(published) != {"S", "P"}:
        raise AssertionError(f"published names {sorted(published)} are not S and P")
    close(published["S"], total)
    close(published["P"], product)


def cubic_product(tex):
    _, product = numeric_sum_product(5 * x**3 + 2 * x**2 - x + 15)
    close(parse_answer(tex), product)


def sum_of_squares():
    alpha, beta = solve(3 * x**2 - 6 * x + 2, x)
    return simplify(alpha**2 + beta**2)


def opposite_roots_k():
    """check-opposite-roots: alpha and -alpha both roots of x^3 - 3x^2 + kx + 12; solve for (alpha, k)."""
    f = lambda t: t**3 - 3 * t**2 + k * t + 12  # noqa: E731
    solutions = solve([f(al), f(-al)], [al, k], dict=True)
    values = {s[k] for s in solutions if s[al] != 0}
    assert len(values) == 1
    return values.pop()


def conjugate_root():
    """ex-conjugate-root: 2 - i is a root of 2z^3 + bz^2 + cz + 15 with b, c real; find b and the real root."""
    br, cr = symbols("b c", real=True)
    cubic = 2 * z**3 + br * z**2 + cr * z + 15
    value = expand(cubic.subs(z, 2 - I))
    solution = solve([re(value), im(value)], [br, cr], dict=True)
    assert len(solution) == 1
    real = [rt for rt in roots(Poly(cubic.subs(solution[0]), z)) if rt.is_real]
    assert len(real) == 1
    return {"r": real[0], "b": solution[0][br]}


CHECKS = {
    "before-solve-quadratic": lambda tex: same_roots(tex, 2 * x**2 + x - 6),
    "before-discriminant": lambda text: nature_is(text, 3 * x**2 - 2 * x + 4),
    "before-conjugate-product": lambda tex: same(tex, expand((3 + 2 * I) * (3 - 2 * I))),
    "ex-read-zeros": lambda tex: same_roots(tex, -2 * (x + 3) * (x - 1) ** 2),
    "check-touch-root": lambda tex: same(tex, even_multiplicity_root()),
    "ex-from-graph": lambda tex: same(tex, from_graph()),
    "check-find-scale": lambda v, tolerance: check_numeric(v, scale_through_point(), sf=3, tolerance=tolerance),
    "check-remainder-linear": lambda tex: same(tex, rem(2 * x**3 + 3 * x**2 - 5 * x + 4, 2 * x + 1, x)),
    "ex-factorise-cubic": lambda tex: fully_factorised(tex, 2 * x**3 + x**2 - 13 * x + 6),
    "ex-two-unknowns": lambda tex: check_assignments(tex, {"a": two_unknowns()[a], "b": two_unknowns()[b]}),
    "check-double-factor": lambda tex: check_assignments(tex, {"p": double_factor()[p], "q": double_factor()[q]}),
    "ex-solve-complex": lambda tex: same_roots(tex, z**3 - z**2 + 3 * z + 5, var=z),
    "check-count-real-roots": lambda tex: same(tex, real_root_count()),
    "ex-box-gdc": lambda tex: check_rounded_list(tex, box_roots(), sf=3),
    "check-solve-cubic": lambda tex: same_roots(tex, x**3 - 3 * x**2 - 10 * x + 24),
    "ex-sum-product-quartic": quartic_sum_product,
    "check-product-cubic": cubic_product,
    "check-sum-squares": lambda tex: same(tex, sum_of_squares()),
    "check-opposite-roots": lambda tex: same(tex, opposite_roots_k()),
    "ex-conjugate-root": lambda tex: check_assignments(tex, conjugate_root()),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-find-scale": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
