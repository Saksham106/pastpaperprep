"""SymPy assertions for IB Maths AI lesson 1.13 (complex numbers in polar and exponential form). Not shipped to the browser.

Why a sidecar: no declarative verify kind checks the FORM of a complex answer. Here a polar or exponential answer must
have a positive modulus equal to |truth|, an argument in -pi < theta <= pi, and r(cos theta + i sin theta) equal to the
truth, so a right value with an out-of-range argument (10 cis(11 pi / 6)) is wrong, as in the exam. A Cartesian answer
must be a + bi (no cis, no e^). Rounded answers are checked part by part to 3 s.f. (ROUND_HALF_UP of the truth), and a
combined sinusoid A cos(wt + B) is checked for its angular frequency, A and B. Every truth is built from the question's
own data. Numeric checks and the one explanation use their own `verify` blocks; only the ids in CHECKS come here.
"""
import re
import sys
from pathlib import Path

from sympy import Abs, Float, I, N, Rational, Symbol, atan2, cos, exp, expand_complex, expand_trig, im, pi, re as re_part, simplify, sin, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import check_rounded, keep_constant, parse_answer  # noqa: E402

t = Symbol("t")


def cis(theta):
    return cos(theta) + I * sin(theta)


def _rhs(tex, sep):
    body = tex.strip().strip("$").strip()
    if sep not in body:
        raise ValueError(f"{tex!r} has no {sep!r}")
    return body.rsplit(sep, 1)[1].strip()


def _rhs_or_all(tex):
    body = tex.strip().strip("$").strip()
    return body.rsplit("=", 1)[1].strip() if "=" in body else body


def _parts(tex):
    """Several answers joined by `,\\;`."""
    return [piece.strip() for piece in tex.strip().strip("$").split(",\\;")]


def _equal(a, b):
    difference = expand_complex(a - b)
    if simplify(difference) == 0:
        return True
    return abs(N(difference, 60)) < Rational(1, 10**45)


def _r_theta(truth):
    x_part, y_part = re_part(expand_complex(truth)), im(expand_complex(truth))
    return sqrt(x_part**2 + y_part**2), atan2(y_part, x_part)


def _exact(expr):
    """Decimals as written (1.5) become exact rationals, so 9 cis 1.5 is compared exactly with 9 e^(1.5i)."""
    return expr.xreplace({f: Rational(str(f)) for f in expr.atoms(Float)}) if hasattr(expr, "atoms") else expr


def _check_r_theta(r, theta, truth, tex):
    r, theta = _exact(r), _exact(theta)
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


def polar_rounded(tex, truth):
    """`... \\approx r\\,\\mathrm{cis}\\,theta` with r exact and theta to 3 s.f."""
    rhs = _rhs(tex, "\\approx")
    match = re.fullmatch(r"([0-9.]+)\s*\\,\s*\\mathrm\{cis\}\s*\\,\s*(-?[0-9.]+)", rhs)
    if not match:
        raise ValueError(f"{tex!r} is not a rounded r cis theta")
    true_r, true_theta = _r_theta(truth)
    if not _equal(_exact(parse_answer(match.group(1))), true_r):
        raise AssertionError(f"{tex!r}: modulus {match.group(1)} is not {true_r}")
    check_rounded(f"\\theta \\approx {match.group(2)}", true_theta, sf=3)


def euler(tex, truth):
    """`... = r\\mathrm{e}^{theta\\mathrm{i}}` with r > 0, -pi < theta <= pi, equal to truth."""
    rhs = _rhs_or_all(tex)
    match = re.fullmatch(r"(.*?)\\mathrm\{e\}\^\{(.*)\}", rhs, re.S)
    if not match or "\\mathrm{i}" not in match.group(2):
        raise AssertionError(f"{tex!r} is not in the form r e^(i theta)")
    r = parse_answer(match.group(1)) if match.group(1).strip() else 1
    theta = simplify(parse_answer(match.group(2)) / I)
    _check_r_theta(r, theta, truth, tex)


def euler_rounded(tex, truth, exact_r=False, bare=False):
    """`... \\approx r\\mathrm{e}^{theta\\mathrm{i}}` with theta (and r unless exact) to 3 s.f. `bare`: a multiple-choice
    option written without \\approx (the prompt asks for 3 s.f.)."""
    rhs = _rhs_or_all(tex) if bare else _rhs(tex, "\\approx")
    match = re.fullmatch(r"([0-9.]+)\s*\\mathrm\{e\}\^\{\s*(-?[0-9.]+)\s*\\mathrm\{i\}\s*\}", rhs)
    if not match:
        raise ValueError(f"{tex!r} is not a rounded r e^(theta i)")
    true_r, true_theta = _r_theta(truth)
    if exact_r:
        if not _equal(_exact(parse_answer(match.group(1))), true_r):
            raise AssertionError(f"{tex!r}: modulus {match.group(1)} is not {true_r}")
    else:
        check_rounded(f"r \\approx {match.group(1)}", true_r, sf=3)
    check_rounded(f"\\theta \\approx {match.group(2)}", true_theta, sf=3)


