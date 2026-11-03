"""SymPy assertions for lesson 1.12 (complex numbers and the Argand diagram). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data with SymPy's complex arithmetic: sqrt of a negative number,
solve() for the roots of a quadratic, re()/im()/conjugate() for parts, Abs() and arg() for modulus and argument
(SymPy's arg is the principal value in ]-pi, pi], the range the lesson uses).
"""
import re
import sys
from pathlib import Path

from sympy import Abs, I, Rational, arg, atan, conjugate, expand, im, pi, re as re_part, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, check_rounded, parse_answer, parse_list  # noqa: E402

z = symbols("z")


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(expand(published - truth)) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def roots_are(tex, polynomial):
    """The published values (e.g. `z = 3 \\pm 2\\mathrm{i}`) are exactly the roots of the polynomial, as a set."""
    published = parse_list(tex)
    truth = solve(polynomial, z)
    if len(published) != len(truth):
        raise AssertionError(f"published {published}, truth {truth}")
    unmatched = list(truth)
    for value in published:
        match = next((t for t in unmatched if simplify(expand(value - t)) == 0), None)
        if match is None:
            raise AssertionError(f"published {value} is not a root; roots are {truth}")
        unmatched.remove(match)


def root_count_word(tex, a, b, c):
    """Word answer for the number of real roots, decided by the sign of the discriminant computed here."""
    disc = b**2 - 4 * a * c
    truth = "two" if disc > 0 else ("one" if disc == 0 else "none")
    text = tex.lower()
    if "no real" in text:
        published = "none"
    elif "repeated" in text or "one " in text:
        published = "one"
    elif "two" in text:
        published = "two"
    else:
        raise ValueError(f"cannot read a root count in {tex!r}")
    if published != truth:
        raise AssertionError(f"{tex!r} says {published}; the discriminant {disc} gives {truth}")


QUADRANTS = {"first": (1, 1), "second": (-1, 1), "third": (-1, -1), "fourth": (1, -1)}


def quadrant_word(tex, number):
    """Word answer naming the quadrant of `number`, read from the signs of its real and imaginary parts."""
    found = [name for name in QUADRANTS if name in tex.lower()]
    if len(found) != 1:
        raise ValueError(f"cannot read one quadrant in {tex!r}")
    a, b = re_part(number), im(number)
    if a == 0 or b == 0:
        raise AssertionError(f"{number} lies on an axis, not in a quadrant")
    signs = (1 if a > 0 else -1, 1 if b > 0 else -1)
    if QUADRANTS[found[0]] != signs:
        raise AssertionError(f"{number} is not in the {found[0]} quadrant")


def equate_parts(tex, lhs, rhs, unknowns):
    """Real unknowns: equate real and imaginary parts of lhs = rhs (SymPy splits them) and solve the pair."""
    real_part, imag_part = expand(lhs - rhs).as_real_imag()
    solution = solve([real_part, imag_part], unknowns, dict=True)
    assert len(solution) == 1, solution
    check_assignments(tex, {str(symbol): value for symbol, value in solution[0].items()})


def mod_arg_exact(tex, number):
    """`\\lvert z\\rvert = ..., \\; \\arg z = ...`: names kept, values exact."""
    check_assignments(tex, {"|z|": Abs(number), "\\argz": arg(number)})


def mod_arg_rounded(tex, number):
    """`\\lvert z\\rvert \\approx 5.39, \\; \\arg z \\approx -2.76`: each labelled value rounded to 3 s.f."""
    pieces = tex.split(",")
    if len(pieces) != 2:
        raise ValueError(f"{tex!r} should hold a modulus and an argument")
    modulus, argument = pieces
    if not re.search(r"\\lvert\s*z\s*\\rvert", modulus) or not re.search(r"\\arg\s*z", argument):
        raise ValueError(f"{tex!r} should give the modulus first, then the argument")
    check_rounded(modulus, Abs(number), sf=3)
    check_rounded(argument, arg(number), sf=3)


def rectangle_area(tex, number):
    """Area of the polygon z, z*, -z, -z* (in that order), by the shoelace formula on the plotted points."""
    vertices = [number, conjugate(number), -number, -conjugate(number)]
    points = [(re_part(v), im(v)) for v in vertices]
    twice = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]))
    same(tex, Abs(twice) / 2)


def read_parts(tex, number):
    check_assignments(tex, {"\\mathrm{Re}(z)": re_part(number), "\\mathrm{Im}(z)": im(number), "z^{*}": conjugate(number)})


def exact_tan_angle(tex):
    """The angle in ]0, pi/2[ with tan = 1/sqrt(3): atan gives the value in ]-pi/2, pi/2[, and it must lie in range."""
    truth = atan(1 / sqrt(3))
    assert 0 < truth < pi / 2
    same(tex, truth)


CHECKS = {
    "before-discriminant": lambda tex: root_count_word(tex, 2, -3, 4),
    "before-exact-tan": exact_tan_angle,
    "ex-root-negative": lambda tex: same(tex, 3 - sqrt(-20)),
    "ex-quadratic-complex": lambda tex: roots_are(tex, z**2 - 6 * z + 13),
    "check-i-power": lambda tex: same(tex, I**30),
    "check-quadratic-complex": lambda tex: roots_are(tex, z**2 + 4 * z + 29),
    "ex-read-parts": lambda tex: read_parts(tex, sqrt(-18) - 2),
    "ex-equate-parts": lambda tex: equate_parts(tex, (P - 2 * Q) + (P + Q) * I, 8 - I, [P, Q]),
    "check-im-conjugate": lambda tex: same(tex, im(conjugate(6 - 5 * I))),
    "check-equate-parts": lambda tex: equate_parts(tex, (A + B) + (A - B) * I, 4 - 6 * I, [A, B]),
    "ex-plot-conjugate": lambda tex: same(tex, conjugate(-4 + 1 * I)),
    "ex-rectangle-area": lambda tex: rectangle_area(tex, -5 + 2 * I),
    "check-quadrant": lambda tex: quadrant_word(tex, -conjugate(-2 + 5 * I)),
    "check-point-to-number": lambda tex: same(tex, 0 + (-7) * I),
    "ex-mod-arg-basic": lambda tex: mod_arg_exact(tex, 3 - 3 * I),
    "ex-mod-arg-exact": lambda tex: mod_arg_exact(tex, -sqrt(6) + sqrt(2) * I),
    "ex-mod-arg-gdc": lambda tex: mod_arg_rounded(tex, -5 - 2 * I),
    "check-arg-third": lambda tex: same(tex, arg(-3 - sqrt(3) * I)),
    "check-zz-star": lambda v, tolerance: check_numeric(v, expand((1 + 4 * I) * conjugate(1 + 4 * I)), sf=3, tolerance=tolerance),
}

P, Q, A, B = symbols("p q a b", real=True)

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {"check-zz-star": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
