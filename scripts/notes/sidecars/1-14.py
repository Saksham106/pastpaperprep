"""SymPy assertions for lesson 1.14 (complex roots and De Moivre's theorem). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed here from each question's own data: roots by SymPy's solve/roots on the polynomial, powers by
expanding, identities by expand_trig, and roots of z^n = w by solving the polynomial z^n - w.
"""
import re
import sys
from pathlib import Path

from sympy import (
    I, Poly, Symbol, conjugate, cos, exp, expand, expand_complex, expand_trig, im, pi, re as sre, roots, simplify, sin, solve, sqrt, symbols,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer, parse_list  # noqa: E402

z = symbols("z")
theta, n, m = Symbol("theta"), Symbol("n"), Symbol("m")


def is_zero(expr):
    """Exact zero test for a complex expression (cis forms, surds and trig of rational multiples of pi)."""
    d = expand_complex(expr)
    return simplify(sre(d)) == 0 and simplify(im(d)) == 0


def same(tex, truth):
    published = parse_answer(tex)
    if not is_zero(published - truth):
        raise AssertionError(f"published {published} is not {truth}")


def trig_zero(expr):
    """Exact zero test for a trig expression in theta: rewrite every cos and sin with exponentials, then simplify."""
    return simplify(expand(expr.rewrite(exp))) == 0


def same_identity(tex, truth):
    """A trig identity in theta: the published right-hand side minus the truth expands to 0."""
    published = parse_answer(tex)
    if not trig_zero(published - truth):
        raise AssertionError(f"published {published} is not identically {truth}")


def same_roots(tex, truths):
    """Several exact roots of one equation, in any order, matched one to one with the true roots."""
    if re.search(r"\\text\{\s*or\s*\}|\\pm|,", tex):
        published = parse_list(tex)
    else:
        published = [parse_answer(tex)]  # a single root offered where several are needed: readable, so judged below
    remaining = list(truths)
    if len(published) != len(remaining):
        raise AssertionError(f"published {len(published)} roots, truth has {len(remaining)}")
    for value in published:
        match = next((t for t in remaining if is_zero(value - t)), None)
        if match is None:
            raise AssertionError(f"published root {value} is not one of {remaining}")
        remaining.remove(match)


def all_roots(poly_expr):
    """Every root of a polynomial in z, with multiplicity, from SymPy's own root finder."""
    found = roots(Poly(poly_expr, z))
    out = [r for r, mult in found.items() for _ in range(mult)]
    assert len(out) == Poly(poly_expr, z).degree(), "SymPy did not find every root"
    return out


def remaining_roots(poly_expr, known):
    out = all_roots(poly_expr)
    for k in known:
        match = next(r for r in out if is_zero(r - k))
        out.remove(match)
    return out


# --- numbers from the questions -------------------------------------------------------------------------------

def smallest_positive_real_power(w, limit=60):
    """ex-smallest-n-positive-real: the first n >= 1 with w^n real and positive, found by expanding powers."""
    for k in range(1, limit):
        value = expand(w**k)
        if im(value) == 0 and sre(value) > 0:
            return k
    raise RuntimeError("no such n below the limit")


def cubic_constant_d():
    """check-cubic-constant: monic cubic with roots -3, 2 - i and (by the conjugate rule) 2 + i; d is its constant."""
    cubic = expand((z + 3) * (z - (2 - I)) * (z - (2 + I)))
    return Poly(cubic, z).coeff_monomial(1)


def quartic_p():
    """check-quartic-p: p from the question's data alone. -1 + 3i is a root of z^4 - 2z^3 + 5z^2 + pz + 30, so
    substituting it gives a linear equation in p; its real and imaginary parts must both vanish, which forces a
    single real p. Cross-check: multiplying out the conjugate pair and the real roots 1, 3 reproduces the
    question's other coefficients 1, -2, 5, 30 and this p."""
    p = Symbol("p", real=True)
    w = -1 + 3 * I
    condition = expand(w**4 - 2 * w**3 + 5 * w**2 + p * w + 30)
    solutions = solve([sre(condition), im(condition)], p, dict=True)
    assert len(solutions) == 1, f"expected one real p, got {solutions}"
    truth = solutions[0][p]
    quartic = expand((z - w) * (z - conjugate(w)) * (z - 1) * (z - 3))
    assert Poly(quartic, z).all_coeffs() == [1, -2, 5, truth, 30]
    return truth


def de_moivre_positive(tex):
    """ex-induction-proof: the published right-hand side, with n = 1..10, equals the expanded power. No symbolic
    proof for every n is possible here, so check the first ten cases of the published formula."""
    published = parse_answer(tex)
    if n not in published.free_symbols:
        raise AssertionError(f"{published} does not depend on n")
    for k in range(1, 11):
        power = expand((cos(theta) + I * sin(theta)) ** k)
        if not trig_zero(published.subs(n, k) - power):
            raise AssertionError(f"published formula fails at n = {k}")


def de_moivre_negative(tex):
    """ex-negative-powers: the published right-hand side equals (cos t + i sin t)^(-m) for m = 1..6."""
    published = parse_answer(tex)
    if m not in published.free_symbols:
        raise AssertionError(f"{published} does not depend on m")
    for k in range(1, 7):
        power = (cos(theta) + I * sin(theta)) ** (-k)
        if not trig_zero(published.subs(m, k) - power):
            raise AssertionError(f"published formula fails at m = {k}")


def z_plus_inverse(tex):
    """check-z-plus-inverse: z^3 + z^-3 for z = cos t + i sin t, compared with the published expression."""
    zz = cos(theta) + I * sin(theta)
    truth = zz**3 + zz ** (-3)
    published = parse_answer(tex)
    if not trig_zero(published - truth):
        raise AssertionError(f"published {published} is not z^3 + z^-3")


def rounded_complex_roots(tex, poly_expr, sf=3):
    """ex-cube-roots-calculator: each root is exact `a + b i` (with =) or rounded `a + b i` (with \\approx), every
    rounded part to `sf` figures. An exact root must make the polynomial exactly 0. Rounded roots are matched to
    SymPy's 30-digit numerical roots of the polynomial by nearest value."""
    pieces = [p.strip() for p in re.split(r"\\text\{\s*or\s*\}", tex.replace("$", ""))]
    remaining = Poly(poly_expr, z).nroots(n=30)
    if len(pieces) != len(remaining):
        raise AssertionError(f"published {len(pieces)} roots, truth has {len(remaining)}")
    for piece in pieces:
        if "\\approx" in piece:
            rhs = piece.split("\\approx", 1)[1].strip()
            match = re.fullmatch(r"(-?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\\mathrm\{i\}", rhs)
            if not match:
                raise ValueError(f"cannot read {piece!r} as a rounded a + b i")
            real_text, sign, imag_text = match.groups()
            approx = complex(float(real_text), float(sign + imag_text))
            truth = min(remaining, key=lambda t: abs(complex(t) - approx))
            check_rounded(f"x \\approx {real_text}", sre(truth), sf=sf)
            check_rounded(f"y \\approx {'-' if sign == '-' else ''}{imag_text}", im(truth), sf=sf)
        else:
            value = parse_answer(piece)
            if not is_zero(expand(poly_expr.subs(z, value))):
                raise AssertionError(f"published exact root {value} does not satisfy the equation")
            truth = min(remaining, key=lambda t: abs(complex(t) - complex(value.evalf())))
        remaining.remove(truth)


def rational_power_values(w, p, q):
    """check-rational-power: the q values of w^(p/q), p/q in lowest terms, are the q roots of z^q = w^p. Cross-check
    against the lesson's method: raising each root of z^q = w to the power p gives the same set."""
    truth = all_roots(z**q - expand(w**p))
    by_method = [expand_complex(expand(r**p)) for r in all_roots(z**q - w)]
    assert len(truth) == len(by_method) and all(any(is_zero(t - b) for b in by_method) for t in truth)
    return truth


INDUCTION_PARTS = {
    "basis": "Showing it is true for $n = 1$",
    "assumption": "Assuming it is true for $n = k$",
    "step": "Showing it is true for $n = k + 1$",
    "conclusion": "Concluding it is true for all $n \\in \\mathbb{Z}^{+}$",
}


def missing_induction_part():
    """before-induction-parts: the outline proves 2 + 4 + ... + 2n = n(n + 1). It has an assumption (n = k), a step
    (adding 2(k + 1) to k(k + 1) gives (k + 1)(k + 2), checked here) and a conclusion. The basis n = 1 is true
    (2 = 1 * 2, checked here) but the outline never states it, so the basis is the missing part."""
    k = Symbol("k")
    assert expand(k * (k + 1) + 2 * (k + 1) - (k + 1) * (k + 2)) == 0, "the outline's inductive step is wrong"
    assert 2 * 1 == 1 * (1 + 1), "the statement fails at n = 1"
    present = {"assumption", "step", "conclusion"}
    missing = [part for part in INDUCTION_PARTS if part not in present]
    assert missing == ["basis"]
    return INDUCTION_PARTS[missing[0]]


def word_is(text, truth):
    if text.strip() not in INDUCTION_PARTS.values():
        raise ValueError(f"cannot read {text!r} as a part of an induction proof")
    if text.strip() != truth:
        raise AssertionError(f"{text!r} is not the missing part ({truth!r})")


W_FOURTH = expand((3 + I) ** 4)  # check-another-fourth-root: w is defined by its known root 3 + i


def is_fourth_root(tex):
    value = parse_answer(tex)
    if is_zero(value - (3 + I)):
        raise AssertionError("that is the root you were given")
    if not is_zero(expand(value**4) - W_FOURTH):
        raise AssertionError(f"{value}^4 is {expand(value**4)}, not w = {W_FOURTH}")


CHECKS = {
    "before-polar-form": lambda tex: same(tex, 1 - I),
    "before-induction-parts": lambda text: word_is(text, missing_induction_part()),
    "before-binomial-coefficient": lambda v, tolerance: check_numeric(
        v, Poly(expand((2 + z) ** 5), z).coeff_monomial(z**2), sf=3, tolerance=tolerance),
    "ex-cubic-given-root": lambda tex: same_roots(tex, remaining_roots(z**3 - 5 * z**2 + 11 * z - 15, [1 + 2 * I])),
    # Real coefficients force the conjugate of the non-real root to be the third root.
    "check-third-root": lambda tex: same(tex, conjugate(-4 + 7 * I)),
    "ex-quartic-sum-product": lambda tex: same_roots(
        tex, remaining_roots(z**4 - 2 * z**3 + 5 * z**2 + quartic_p() * z + 30, [-1 + 3 * I])),
    "check-quartic-p": lambda v, tolerance: check_numeric(v, quartic_p(), sf=3, tolerance=tolerance),
    "check-cubic-constant": lambda v, tolerance: check_numeric(v, cubic_constant_d(), sf=3, tolerance=tolerance),
    "ex-power-one-plus-i": lambda tex: same(tex, expand((1 + I) ** 10)),
    "check-power-third-quadrant": lambda tex: same(tex, expand((-sqrt(3) - I) ** 5)),
    "ex-smallest-n-positive-real": lambda tex: same(tex, smallest_positive_real_power(-2 + 2 * I)),
    "ex-cos-four-theta": lambda tex: same_identity(tex, cos(4 * theta)),
    "check-sin-four-theta": lambda tex: same_identity(tex, sin(4 * theta)),
    "ex-induction-proof": de_moivre_positive,
    "ex-negative-powers": de_moivre_negative,
    "check-negative-power": lambda tex: same(tex, expand_complex((cos(pi / 9) + I * sin(pi / 9)) ** -3)),
    "check-z-plus-inverse": z_plus_inverse,
    "ex-fourth-roots": lambda tex: same_roots(tex, all_roots(z**4 - (-8 - 8 * sqrt(3) * I))),
    "check-cube-roots-minus-27i": lambda tex: same_roots(tex, all_roots(z**3 + 27 * I)),
    "ex-cube-roots-calculator": lambda tex: rounded_complex_roots(tex, z**3 - (2 + 11 * I)),
    "check-another-fourth-root": is_fourth_root,
    "check-rational-power": lambda tex: same_roots(tex, rational_power_values(8 * I, 2, 3)),
}


NUMERIC = {
    "before-binomial-coefficient": {"sf": 3},
    "check-quartic-p": {"sf": 3},
    "check-cubic-constant": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
