"""SymPy assertions for lesson 1.13 (complex numbers in polar form). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is the complex number built from the question's own data (the Cartesian number to convert, or the product,
quotient or sum of the given numbers). A polar or Euler answer is checked for its FORM as well as its value: the
published modulus must be positive and equal |truth|, the published argument must lie in -pi < theta <= pi, and
r(cos theta + i sin theta) must equal the truth. So an answer with the right value but an out-of-range argument
(e.g. 2*sqrt(2) e^(5 pi i / 4) for -2 - 2i) is wrong, as it is in the exam. A Cartesian answer must be written
a + bi (no cis, no e^) and equal the truth.
"""
import re
import sys
from pathlib import Path

from sympy import Abs, I, atan2, N, Rational, arg, cos, exp, expand_complex, im, pi, re as re_part, simplify, sin, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402


def cis(theta):
    return cos(theta) + I * sin(theta)


def _rhs(tex, sep="="):
    body = tex.strip().strip("$").strip()
    if sep not in body:
        raise ValueError(f"{tex!r} has no {sep!r}")
    return body.rsplit(sep, 1)[1].strip()


def _rhs_or_all(tex):
    body = tex.strip().strip("$").strip()
    return body.rsplit("=", 1)[1].strip() if "=" in body else body


def _equal(a, b):
    """Exact comparison of two complex values; a high-precision numeric fallback only when simplify can't decide."""
    difference = expand_complex(a - b)
    if simplify(difference) == 0:
        return True
    return abs(N(difference, 60)) < Rational(1, 10**45)


def _check_r_theta(r, theta, truth, tex):
    if not (r.is_real and r.is_positive):
        raise AssertionError(f"{tex!r}: modulus {r} is not a positive real number")
    if not theta.is_real:
        raise AssertionError(f"{tex!r}: argument {theta} is not real")
    if not _equal(r, Abs(truth)):
        raise AssertionError(f"{tex!r}: modulus {r} is not |truth| = {Abs(truth)}")
    if not (bool(theta > -pi) and bool(theta <= pi)):
        raise AssertionError(f"{tex!r}: argument {theta} is outside -pi < theta <= pi")
    if not _equal(r * cis(theta), truth):
        raise AssertionError(f"{tex!r}: {r} cis {theta} is not {truth}")


def polar(tex, truth):
    """`... = r\\,\\mathrm{cis}\\,theta` with r > 0, -pi < theta <= pi, equal to truth."""
    rhs = _rhs_or_all(tex)
    match = re.fullmatch(r"(.*?)\\,\s*\\mathrm\{cis\}\s*(?:\\,)?(.*)", rhs, re.S)
    if not match:
        raise AssertionError(f"{tex!r} is not in the form r cis theta")
    r = parse_answer(match.group(1)) if match.group(1).strip() else 1
    theta = parse_answer(match.group(2))
    _check_r_theta(r, theta, truth, tex)


def euler(tex, truth):
    """`... = r\\mathrm{e}^{theta\\mathrm{i}}` with r > 0, -pi < theta <= pi, equal to truth."""
    rhs = _rhs_or_all(tex)
    match = re.fullmatch(r"(.*?)\\mathrm\{e\}\^\{(.*)\}", rhs, re.S)
    if not match or "\\mathrm{i}" not in match.group(2):
        raise AssertionError(f"{tex!r} is not in the form r e^(i theta)")
    r = parse_answer(match.group(1)) if match.group(1).strip() else 1
    theta = simplify(parse_answer(match.group(2)) / I)
    _check_r_theta(r, theta, truth, tex)


