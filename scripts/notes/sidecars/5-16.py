"""SymPy assertions for lesson 5.16 (integration by substitution and parts). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data: an indefinite integral is checked by differentiating the
published answer back to the integrand; a definite integral is compared with SymPy's own exact integral.
"""
import re
import sys
from pathlib import Path

from sympy import (
    Rational, atan, cos, diff, exp, integrate, log, nsolve, pi, sec, simplify, sin, sqrt, symbols, tan,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_antiderivative, check_numeric, check_rounded, parse_answer  # noqa: E402

x, k = symbols("x k")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def antiderivative(tex, integrand):
    """An indefinite integral: must end with + C, and differentiate back to the integrand at sample points."""
    if not re.search(r"\+\s*C\s*\$?\s*$", tex):
        raise AssertionError(f"{tex!r} has no + C")
    check_antiderivative(tex, integrand)


def definite(tex, integrand, a, b):
    """A definite integral: the published value must equal SymPy's exact integral of the question's integrand."""
    same(tex, integrate(integrand, (x, a, b)))


def x_sec2_value():
    """check-parts-x-sec2. SymPy's integral comes back as log(sqrt(2)/2) + pi/4; confirm it independently too:
    F = x tan x + ln(cos x) differentiates to x sec^2 x, and F(pi/4) - F(0) must agree with integrate()."""
    exact = integrate(x * sec(x) ** 2, (x, 0, pi / 4))
    F = x * tan(x) + log(cos(x))
    assert simplify(diff(F, x) - x * sec(x) ** 2) == 0
    assert simplify(F.subs(x, pi / 4) - F.subs(x, 0) - exact) == 0
    return exact


def k_value():
    """ex-parts-solve-k: k > 0 with integral_0^k x e^(-x) dx = 1/2. No closed form, so SymPy builds the integral
    in k and solves it numerically (30 digits); the root must be positive and satisfy the equation."""
    area = integrate(x * exp(-x), (x, 0, k))
    root = nsolve(area - Rational(1, 2), k, 2, prec=30)
    assert root > 0
    assert abs(area.subs(k, root) - Rational(1, 2)) < 1e-20
    return root


CHECKS = {
    "before-integrate-linear": lambda tex: antiderivative(tex, sin(4 * x)),
    "before-diff-arctan": lambda tex: same(tex, diff(atan(x), x)),
    "before-definite-root": lambda v, tolerance: check_numeric(v, integrate(3 / sqrt(x), (x, 1, 4)), sf=3, tolerance=tolerance),
    "ex-sub-linear-power": lambda tex: antiderivative(tex, x * (2 * x - 1) ** 4),
    "check-sub-root": lambda tex: antiderivative(tex, 1 / (x + sqrt(x))),
    "ex-sub-exp-definite": lambda tex: definite(tex, exp(2 * x) / (exp(x) + 1), 0, log(3)),
    "check-sub-flip-limits": lambda tex: definite(tex, x / sqrt(4 - x), 0, 3),
    "ex-parts-x-cos3x": lambda tex: antiderivative(tex, x * cos(3 * x)),
    "ex-parts-arctan": lambda tex: antiderivative(tex, atan(x)),
    "check-parts-ln-shift": lambda tex: antiderivative(tex, log(x + 2)),
    "ex-parts-solve-k": lambda tex: check_rounded(tex, k_value(), sf=3),
    "check-parts-x-sec2": lambda tex: same(tex, x_sec2_value()),
    "ex-repeat-x2-cos": lambda tex: antiderivative(tex, x**2 * cos(x)),
    "ex-repeat-cyclic": lambda tex: antiderivative(tex, exp(2 * x) * cos(x)),
    "check-repeat-x2-exp": lambda tex: antiderivative(tex, x**2 * exp(-x)),
    "check-repeat-cyclic": lambda tex: antiderivative(tex, exp(x) * sin(2 * x)),
    "ex-combo-sin-root": lambda tex: antiderivative(tex, sin(sqrt(x))),
    "ex-combo-x3-ex2": lambda tex: definite(tex, x**3 * exp(x**2), 0, 1),
    "check-combo-x3-cos": lambda tex: antiderivative(tex, x**3 * cos(x**2)),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"before-definite-root": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
