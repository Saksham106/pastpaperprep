"""SymPy assertions for lesson 2.13 (Rational functions). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed from each question's own function: vertical asymptotes as the real zeros of the denominator left
after cancelling every common factor (a factor that cancels completely is a gap), horizontal asymptotes as the limit at infinity, oblique asymptotes as the polynomial
quotient (confirmed by f - quotient -> 0), intercepts by substitution and solving, and ranges from the stationary values
found by differentiating (with the limits at the asymptotes and at infinity confirming which values are reached).
"""
import re
import sys
from pathlib import Path

from sympy import (
    Interval, Poly, S, Union, cancel, denom, diff, div, fraction, limit, numer, oo, real_roots, simplify, solve, symbols,
    together,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    _named_pieces, check_numeric, check_rounded, check_same_equation, check_same_set, parse_list, parse_point,
)

x, y, b = symbols("x y b")


def vertical_asymptotes(f):
    """Cancel every common factor first, then take the real zeros of the simplified bottom. After cancel() the top and
    the bottom share no factor, so each of those zeros is a pole (checked by the one-sided limits). A zero of the
    original bottom that cancels completely is a gap, not an asymptote; a repeated factor that only partly cancels,
    as in (x - 1)/(x - 1)^2, is still an asymptote."""
    simplified = cancel(together(f))
    top, bottom = fraction(simplified)
    zeros = sorted(set(real_roots(Poly(bottom, x))), key=float) if Poly(bottom, x).degree() > 0 else []
    for z in zeros:
        assert simplify(top.subs(x, z)) != 0, f"{simplified} still shares the zero {z}"
        assert limit(f, x, z, "-").is_infinite and limit(f, x, z, "+").is_infinite, f"x = {z} is not a pole of {f}"
    return zeros


def gaps(f):
    """Zeros of the original bottom that cancel completely: the graph has a gap there, not an asymptote."""
    poles = vertical_asymptotes(f)
    zeros = set(real_roots(Poly(denom(together(f)), x)))
    return sorted((z for z in zeros if all(simplify(z - p) != 0 for p in poles)), key=float)


# The helper must follow the lesson's rule: cancel fully, then classify (owner review of PR #465). The bottom is written
# expanded, as a question would give it: SymPy would auto-cancel (x - 1)/(x - 1)**2 before the helper saw it.
assert vertical_asymptotes((x - 1) / (x**2 - 2 * x + 1)) == [1] and gaps((x - 1) / (x**2 - 2 * x + 1)) == []
assert vertical_asymptotes((x - 1) / (x**2 - 1)) == [-1] and gaps((x - 1) / (x**2 - 1)) == [1]
assert vertical_asymptotes((x - 1) ** 2 / (x**2 - 1)) == [-1] and gaps((x - 1) ** 2 / (x**2 - 1)) == [1]


def horizontal_asymptote(f):
    left, right = limit(f, x, -oo), limit(f, x, oo)
    assert left == right and left.is_finite, (left, right)
    return right


def oblique_asymptote(f):
    """The polynomial quotient, which must be linear, with f - quotient -> 0 at both ends."""
    quotient, remainder = div(numer(f), denom(f), x)
    assert Poly(quotient, x).degree() == 1 and remainder != 0
    assert limit(f - quotient, x, oo) == 0 and limit(f - quotient, x, -oo) == 0
    return quotient