def cartesian(tex, truth):
    """`... = a + b\\mathrm{i}`: no cis, no exponential, equal to truth."""
    rhs = _rhs_or_all(tex)
    if "cis" in rhs or "\\mathrm{e}" in rhs:
        raise AssertionError(f"{tex!r} is not in Cartesian form")
    value = parse_answer(rhs)
    if not _equal(value, truth):
        raise AssertionError(f"{tex!r}: {value} is not {truth}")


def cartesian_rounded(tex, truth):
    """`... \\approx a + b\\mathrm{i}` with a and b each to 3 s.f."""
    rhs = _rhs(tex, "\\approx").replace(" ", "")
    match = re.fullmatch(r"(-?[0-9.]+)([+-])([0-9.]+)\\mathrm\{i\}", rhs)
    if not match:
        raise ValueError(f"{tex!r} is not a rounded a + bi")
    b_text = ("-" if match.group(2) == "-" else "") + match.group(3)
    check_rounded(f"a \\approx {match.group(1)}", re_part(expand_complex(truth)), sf=3)
    check_rounded(f"b \\approx {b_text}", im(expand_complex(truth)), sf=3)


def sinusoid_rounded(tex, func, omega, amplitude_phase):
    """`... \\approx A\\cos(omega t + B)` (or \\sin): omega exact, A and B to 3 s.f. from the complex amplitude."""
    rhs = _rhs(tex, "\\approx").replace(" ", "")
    match = re.fullmatch(r"([0-9.]+)\\" + func + r"\(([0-9.]+)t([+-])([0-9.]+)\)", rhs)
    if not match:
        raise AssertionError(f"{tex!r} is not a rounded A {func}(omega t + B)")
    if not _equal(parse_answer(match.group(2)), omega):
        raise AssertionError(f"{tex!r}: angular frequency {match.group(2)} is not {omega}")
    true_a, true_b = _r_theta(amplitude_phase)
    b_text = ("-" if match.group(3) == "-" else "") + match.group(4)
    check_rounded(f"A \\approx {match.group(1)}", true_a, sf=3)
    check_rounded(f"B \\approx {b_text}", true_b, sf=3)


def same_wave(tex, truth):
    """An exact combined wave, equal to the truth for every t."""
    published = parse_answer(tex)
    if simplify(expand_trig(published - truth)) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def both(checker, *truths, **options):
    def run(tex):
        pieces = _parts(tex)
        if len(pieces) != len(truths):
            raise AssertionError(f"{tex!r} gives {len(pieces)} answers, {len(truths)} expected")
        for piece, truth in zip(pieces, truths):
            checker(piece, truth, **options)
    return run


CHECKS = {
    # Polar form: the truth is the Cartesian number in the question
    "ex-polar-exact": lambda tex: polar(tex, -3 + 3 * I),
    "check-polar-fourth": lambda tex: polar(tex, 5 * sqrt(3) - 5 * I),
    "ex-robot-polar": lambda tex: polar_rounded(tex, Rational(-42, 10) + Rational(56, 10) * I),
    "ex-cis-to-cartesian": lambda tex: cartesian(tex, 6 * cis(-3 * pi / 4)),
    "check-cis-cartesian": lambda tex: cartesian(tex, 4 * cis(2 * pi / 3)),
    # Exponential form
    "ex-euler-axis": lambda tex: euler(tex, -8 + 0 * I),
    "ex-disc-point": lambda tex: cartesian_rounded(tex, 5 * exp(Rational(24, 10) * I)),
    "check-euler-decimal": lambda tex: euler_rounded(tex, Rational(-24, 10) - 7 * I, exact_r=True, bare=True),
    # Products, quotients and powers: the truth is the product, quotient or power of the given numbers
    "ex-multiply-divide": both(
        euler,
        6 * exp(Rational(4, 10) * I) * Rational(15, 10) * exp(Rational(11, 10) * I),
        6 * exp(Rational(4, 10) * I) / (Rational(15, 10) * exp(Rational(11, 10) * I)),
    ),
    "ex-power-by-hand": lambda tex: cartesian(tex, (1 + sqrt(3) * I) ** 7),
    "check-power-range": lambda tex: euler(tex, (2 * exp(2 * pi * I / 3)) ** 4),
    "ex-gdc-product-power": both(euler_rounded, (4 - I) * (2 + 3 * I), (4 - I) ** 3),
    # Vectors and transformations
    "ex-hike": lambda tex: euler_rounded(tex, Rational(25, 10) * exp(Rational(6, 10) * I) + Rational(18, 10) * exp(Rational(21, 10) * I)),
    "check-rotate": lambda tex: cartesian(tex, (5 + 2 * I) * exp(pi * I / 2)),
    # Adding sinusoids: the truth is the sum of the complex amplitudes
    "ex-ac-voltages": lambda tex: sinusoid_rounded(tex, "cos", 50, 12 + 9 * exp(Rational(12, 10) * I)),
    "ex-sound-waves": lambda tex: sinusoid_rounded(
        tex, "sin", 800, Rational(6, 10) * exp(Rational(3, 10) * I) + Rational(4, 10) * exp(Rational(-11, 10) * I)
    ),
    "check-exact-sum": lambda tex: same_wave(tex, 6 * cos(100 * t) + 6 * cos(100 * t + 2 * pi / 3)),
}

NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    with keep_constant():  # nothing here is an antiderivative: a trailing + C is part of the answer
        CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
