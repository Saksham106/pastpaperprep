"""SymPy assertions for IB Maths AI lesson 1.14 (matrices, determinants and inverses). Not shipped to the browser.

Why a sidecar: no declarative verify kind reads a matrix with more than one column (`vector` reads a single column
only). Each id here has an answer (or option) that is one or more matrices written as pmatrix. Every matrix in the
published text is read in order, row by row (rows split on \\\\, elements on &), and must equal the matching truth
element for element, with the same order (rows x columns). Truths are computed here from each question's own data:
sums, scalar multiples, products and inverses of the matrices in the question. Every other block uses its own
`verify` block.
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, Rational, simplify

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import parse_answer  # noqa: E402

_PMATRIX = re.compile(r"\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}", re.S)


def _matrices(tex):
    """Every pmatrix in the text, in order, as SymPy matrices."""
    found = []
    for body in _PMATRIX.findall(tex):
        rows = [row for row in re.split(r"\\\\", body) if row.strip()]
        parsed = [[parse_answer(entry.strip()) for entry in row.split("&")] for row in rows]
        widths = {len(row) for row in parsed}
        if len(widths) != 1:
            raise ValueError(f"ragged matrix in {tex!r}")
        found.append(Matrix(parsed))
    if not found:
        raise ValueError(f"no matrix in {tex!r}")
    return found


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


_ORDER = re.compile(r"\s*\$?\s*(\d+)\s*\\times\s*(\d+)\s*\$?\s*\Z")


def order(rows, columns):
    """The published text is the order `rows \\times columns`, rows first. Any other text (a single number such as the
    count of elements, or the order the wrong way round) is a wrong answer, not an unreadable one."""
    def check(tex):
        match = _ORDER.match(tex)
        if not match:
            raise AssertionError(f"{tex!r} is not an order m x n")
        if (int(match.group(1)), int(match.group(2))) != (rows, columns):
            raise AssertionError(f"order {match.group(1)} x {match.group(2)} is not {rows} x {columns}")
    return check


def product_order(a, b):
    """Order of AB from the orders of A and B; the product must exist."""
    if a[1] != b[0]:
        raise ValueError(f"no product of orders {a} and {b}")
    return order(a[0], b[1])


def q(text):
    """An exact decimal from its text, so 3.20 is 16/5."""
    return Rational(text)


# Data from each question
M_ORDER = (2, 3)
S = Matrix([[12, 7, 4], [9, 11, 6]])
T = Matrix([[15, 5, 3], [8, 13, 9]])
PIZZA = Matrix([[q("8.50"), q("11.00"), q("14.50")], [q("9.00"), q("12.50"), q("15.00")]])
M_FURN = Matrix([[4, 1, 1], [9, 2, 3], [6, 1, 2]])
C_FURN = Matrix([[q("7.50"), q("6.60")], [q("3.20"), q("4.10")], [q("11.00"), q("13.40")]])
ORDER = Matrix([[10, 4, 6]])
A_SWAP = Matrix([[2, 1], [0, 3]])
B_SWAP = Matrix([[1, 4], [2, -1]])
P_CINEMA = Matrix([[11, 7, 9]])
W1 = Matrix([[120, 95], [64, 80], [30, 22]])
W2 = Matrix([[134, 88], [70, 91], [25, 30]])
A_INV = Matrix([[5, 3], [4, 2]])
K_ROAD = Matrix([[3, 1], [5, 2]])
ROAD = Matrix([[18, 1], [15, 4]])  # columns RO, AD with A = 1, ..., Z = 26
K_MAPS = Matrix([[2, 3], [1, 2]])
C_MAPS = Matrix([[29, 89], [15, 54]])  # received 29, 15, 89, 54 column by column

CHECKS = {
    # 5 students (one row each) by 3 tests
    "check-order": order(5, 3),
    # A is 2 x 3, B is 3 x 4
    "check-defined": product_order((2, 3), (3, 4)),
    # I M = M with M of order 2 x 3: I is square with as many columns as M has rows
    "check-identity-order": order(M_ORDER[0], M_ORDER[0]),
    "ex-bike-weeks": matrices(S + T),
    "ex-pizza-prices": matrices(q("1.06") * PIZZA),
    "ex-furniture-suppliers": matrices(ORDER * (M_FURN * C_FURN)),
    "ex-swap-order": matrices(A_SWAP * B_SWAP, B_SWAP * A_SWAP),
    "ex-cinema-two-weeks": matrices(P_CINEMA * (W1 + W2)),
    "ex-inverse-2x2": matrices(A_INV.inv()),
    # system 4x - y = 9, x + 3y = 12: coefficients row by row
    "check-coefficient-matrix": matrices(Matrix([[4, -1], [1, 3]])),
    "ex-encode-road": matrices(K_ROAD * ROAD),
    "ex-decode-maps": matrices(K_MAPS.inv() * C_MAPS),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