def euler_rounded(tex, truth, exact_r=False):
    """`... \\approx r\\mathrm{e}^{theta\\mathrm{i}}` with theta (and r unless exact) to 3 s.f., ROUND_HALF_UP of the truth."""
    rhs = _rhs(tex, "\\approx")
    match = re.fullmatch(r"(-?[0-9.]+)\s*\\mathrm\{e\}\^\{\s*(-?[0-9.]+)\s*\\mathrm\{i\}\s*\}", rhs)
    if not match:
        raise ValueError(f"{tex!r} is not a rounded r e^(theta i)")
    # Build the modulus and argument from the truth's real and imaginary parts, which are real by construction
    # (N(Abs(...)) can leave a 1e-57 imaginary residue that Decimal can't read).
    x_part, y_part = re_part(expand_complex(truth)), im(expand_complex(truth))
    true_r, true_theta = sqrt(x_part**2 + y_part**2), atan2(y_part, x_part)
    if exact_r:
        r = parse_answer(match.group(1))
        if not _equal(r, Abs(truth)):
            raise AssertionError(f"{tex!r}: modulus {r} is not {Abs(truth)}")
    else:
        check_rounded(f"r \\approx {match.group(1)}", true_r, sf=3)
    check_rounded(f"\\theta \\approx {match.group(2)}", true_theta, sf=3)


def cartesian(tex, truth):
    """`... = a + b\\mathrm{i}`: no cis, no exponential, equal to truth."""
    rhs = _rhs_or_all(tex)
    if "cis" in rhs or "\\mathrm{e}" in rhs:
        raise AssertionError(f"{tex!r} is not in Cartesian form")
    value = parse_answer(rhs)
    if im(expand_complex(value)).has(I) or not _equal(value, truth):
        raise AssertionError(f"{tex!r}: {value} is not {truth}")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


CHECKS = {
    # Before you start
    "before-modulus": lambda v, tolerance: check_numeric(v, Abs(-5 + 12 * I), sf=3, tolerance=tolerance),
    "before-exact-cos": lambda tex: same(tex, cos(5 * pi / 6)),
    "before-radians": lambda tex: same(tex, 135 * pi / 180),
    # Polar form: the Cartesian number in the question is the truth
    "ex-polar-first-quadrant": lambda tex: polar(tex, 4 + 4 * I),
    "ex-polar-third-quadrant": lambda tex: polar(tex, -6 - 2 * sqrt(3) * I),
    "check-polar-second-quadrant": lambda tex: polar(tex, -sqrt(2) + sqrt(6) * I),
    "ex-polar-to-cartesian": lambda tex: cartesian(tex, 6 * cis(-2 * pi / 3)),
    "check-cis-to-cartesian": lambda tex: cartesian(tex, 8 * cis(5 * pi / 6)),
    # Euler form
    "ex-euler-axis": lambda tex: euler(tex, -5 * I),
    "check-euler-third-quadrant": lambda tex: euler(tex, -2 - 2 * I),
    "ex-euler-decimal": lambda tex: euler_rounded(tex, -4 + 3 * I, exact_r=True),
    "check-arg-decimal": lambda v, tolerance: check_numeric(v, arg(-1 - 3 * I), sf=3, tolerance=tolerance),
    # Multiplying and dividing: truth is the product or quotient of the given numbers
    "ex-multiply-euler": lambda tex: euler(tex, 3 * exp(pi * I / 4) * 2 * exp(pi * I / 3)),
    "check-divide-euler": lambda tex: euler(tex, 8 * exp(pi * I / 8) / (2 * exp(5 * pi * I / 8))),
    "ex-multiply-reduce": lambda tex: polar(tex, 4 * cis(3 * pi / 4) * Rational(1, 2) * cis(2 * pi / 3)),
    "ex-divide-mixed": lambda tex: polar(tex, (-5 - 5 * I) / (5 * cis(pi / 3))),
    # Adding and the Argand diagram
    "ex-add-polar": lambda tex: polar(tex, 3 * cis(pi / 4) + 3 * cis(3 * pi / 4)),
    "ex-add-gdc": lambda tex: euler_rounded(tex, 4 * exp(Rational(9, 10) * I) + 1 - 2 * I),
    "check-rotate": lambda tex: cartesian(tex, (5 - I) * exp(-pi * I / 2)),
    "check-distance": lambda v, tolerance: check_numeric(v, Abs(5 * exp(pi * I / 2) - (-1 + I)), sf=3, tolerance=tolerance),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"before-modulus": {"sf": 3}, "check-arg-decimal": {"sf": 3}, "check-distance": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
