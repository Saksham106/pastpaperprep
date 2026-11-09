"""SymPy assertions for IB Maths AI lesson 4.19 (transition matrices and Markov chains). Not shipped to the browser.

Why a sidecar: no declarative verify kind reads a matrix with more than one column (`vector` reads a single column
only). Each id here has an answer that is a transition matrix written as a pmatrix, built from a description or a
transition diagram. The published matrix is read row by row (rows split on \\\\, elements on &) and must equal the truth
element for element. Truths are built here from each question's list of moves "from -> to: probability", so the
matrix is computed (column j = moves out of state j), not typed in. Every other block uses its own `verify` block.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, simplify, zeros

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import parse_answer  # noqa: E402

_PMATRIX = re.compile(r"\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}", re.S)


def _matrices(tex):
    """Every pmatrix in the text, in order, as SymPy matrices."""
    from sympy import Matrix

    found = []
    for body in _PMATRIX.findall(tex):
        rows = [row for row in re.split(r"\\\\", body) if row.strip()]
        parsed = [[parse_answer(entry.strip()) for entry in row.split("&")] for row in rows]
        if len({len(row) for row in parsed}) != 1:
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


def transition(order, moves):
    """T with T[i, j] = probability of moving from state j to state i. `moves` maps "XY" (from X to Y) to a
    probability given as a string; a move left out is 0. Every column must add up to 1."""
    index = {name: i for i, name in enumerate(order)}
    t = zeros(len(order))
    for pair, probability in moves.items():
        t[index[pair[1]], index[pair[0]]] = Rational(probability)
    for j in range(t.cols):
        if sum(t[:, j]) != 1:
            raise ValueError(f"column {order[j]} adds up to {sum(t[:, j])}, not 1")
    return t


# Priya cooks at home (H) or eats out (E): home -> home 0.75, out -> home 0.4.
MEALS = transition("HE", {"HH": "0.75", "HE": "0.25", "EH": "0.4", "EE": "0.6"})
# Library book: on the shelf (S), on loan (L), in repair (R), from the transition diagram.
BOOK = transition("SLR", {"SS": "0.6", "SL": "0.38", "SR": "0.02", "LS": "0.5", "LL": "0.45", "LR": "0.05",
                          "RS": "0.7", "RR": "0.3"})

CHECKS = {
    "ex-meals-matrix": matrices(MEALS),
    "ex-book-matrix": matrices(BOOK),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
