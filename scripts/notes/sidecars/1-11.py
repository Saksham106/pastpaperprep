"""SymPy assertions for lesson 1.11 (Partial fractions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

A split is checked two ways: the published sum must equal the question's own fraction (SymPy simplifies the
difference to 0), and it must really be partial fractions: exactly two terms, each a constant over one linear factor
of the question's denominator. Partial fractions are unique, so together these pin down A and B. Constants asked for
on their own are found by solving the coefficient equations of the identity with SymPy.
"""
import sys
from pathlib import Path

from sympy import Add, Poly, Rational, cancel, expand, fraction, roots, simplify, solve, symbols, together

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, parse_answer  # noqa: E402

x, a, b, A, B = symbols("x a b A B")


def published(tex):
    """The answer after its last = (lessons write the split as an identity with \\equiv)."""
    return parse_answer(tex.replace("\\equiv", "="))


def split(tex, numerator, factor1, factor2, fixed_form=False):
    """`tex` must be the partial fractions of numerator / (factor1 * factor2).

    With fixed_form, each denominator must be exactly factor1 or factor2 (the form the question asks for, e.g. 2 - x);
    otherwise any constant multiple of a factor is accepted (e.g. 2(x - 2) for x - 2)."""
    value = published(tex)
    truth = numerator / (factor1 * factor2)
    if simplify(value - truth) != 0:
        raise AssertionError(f"published {value} is not equal to {truth}")
    terms = Add.make_args(value)
    if len(terms) != 2:
        raise AssertionError(f"published {value} is not two partial fractions")
    seen = []
    for term in terms:
        top, bottom = fraction(together(term))
        if top.has(x):
            raise AssertionError(f"numerator {top} of {term} is not a constant")
        match = None
        for factor in (factor1, factor2):
            ratio = cancel(bottom / factor)
            exact = expand(bottom - factor) == 0
            if (exact if fixed_form else not ratio.has(x)):
                match = factor
        if match is None:
            raise AssertionError(f"denominator {bottom} of {term} is not one of the factors {factor1}, {factor2}")
        seen.append(match)
    if len(set(seen)) != 2:
        raise AssertionError(f"published {value} does not use both factors")


def constants(numerator, factor1, factor2):
    """A over factor1 and B over factor2: solve the coefficient equations of numerator == A*factor2 + B*factor1."""
    identity = Poly(expand(numerator - A * factor2 - B * factor1), x)
    solution = solve(identity.all_coeffs(), [A, B], dict=True)
    assert len(solution) == 1
    return solution[0][A], solution[0][B]


def qualifies(tex):
    """check-which-fraction: a proper fraction whose denominator has exactly two different real linear factors."""
    top, bottom = fraction(cancel(published(tex)))
    top_poly, bottom_poly = Poly(top, x), Poly(bottom, x)
    found = roots(bottom_poly)
    two_distinct_real = (
        bottom_poly.degree() == 2 and len(found) == 2 and all(m == 1 and r.is_real for r, m in found.items())
    )
    if not (two_distinct_real and top_poly.degree() < bottom_poly.degree()):
        raise AssertionError(f"{top}/{bottom} cannot be split into two partial fractions in this course")


def factorised(tex, quadratic):
    """before-factorise: a product of brackets equal to the quadratic."""
    value = published(tex)
    if not value.is_Mul:
        raise AssertionError(f"published {value} is not factorised")
    if expand(value - quadratic) != 0:
        raise AssertionError(f"published {value} does not expand to {quadratic}")


def identity_constants(tex):
    """before-identity: 5x - 1 == a(x + 2) + b for every x; solve the coefficient equations."""
    coeffs = Poly(expand(5 * x - 1 - (a * (x + 2) + b)), x).all_coeffs()
    solution = solve(coeffs, [a, b], dict=True)[0]
    check_assignments(tex, {a: solution[a], b: solution[b]})


def a_value(v, tolerance):
    """check-split-half: A over 2x + 1 in (8x - 1)/((2x + 1)(x - 2))."""
    truth, _ = constants(8 * x - 1, 2 * x + 1, x - 2)
    check_numeric(v, truth, sf=3, tolerance=tolerance)


CHECKS = {
    "before-factorise": lambda tex: factorised(tex, x**2 - 2 * x - 15),
    "before-identity": identity_constants,
    "check-which-fraction": qualifies,
    "ex-split-roots": lambda tex: split(tex, 4 * x + 10, x - 5, x + 1),
    "check-split-x": lambda tex: split(tex, 8, x, x - 4),
    "ex-split-nonmonic": lambda tex: split(tex, 5 * x + 8, 2 * x - 1, x + 3),
    "check-split-half": a_value,
    "ex-coeff-compare": lambda tex: split(tex, 18 - x, x - 2, x + 6),
    "ex-given-form": lambda tex: split(tex, 3 * x + 1, 2 - x, x + 5, fixed_form=True),
    # 3x^2 - 12 = 3(x - 2)(x + 2): the 3 goes with the numerator, so the fraction is 2 / ((x - 2)(x + 2)).
    "check-common-factor": lambda tex: split(tex, Rational(6, 3), x - 2, x + 2),
    "check-given-form": lambda tex: split(tex, 5 * x, x + 1, 4 - x, fixed_form=True),
}

# check-split-half is an exact integer; 3 s.f. holds its tolerance (0) to at most half a unit.
NUMERIC = {"check-split-half": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