def values_are(tex, truth):
    """Every piece must be named x (`x = -1 \\text{ and } x = 5`): a bare number or a `y =` piece is not the line or
    the root asked for, so it fails."""
    names = [name for name, _ in _named_pieces(tex)]
    if any(name != "x" for name in names):
        raise AssertionError(f"every value in {tex!r} must be written as x = ..., got names {names}")
    published = sorted(parse_list(tex), key=float)
    truth = sorted(truth, key=float)
    if len(published) != len(truth) or any(simplify(p - t) != 0 for p, t in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


def intercept_points(tex, f):
    """`(0, k) \\text{ and } (m, 0)`: all axis intercepts, as a set of points."""
    pieces = [piece for piece in re.split(r"\\text\{\s*and\s*\}", tex.replace("$", "")) if piece.strip()]
    published = sorted((tuple(parse_point(piece)) for piece in pieces), key=lambda p: (float(p[0]), float(p[1])))
    roots = [r for r in solve(numer(cancel(f)), x) if r.is_real and simplify(denom(together(f)).subs(x, r)) != 0]
    truth = sorted([(S(0), f.subs(x, 0))] + [(r, S(0)) for r in roots], key=lambda p: (float(p[0]), float(p[1])))
    if len(published) != len(truth) or any(
        simplify(p[0] - q[0]) != 0 or simplify(p[1] - q[1]) != 0 for p, q in zip(published, truth)
    ):
        raise AssertionError(f"published intercepts {published}, truth {truth}")


def turning_values(f):
    """(local maximum values, local minimum values), classified by the sign of f''."""
    second = diff(f, x, 2)
    maxima, minima = [], []
    for c in solve(diff(f, x), x):
        if not c.is_real:
            continue
        curvature = second.subs(x, c)
        assert curvature != 0
        (maxima if curvature < 0 else minima).append(simplify(f.subs(x, c)))
    return maxima, minima


def range_no_vertical(f):
    """Continuous on R (no vertical asymptote) and tending to a finite limit between the turning values, so the
    range is the closed interval from the lowest to the highest turning value."""
    assert vertical_asymptotes(f) == []
    maxima, minima = turning_values(f)
    low, high = min(minima), max(maxima)
    assert low < horizontal_asymptote(f) < high
    return Interval(low, high)


def range_two_pieces(f):
    """One vertical asymptote: the left piece rises to a local maximum M and both its ends go to -oo; the right piece
    falls to a local minimum m and both its ends go to +oo. With M < m the range is y <= M or y >= m."""
    (va,) = vertical_asymptotes(f)
    maxima, minima = turning_values(f)
    assert len(maxima) == 1 and len(minima) == 1
    assert limit(f, x, va, "-") == -oo and limit(f, x, -oo) == -oo
    assert limit(f, x, va, "+") == oo and limit(f, x, oo) == oo
    high_left, low_right = maxima[0], minima[0]
    assert high_left < low_right
    return high_left, low_right


def range_rounded(tex, f):
    """`y \\le A \\text{ or } y \\ge B` with A, B the turning values rounded to 3 s.f."""
    high_left, low_right = range_two_pieces(f)
    cleaned = tex.replace("$", "").replace("\\leq", "\\le").replace("\\geq", "\\ge")
    pieces = [piece.strip() for piece in re.split(r"\\text\{\s*or\s*\}", cleaned)]
    if len(pieces) != 2:
        raise AssertionError(f"{tex!r} should have two parts")
    found = {}
    for piece in pieces:
        match = re.fullmatch(r"y\s*(\\le|\\ge|<|>)\s*(.+)", piece)
        if not match:
            raise ValueError(f"cannot read {piece!r}")
        found[match.group(1)] = match.group(2)
    if set(found) != {"\\le", "\\ge"}:
        raise AssertionError(f"{tex!r} must use \\le and \\ge, since the turning values are reached")
    upper, lower = found["\\le"], found["\\ge"]
    check_rounded("y \\approx " + upper, high_left, sf=3)
    check_rounded("y \\approx " + lower, low_right, sf=3)


def range_set(tex, f):
    high_left, low_right = range_two_pieces(f)
    check_same_set(tex, Union(Interval(-oo, high_left), Interval(low_right, oo)), var="y")


def unknown_b():
    """b such that (3x^2 + bx + 1)/(x + 2) has oblique asymptote y = 3x + 1."""
    quotient, _ = div(3 * x**2 + b * x + 1, x + 2, x)
    (sol,) = solve(Poly(quotient - (3 * x + 1), x).all_coeffs(), b, dict=True)
    found = (3 * x**2 + sol[b] * x + 1) / (x + 2)
    assert simplify(oblique_asymptote(found) - (3 * x + 1)) == 0
    return sol[b]


F_LQ = (2 * x + 1) / (x**2 - 4 * x - 5)
H_LQ = (6 - 2 * x) / (x**2 + 2 * x - 8)
F_DIV = (x**2 + 3 * x - 1) / (x - 2)
F_SKETCH = (2 * x**2 - 5 * x - 3) / (x + 2)
G_RANGE = 4 * x / (x**2 + 4)
F_GDC = (x**2 + x + 7) / (x - 3)

CHECKS = {
    "before-horizontal-linear": lambda tex: check_same_equation(tex, y - horizontal_asymptote((4 * x - 1) / (2 * x + 5))),
    "before-remainder": lambda val, tolerance: check_numeric(
        val, div(x**2 + 5 * x + 1, x + 2, x)[1], sf=3, tolerance=tolerance),
    "before-quadratic-zeros": lambda tex: values_are(tex, solve(x**2 - 2 * x - 15, x)),
    "ex-lq-asymptotes": lambda tex: values_are(tex, vertical_asymptotes(F_LQ)),
    "check-lq-horizontal": lambda tex: check_same_equation(tex, y - horizontal_asymptote((5 * x - 1) / (2 * x**2 + 3))),
    "ex-lq-sketch": lambda tex: intercept_points(tex, H_LQ),
    "check-lq-vertical-count": lambda val, tolerance: check_numeric(
        val, len(vertical_asymptotes((x + 2) / (x**2 + 6 * x + 10))), sf=3, tolerance=tolerance),
    "check-lq-repeated-factor": lambda val, tolerance: check_numeric(
        val, len(vertical_asymptotes((2 * x - 6) / (x**2 - 6 * x + 9))), sf=3, tolerance=tolerance),
    "check-lq-cross": lambda val, tolerance: check_numeric(
        val, solve((x - 6) / (x**2 + 4) - horizontal_asymptote((x - 6) / (x**2 + 4)), x)[0], sf=3, tolerance=tolerance),
    "ex-ql-division": lambda tex: check_same_equation(tex, y - oblique_asymptote(F_DIV)),
    "check-ql-oblique": lambda tex: check_same_equation(tex, y - oblique_asymptote((x**2 - x + 5) / (x - 3))),
    "ex-ql-sketch": lambda tex: check_same_equation(tex, y - oblique_asymptote(F_SKETCH)),
    "check-ql-unknown": lambda val, tolerance: check_numeric(val, unknown_b(), sf=3, tolerance=tolerance),
    "ex-range-discriminant": lambda tex: check_same_set(tex, range_no_vertical(G_RANGE), var="y"),
    "check-range-discriminant": lambda val, tolerance: check_numeric(
        val, range_no_vertical(2 * x / (x**2 + 9)).end, sf=3, tolerance=tolerance),
    "ex-range-gdc": lambda tex: range_rounded(tex, F_GDC),
    "check-range-choice": lambda tex: range_set(tex, (x**2 + 8) / (x - 1)),
}

# Required precision of every numeric check; the gate holds `tolerance` to half a unit there.
NUMERIC = {
    "before-remainder": {"sf": 3},
    "check-lq-vertical-count": {"sf": 3},
    "check-lq-repeated-factor": {"sf": 3},
    "check-lq-cross": {"sf": 3},
    "check-ql-unknown": {"sf": 3},
    "check-range-discriminant": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
