"""SymPy assertions for 0580 lesson 6.4 (trigonometric functions). Not shipped to the browser.

Solving a trigonometric equation gives SEVERAL angles in degrees, such as `x = 150^{\\circ} \\text{ or } x = 330^{\\circ}`.
The `angle` kind reads one angle in degrees and the `list` kind reads several values but not the degree sign, so no
verify kind fits these answers. `angles` splits the published answer at `\\text{ or }` and checks each piece with the
`angle` kind's own checker (exact angles with =, rounded ones with \\approx to the stated decimal places). The count
must match, so a missing second angle, an extra one, or an angle outside the range fails.

The truth is every solution in 0 <= x <= 360, found by SymPy's solveset on the question's own equation with x in
degrees. It does not use the lesson's a / 180 - a / 360 - a table, so it checks that table independently.
Single-angle answers use their declarative `verify` block.
"""
import sys
from pathlib import Path

from sympy import Eq, FiniteSet, Interval, Rational, Symbol, cos, pi, sin, solveset, sqrt, tan

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import _split, _strip_decorations, _top_level_cuts  # noqa: E402
from verify_kinds import k_angle  # noqa: E402

x = Symbol("x", real=True)
DEG = pi / 180


def solutions(lhs, rhs):
    """Every x in [0, 360] (degrees) with lhs(x) = rhs; lhs is written with x in degrees via DEG."""
    found = solveset(Eq(lhs, rhs), x, Interval(0, 360))
    if not isinstance(found, FiniteSet) or not found:
        raise ValueError(f"solveset did not give a finite list of angles: {found}")
    return sorted(found, key=float)


def angles(tex, truths, dp=None):
    cleaned = _strip_decorations(tex).strip()
    pieces = [piece.strip() for piece in _split(cleaned, _top_level_cuts(cleaned, r"\\text\{\s*or\s*\}")) if piece.strip()]
    if len(pieces) != len(truths):
        raise AssertionError(f"{tex!r} gives {len(pieces)} angle(s), {len(truths)} expected")
    remaining = list(truths)
    opts = {} if dp is None else {"dp": dp}
    for piece in pieces:
        for i, truth in enumerate(remaining):
            try:
                k_angle(piece, truth, opts)
            except AssertionError:
                continue
            remaining.pop(i)
            break
        else:
            raise AssertionError(f"{piece!r} is not one of the solutions {[float(t) for t in remaining]}")


CHECKS = {
    # tan x = 0 on 0..360: read off the graph.
    "ex-graph-tan-zero": lambda tex: angles(tex, solutions(tan(x * DEG), 0)),
    # sqrt(3) tan x = 3.
    "ex-exact-tan": lambda tex: angles(tex, solutions(sqrt(3) * tan(x * DEG), 3)),
    # 4 sin x = -2.
    "check-exact-sin-neg": lambda tex: angles(tex, solutions(4 * sin(x * DEG), -2)),
    # 2 cos x + sqrt(2) = 0.
    "ex-exact-cos-neg": lambda tex: angles(tex, solutions(2 * cos(x * DEG) + sqrt(2), 0)),
    # tan x + 1 = 0.
    "check-exact-tan-neg": lambda tex: angles(tex, solutions(tan(x * DEG) + 1, 0)),
    # 5 cos x = 2, to 1 d.p.
    "ex-calc-cos": lambda tex: angles(tex, solutions(5 * cos(x * DEG), 2), dp=1),
    # 7 sin x + 4 = 0, to 1 d.p.
    "ex-calc-sin-neg": lambda tex: angles(tex, solutions(7 * sin(x * DEG) + 4, 0), dp=1),
    # tan x = 2.5, to 1 d.p.
    "check-calc-tan": lambda tex: angles(tex, solutions(tan(x * DEG), Rational(5, 2)), dp=1),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
