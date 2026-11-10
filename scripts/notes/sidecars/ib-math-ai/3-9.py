"""SymPy assertions for IB Maths AI lesson 3.9 (matrix transformations). Not shipped to the browser.

Why a sidecar: no declarative verify kind reads a 2 x 2 matrix (`vector` reads a single column only), and one check
asks which product of named matrices combines two transformations. Every matrix in the published text is read row by
row (rows split on \\\\, elements on &) and must equal the truth element for element. Truths are built here from the
booklet's rotation and reflection matrices with each question's own angles. Every other block uses its own `verify`.
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, cos, pi, simplify, sin

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import parse_matrices  # noqa: E402



def _matrices(tex):
    """Every matrix in the text, in order, each times any scalar written before it (mathparse.parse_matrices: text
    outside the matrices that isn't a label or that scalar is refused, and entries keep + C)."""
    return [matrix for _, matrix in parse_matrices(tex)]


def matrices(*truths):
    """The published text holds exactly these matrices, in this order."""
    def check(tex):
        published = _matrices(tex)
        if len(published) != len(truths):
            raise AssertionError(f"{tex!r} has {len(published)} matrices, {len(truths)} expected")
        for got, want in zip(published, truths):
            if got.shape != want.shape:
                raise AssertionError(f"order {got.shape} is not {want.shape}")
            if any(simplify(a - b) != 0 for a, b in zip(got, want)):
                raise AssertionError(f"published {got.tolist()} is not {want.tolist()}")
    return check


_PRODUCT = re.compile(r"\s*\$\s*([A-Z])\s*([A-Z])\s*\$\s*\Z")


def product(first, second):
    """The published text is the product of two named matrices for `first` followed by `second`: second on the left.
    Any other text (the reverse order, a sum) is a wrong answer, not an unreadable one."""
    def check(tex):
        match = _PRODUCT.match(tex)
        if not match:
            raise AssertionError(f"{tex!r} is not a product of two named matrices")
        if (match.group(1), match.group(2)) != (second, first):
            raise AssertionError(f"{match.group(1)}{match.group(2)} is not {second}{first}")
    return check


def rotation_anticlockwise(theta):
    return Matrix([[cos(theta), -sin(theta)], [sin(theta), cos(theta)]])


def reflection(theta):
    """Reflection in y = (tan theta) x, from the booklet."""
    return Matrix([[cos(2 * theta), sin(2 * theta)], [sin(2 * theta), -cos(2 * theta)]])


DEG = pi / 180
R_90 = rotation_anticlockwise(90 * DEG)  # 90 degrees anticlockwise about the origin
M_X_AXIS = reflection(0)  # mirror line y = 0

CHECKS = {
    # rotate first, then reflect in the x-axis: M R
    "ex-rotate-then-reflect": matrices(M_X_AXIS * R_90),
    # y = -x makes 135 degrees with the positive x-axis
    "check-reflect-negative-diagonal": matrices(reflection(135 * DEG)),
    # reflect with Y first, then stretch with S
    "check-product-order": product("Y", "S"),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
