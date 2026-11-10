"""SymPy assertions for IB Maths AI lesson 3.15 (adjacency matrices and walks). Not shipped to the browser.

Why a sidecar: no declarative verify kind reads a matrix with more than one column (`vector` reads a single column
only). Each id here has an answer that is a square matrix written as pmatrix: an adjacency matrix read from a figure, or
a transition matrix built from one. The published matrix is read row by row (rows split on \\\\, elements on &) and
must equal the truth element for element. Truths are built here from each figure's edge list, so a transition matrix
is computed from the edges and out-degrees, not typed in. Every other block uses its own `verify` block.
"""
import re
import sys
from pathlib import Path

from sympy import Matrix, simplify, zeros

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


def adjacency(order, edges, directed):
    """Adjacency matrix in the given vertex order; each edge "XY" adds 1 to row X, column Y (and Y, X if undirected)."""
    index = {name: i for i, name in enumerate(order)}
    a = zeros(len(order))
    for edge in edges:
        i, j = index[edge[0]], index[edge[1]]
        a[i, j] += 1
        if not directed:
            a[j, i] += 1
    return a


def transition(a):
    """T_ij = a_ji / (out-degree of j): the adjacency matrix transposed, each column divided by its total."""
    t = a.T
    for j in range(t.cols):
        total = sum(t[:, j])
        t[:, j] = t[:, j] / total
    return t


PARK = adjacency("FGKLV", ["FG", "FK", "FL", "GK", "KL", "KV", "LV"], directed=False)
SKI = adjacency("PQRS", ["PQ", "QP", "QR", "RS", "RP", "SP"], directed=True)
MUSEUM = adjacency("ABCD", ["AB", "AC", "BC", "CD"], directed=False)
WEB = adjacency("HNSW", ["HN", "NH", "HS", "SH", "NS", "HW", "WS"], directed=True)

CHECKS = {
    "ex-park-matrix": matrices(PARK),
    "ex-ski-matrix": matrices(SKI),
    "ex-museum-transition": matrices(transition(MUSEUM)),
    "ex-web-transition": matrices(transition(WEB)),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
