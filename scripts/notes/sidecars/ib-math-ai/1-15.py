"""SymPy assertions for IB Maths AI lesson 1.15 (eigenvalues and eigenvectors). Not shipped to the browser.

Why a sidecar: no declarative verify kind reads a 2 x 2 matrix, a polynomial in lambda, or an eigenvector that is right
up to any non-zero multiple. Here:
  - a characteristic polynomial must equal det(A - lambda I) for the question's own matrix A;
  - an eigenvector must be non-zero and satisfy Av = lambda v (for the stated lambda, when there is one), so any
    non-zero multiple is accepted, as in the mark schemes, and the zero vector is always wrong;
  - a diagonalization P, D must have D diagonal, P invertible and P D P^-1 = A, so any valid column order or scaling is
    accepted and a D whose order does not match P is wrong;
  - a power M^n (entries in n) must equal P D^n P^-1 computed from the question's matrix, proved symbolically entry by
    entry and also checked exactly for n = 0..8.
Decimals as written (0.91) become exact rationals. Every truth is built from the question's own matrix. Blocks not
listed in CHECKS use their own `verify` blocks.
"""
import re
import sys
from pathlib import Path

from sympy import Float, Matrix, Rational, Symbol, diag, expand, simplify

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import parse_answer  # noqa: E402

LAM = Symbol("lambda")
N = Symbol("n")
PMATRIX = re.compile(r"\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}", re.S)


def _exact(expr):
    """Decimals as written become exact rationals; the parsed lambda becomes LAM and n becomes N."""
    expr = expr.xreplace({f: Rational(str(f)) for f in expr.atoms(Float)})
    return expr.xreplace({s: (LAM if s.name == "lambda" else N if s.name == "n" else s) for s in expr.free_symbols})


def _body(tex):
    return tex.strip().strip("$").strip()


def _matrix(inner, tex):
    rows = [row.strip() for row in inner.split("\\\\") if row.strip()]
    try:
        return Matrix([[_exact(parse_answer(entry.strip())) for entry in row.split("&")] for row in rows])
    except ValueError as error:
        raise AssertionError(f"{tex!r}: cannot read a matrix entry ({error})") from error


def _last_matrix(tex):
    found = PMATRIX.findall(tex)
    if not found:
        raise AssertionError(f"{tex!r} has no matrix or column vector")
    return _matrix(found[-1], tex)


def _zero(expr):
    return simplify(expand(expr)) == 0


def _matrices_equal(a, b):
    return a.shape == b.shape and all(_zero(x - y) for x, y in zip(a, b))


def charpoly(A):
    def check(tex):
        rhs = _body(tex).rsplit("=", 1)[-1]
        published = _exact(parse_answer(rhs))
        if LAM not in published.free_symbols:
            raise AssertionError(f"{tex!r} is not a polynomial in lambda")
        truth = (A - LAM * Matrix.eye(2)).det()
        if not _zero(published - truth):
            raise AssertionError(f"{published} is not det(A - lambda I) = {expand(truth)}")
    return check


def eigvec(A, lam=None):
    def check(tex):
        v = _last_matrix(tex)
        if v.shape != (2, 1):
            raise AssertionError(f"{tex!r} is not a column vector with 2 entries")
        if all(_zero(x) for x in v):
            raise AssertionError(f"{tex!r} is the zero vector, which is never an eigenvector")
        Av = A * v
        if lam is not None:
            if not all(_zero(x) for x in Av - lam * v):
                raise AssertionError(f"A v = {list(Av)} is not {lam} v")
        elif not _zero(Av[0] * v[1] - Av[1] * v[0]):
            raise AssertionError(f"A v = {list(Av)} is not a multiple of v = {list(v)}")
    return check


def eigpairs(A):
    """`\\lambda = 2: \\begin{pmatrix}..\\end{pmatrix},\\; \\lambda = 5: ...`: one eigenvector for every eigenvalue."""
    def check(tex):
        pairs = re.findall(r"\\lambda\s*=\s*([^:]+?)\s*:\s*\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}", tex, re.S)
        if not pairs:
            raise AssertionError(f"{tex!r} has no 'lambda = k: vector' pairs")
        published = sorted((_exact(parse_answer(value)) for value, _ in pairs), key=float)
        truth = sorted(A.eigenvals(), key=float)
        if len(published) != len(truth) or not all(_zero(p - t) for p, t in zip(published, truth)):
            raise AssertionError(f"eigenvalues {published} are not {truth}")
        for value, inner in pairs:
            lam = _exact(parse_answer(value))
            eigvec(A, lam)("\\begin{pmatrix}" + inner + "\\end{pmatrix}")
    return check


def _named(tex, name):
    match = re.search(name + r"\s*=\s*\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}", tex, re.S)
    if not match:
        raise AssertionError(f"{tex!r} has no {name} = matrix")
    return _matrix(match.group(1), tex)


def _check_d(D, P, A):
    if D.shape != (2, 2) or not (_zero(D[0, 1]) and _zero(D[1, 0])):
        raise AssertionError(f"D = {D} is not a diagonal 2 x 2 matrix")
    if _zero(P.det()):
        raise AssertionError(f"P = {P} has no inverse")
    if not _matrices_equal(P * D * P.inv(), A):
        raise AssertionError(f"P D P^-1 = {simplify(P * D * P.inv())} is not A = {A}")


def diagonalization(A):
    def check(tex):
        _check_d(_named(tex, "D"), _named(tex, "P"), A)
    return check


def d_for_p(A, P):
    def check(tex):
        _check_d(_last_matrix(tex), P, A)
    return check


def power(A):
    """`M^{n} = [scalar] \\begin{pmatrix} entries in n \\end{pmatrix}`, equal to A^n for every whole n >= 0."""
    def check(tex):
        rhs = _body(tex).rsplit("=", 1)[-1].strip()
        start = rhs.find("\\begin{pmatrix}")
        if start < 0:
            raise AssertionError(f"{tex!r} has no matrix")
        prefix = rhs[:start].strip()
        scalar = _exact(parse_answer(prefix)) if prefix else 1
        published = scalar * _last_matrix(rhs)
        P, D = A.diagonalize()
        truth = P * diag(*[D[i, i] ** N for i in range(2)]) * P.inv()
        if not _matrices_equal(published, truth):
            raise AssertionError(f"published {published} is not P D^n P^-1 = {simplify(truth)}")
        for k in range(9):
            if published.subs(N, k) != A ** k:
                raise AssertionError(f"at n = {k} the published matrix is not A^{k}")
    return check


def matrix_equals(truth):
    def check(tex):
        published = _last_matrix(tex)
        if not _matrices_equal(published, truth):
            raise AssertionError(f"{published} is not {truth}")
    return check


def _m(rows):
    return Matrix([[Rational(str(x)) for x in row] for row in rows])


# The questions' own matrices.
A_PICK = _m([[3, 1], [0, 2]])               # check-pick-eigenvector
A_HAND = _m([[6, -2], [2, 1]])              # charpoly, eigenvectors and diagonalization by hand
A_LAMBDA4 = _m([[1, 3], [2, 2]])            # check-eigvec-lambda4
A_ORDER = _m([[2, 1], [3, 0]])              # check-d-order
P_ORDER = _m([[1, 1], [-3, 1]])             # check-d-order: P as the question fixes it
TOWNS = _m([[0.94, 0.03], [0.06, 0.97]])    # Northby and Southam
D_CUBE = _m([[0.5, 0], [0, 1]])             # check-d-cubed

CHECKS = {
    "check-pick-eigenvector": eigvec(A_PICK),
    "ex-charpoly-hand": charpoly(A_HAND),
    "ex-eigenvectors-hand": eigpairs(A_HAND),
    "check-eigvec-lambda4": eigvec(A_LAMBDA4, 4),
    "ex-diagonalize-hand": diagonalization(A_HAND),
    "ex-towns-diagonalize": diagonalization(TOWNS),
    "check-d-order": d_for_p(A_ORDER, P_ORDER),
    "ex-towns-power": power(TOWNS),
    "check-d-cubed": matrix_equals(D_CUBE ** 3),
}

NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value)
